import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_ITEMS = 40;
const MAX_QUANTITY = 20;
const DEFAULT_SHIPPING_FEE = 50;
const ADDITIONAL_MERCHANT_FEE = 15;
const CREATE_LIMIT = 8;
const CREATE_WINDOW_MS = 10 * 60 * 1000;
const createLimits = new Map();
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sendJson(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function getSupabaseConfig() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceKey) {
    throw new Error("La conexión segura de pedidos no está configurada.");
  }
  return {
    origin: new URL(supabaseUrl).origin,
    anonKey,
    serviceKey,
  };
}

function getAccessToken() {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("El pago en línea aún no está configurado.");
  return token;
}

function isRateLimited(req) {
  const ip = String(
    req.headers?.["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "unknown",
  )
    .split(",")[0]
    .trim()
    .slice(0, 80);
  const now = Date.now();
  const previous = createLimits.get(ip);
  if (!previous || now - previous.startedAt >= CREATE_WINDOW_MS) {
    createLimits.set(ip, { startedAt: now, count: 1 });
    if (createLimits.size > 2000) {
      for (const [key, value] of createLimits) {
        if (now - value.startedAt >= CREATE_WINDOW_MS) createLimits.delete(key);
      }
    }
    return false;
  }
  previous.count += 1;
  return previous.count > CREATE_LIMIT;
}

async function readRequestBody(req) {
  if (req.body !== undefined) {
    if (typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
    return JSON.parse(String(req.body));
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 40_000) throw new Error("body-too-large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function parseBody(req) {
  try {
    return await readRequestBody(req);
  } catch {
    return null;
  }
}

async function supabaseRequest(path, options = {}) {
  const config = getSupabaseConfig();
  const headers = {
    apikey: config.serviceKey,
    Authorization: "Bearer " + config.serviceKey,
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers ?? {}),
  };
  const response = await fetch(config.origin + path, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {}
  if (!response.ok) {
    console.error("Mercado Pago Supabase request failed", response.status);
    throw new Error("No pudimos guardar el estado del pago.");
  }
  return data;
}

async function verifyUser(req) {
  const authorization = req.headers?.authorization;
  if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) {
    return null;
  }
  const config = getSupabaseConfig();
  const response = await fetch(config.origin + "/auth/v1/user", {
    headers: {
      apikey: config.anonKey,
      Authorization: authorization,
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  const user = await response.json();
  if (typeof user?.id !== "string" || !UUID_PATTERN.test(user.id)) return null;
  return user;
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function publicBaseUrl(req) {
  const configured =
    process.env.APP_BASE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    process.env.REPLIT_DEV_DOMAIN;
  if (configured) {
    const value = configured.includes("://") ? configured : "https://" + configured;
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
      throw new Error("La dirección de retorno no es segura.");
    }
    return parsed.origin;
  }

  const origin = req.headers?.origin;
  if (typeof origin === "string") {
    const parsed = new URL(origin);
    const safeHost =
      parsed.hostname === "localhost" ||
      parsed.hostname.endsWith(".replit.dev") ||
      parsed.hostname.endsWith(".replit.app") ||
      parsed.hostname.endsWith(".vercel.app");
    if (safeHost && (parsed.protocol === "https:" || parsed.hostname === "localhost")) {
      return parsed.origin;
    }
  }
  throw new Error("Configura la dirección pública de la aplicación para pagos.");
}

function mapProviderStatus(status) {
  if (status === "approved") return "approved";
  if (status === "rejected" || status === "cancelled" || status === "refunded") {
    return "rejected";
  }
  return "pending";
}

async function getCheckout(checkoutId) {
  const rows = await supabaseRequest(
    "/rest/v1/mercadopago_checkouts?id=eq." +
      encodeURIComponent(checkoutId) +
      "&select=*",
  );
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

async function setCheckoutStatus(checkoutId, status, extra = {}) {
  return supabaseRequest(
    "/rest/v1/mercadopago_checkouts?id=eq." + encodeURIComponent(checkoutId),
    {
      method: "PATCH",
      body: { status, updated_at: new Date().toISOString(), ...extra },
      headers: { Prefer: "return=minimal" },
    },
  );
}

async function createPreference(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Método no permitido." });
  }
  if (!String(req.headers?.["content-type"] ?? "").startsWith("application/json")) {
    return sendJson(res, 415, { error: "Usa una solicitud JSON." });
  }
  if (isRateLimited(req)) {
    return sendJson(res, 429, { error: "Espera unos minutos antes de intentar otro pago." });
  }

  let user;
  try {
    user = await verifyUser(req);
  } catch {
    return sendJson(res, 503, { error: "No pudimos validar tu sesión. Intenta de nuevo." });
  }
  if (!user) return sendJson(res, 401, { error: "Inicia sesión para pagar en línea." });

  const body = await parseBody(req);
  if (!body || !Array.isArray(body.items) || body.items.length < 1 || body.items.length > MAX_ITEMS) {
    return sendJson(res, 400, { error: "El carrito no es válido para el pago en línea." });
  }
  const address = String(body.address ?? "").trim().slice(0, 500);
  if (!address) return sendJson(res, 400, { error: "Agrega una dirección de entrega." });
  const zoneId = body.shipping_zone_id == null ? null : String(body.shipping_zone_id);
  if (zoneId && !UUID_PATTERN.test(zoneId)) {
    return sendJson(res, 400, { error: "La zona de entrega no es válida." });
  }

  const quantities = new Map();
  for (const item of body.items) {
    const id = String(item?.id ?? "");
    const quantity = Number(item?.quantity);
    if (
      !UUID_PATTERN.test(id) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_QUANTITY
    ) {
      return sendJson(res, 400, { error: "Un producto o cantidad del carrito no es válido." });
    }
    quantities.set(id, Math.min(MAX_QUANTITY, (quantities.get(id) ?? 0) + quantity));
  }

  let token;
  let products;
  let merchants;
  let shippingFee = DEFAULT_SHIPPING_FEE;
  try {
    token = getAccessToken();
    const productIds = Array.from(quantities.keys());
    products = await supabaseRequest(
      "/rest/v1/products?id=in.(" +
        productIds.map(encodeURIComponent).join(",") +
        ")&is_available=eq.true&select=id,merchant_id,name,price,is_available",
    );
    if (!Array.isArray(products) || products.length !== productIds.length) {
      return sendJson(res, 409, {
        error: "Algún producto ya no está disponible. Actualiza el carrito e intenta de nuevo.",
      });
    }
    const merchantIds = Array.from(new Set(products.map(function (product) {
      return product.merchant_id;
    })));
    if (merchantIds.some(function (id) { return !UUID_PATTERN.test(id); })) {
      return sendJson(res, 409, { error: "Hay un negocio inválido en el carrito." });
    }
    merchants = await supabaseRequest(
      "/rest/v1/merchants?id=in.(" +
        merchantIds.map(encodeURIComponent).join(",") +
        ")&select=id,name,is_open",
    );
    if (
      !Array.isArray(merchants) ||
      merchants.length !== merchantIds.length ||
      merchants.some(function (merchant) { return merchant.is_open !== true; })
    ) {
      return sendJson(res, 409, {
        error: "Algún negocio ya está cerrado. Actualiza el carrito antes de pagar.",
      });
    }
    if (zoneId) {
      const zones = await supabaseRequest(
        "/rest/v1/fraccionamientos?id=eq." +
          encodeURIComponent(zoneId) +
          "&activo=eq.true&select=id,costo_envio",
      );
      if (!Array.isArray(zones) || zones.length !== 1) {
        return sendJson(res, 409, { error: "La zona de entrega ya no está disponible." });
      }
      shippingFee = Number(zones[0].costo_envio);
    }
  } catch (error) {
    console.error("Mercado Pago checkout setup failed", error?.message ?? "unknown");
    return sendJson(res, 503, {
      error: error?.message === "El pago en línea aún no está configurado."
        ? error.message
        : "No pudimos preparar el pago. Intenta de nuevo.",
    });
  }

  const productsById = new Map(products.map(function (product) {
    return [product.id, product];
  }));
  const merchantsById = new Map(merchants.map(function (merchant) {
    return [merchant.id, merchant];
  }));
  const grouped = new Map();
  let subtotal = 0;
  const itemSnapshot = [];
  for (const [id, quantity] of quantities) {
    const product = productsById.get(id);
    const price = Number(product?.price);
    if (!product || !Number.isFinite(price) || price < 0) {
      return sendJson(res, 409, { error: "No se pudo confirmar el precio de un producto." });
    }
    const lineTotal = roundMoney(price * quantity);
    subtotal = roundMoney(subtotal + lineTotal);
    const merchantItems = grouped.get(product.merchant_id) ?? [];
    merchantItems.push({
      producto_id: product.id,
      nombre: String(product.name).slice(0, 120),
      cantidad: quantity,
      precio_unitario: roundMoney(price),
      importe: lineTotal,
    });
    grouped.set(product.merchant_id, merchantItems);
    itemSnapshot.push({
      producto_id: product.id,
      negocio_id: product.merchant_id,
      nombre: String(product.name).slice(0, 120),
      cantidad: quantity,
      precio_unitario: roundMoney(price),
      importe: lineTotal,
    });
  }
  if (!Number.isFinite(shippingFee) || shippingFee < 0) {
    return sendJson(res, 409, { error: "El costo de envío de la zona no es válido." });
  }
  const totalShipping =
    roundMoney(shippingFee) +
    Math.max(0, grouped.size - 1) * ADDITIONAL_MERCHANT_FEE;
  const total = roundMoney(subtotal + totalShipping);
  if (total <= 0 || total > 100_000) {
    return sendJson(res, 400, { error: "El total del pago está fuera del límite permitido." });
  }

  const orderSnapshots = Array.from(grouped.entries()).map(function ([merchantId, items], index) {
    const merchant = merchantsById.get(merchantId);
    const merchantSubtotal = roundMoney(items.reduce(function (sum, item) {
      return sum + item.importe;
    }, 0));
    const merchantShipping = index === 0 ? totalShipping : 0;
    return {
      negocio_id: merchantId,
      negocio_nombre: String(merchant?.name ?? "Negocio").slice(0, 120),
      subtotal: merchantSubtotal,
      costo_envio: merchantShipping,
      total_pagar: roundMoney(merchantSubtotal + merchantShipping),
      items,
    };
  });
  if (orderSnapshots.length > 4) {
    return sendJson(res, 400, {
      error: "Un pedido puede incluir productos de hasta cuatro negocios.",
    });
  }

  let checkout;
  try {
    const active = await supabaseRequest(
      "/rest/v1/mercadopago_checkouts?cliente_id=eq." +
        encodeURIComponent(user.id) +
        "&status=eq.pending&select=*",
    );
    if (Array.isArray(active) && active.length > 0) {
      const current = active[0];
      const sameCart =
        JSON.stringify(current.cart_snapshot ?? []) === JSON.stringify(itemSnapshot) &&
        String(current.shipping_address ?? "") === address &&
        String(current.shipping_zone_id ?? "") === String(zoneId ?? "") &&
        roundMoney(Number(current.total)) === total;
      if (
        sameCart &&
        current.checkout_url &&
        current.expires_at &&
        Date.parse(current.expires_at) > Date.now()
      ) {
        return sendJson(res, 200, {
          checkout_id: current.id,
          init_point: current.checkout_url,
          total: Number(current.total),
          currency: "MXN",
        });
      }
      if (current.expires_at && Date.parse(current.expires_at) <= Date.now()) {
        const previousPayment = await searchAndVerifyPayment(current);
        if (previousPayment?.status === "approved") {
          const finalized = await finalizeApprovedPayment(current, previousPayment);
          return sendJson(res, finalized ? 409 : 503, {
            status: finalized ? "approved" : undefined,
            checkout_id: current.id,
            error: finalized
              ? "Tu pago anterior ya fue confirmado. Revisa tus pedidos."
              : "El pago anterior se recibió y se está confirmando.",
          });
        }
        await setCheckoutStatus(current.id, "expired");
      } else {
        return sendJson(res, 409, {
          error: "Ya tienes un pago pendiente. Revisa su estado antes de iniciar otro.",
          checkout_id: current.id,
        });
      }
    }
    const created = await supabaseRequest("/rest/v1/mercadopago_checkouts", {
      method: "POST",
      body: {
        cliente_id: user.id,
        cliente_email: String(user.email ?? "").slice(0, 254) || null,
        cart_snapshot: itemSnapshot,
        orders_snapshot: orderSnapshots,
        shipping_address: address,
        shipping_zone_id: zoneId,
        subtotal,
        shipping_fee: totalShipping,
        total,
        status: "pending",
      },
      headers: { Prefer: "return=representation" },
    });
    checkout = Array.isArray(created) ? created[0] : null;
    if (!checkout?.id) throw new Error("No se pudo crear el intento de pago.");
  } catch (error) {
    console.error("Mercado Pago checkout persistence failed", error?.message ?? "unknown");
    return sendJson(res, 503, { error: "No pudimos iniciar el pago. Intenta de nuevo." });
  }

  let baseUrl;
  try {
    baseUrl = publicBaseUrl(req);
  } catch (error) {
    await setCheckoutStatus(checkout.id, "failed").catch(function () {});
    return sendJson(res, 503, {
      error: error?.message ?? "No pudimos preparar la dirección de retorno del pago.",
    });
  }

  const returnUrl =
    baseUrl + "/?mp_checkout=" + encodeURIComponent(checkout.id);
  const preferenceBody = {
    items: [
      {
        id: "changuito-" + checkout.id,
        title: "Pedido Changuito Express",
        description: "Pedido de productos con entrega a domicilio",
        quantity: 1,
        currency_id: "MXN",
        unit_price: total,
      },
    ],
    external_reference: checkout.id,
    back_urls: {
      success: returnUrl,
      pending: returnUrl,
      failure: returnUrl,
    },
    auto_return: "approved",
    notification_url: baseUrl + "/api/mercadopago/webhook",
    expires: true,
    metadata: {
      checkout_id: checkout.id,
      customer_id: user.id,
    },
    expiration_date_to: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
  };

  let preferenceResponse;
  try {
    preferenceResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        "X-Idempotency-Key": checkout.id,
      },
      body: JSON.stringify(preferenceBody),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    await setCheckoutStatus(checkout.id, "failed").catch(function () {});
    return sendJson(res, 502, { error: "Mercado Pago no respondió. Intenta de nuevo." });
  }
  if (!preferenceResponse.ok) {
    let providerStatus = preferenceResponse.status;
    try {
      const details = await preferenceResponse.json();
      providerStatus = String(details?.status ?? providerStatus).slice(0, 40);
    } catch {}
    console.error("Mercado Pago preference failed", providerStatus);
    await setCheckoutStatus(checkout.id, "failed").catch(function () {});
    return sendJson(res, 502, {
      error: "Mercado Pago rechazó la solicitud. Verifica que la credencial sea válida para Checkout.",
    });
  }
  const preference = await preferenceResponse.json();
  const checkoutUrl = preference?.sandbox_init_point;
  if (
    !preference?.id ||
    typeof checkoutUrl !== "string" ||
    !checkoutUrl.startsWith("https://sandbox.")
  ) {
    await setCheckoutStatus(checkout.id, "failed").catch(function () {});
    return sendJson(res, 502, { error: "Mercado Pago no devolvió un enlace seguro de pago." });
  }
  try {
    await supabaseRequest(
      "/rest/v1/mercadopago_checkouts?id=eq." + encodeURIComponent(checkout.id),
      {
        method: "PATCH",
        body: {
          mp_preference_id: String(preference.id).slice(0, 100),
          checkout_url: checkoutUrl,
          updated_at: new Date().toISOString(),
        },
        headers: { Prefer: "return=minimal" },
      },
    );
  } catch {
    await setCheckoutStatus(checkout.id, "failed").catch(function () {});
    return sendJson(res, 503, { error: "No pudimos guardar el enlace seguro del pago." });
  }
  return sendJson(res, 200, {
    checkout_id: checkout.id,
    init_point: checkoutUrl,
    total,
    currency: "MXN",
  });
}

async function fetchProviderPayment(paymentId) {
  const token = getAccessToken();
  const response = await fetch(
    "https://api.mercadopago.com/v1/payments/" + encodeURIComponent(paymentId),
    {
      headers: { Authorization: "Bearer " + token },
      signal: AbortSignal.timeout(12_000),
    },
  );
  if (!response.ok) {
    console.error("Mercado Pago payment lookup failed", response.status);
    throw new Error("No pudimos verificar el pago con Mercado Pago.");
  }
  return response.json();
}

function isValidWebhookSignature(req, paymentId) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    // Replit previews may use test credentials before the app has a configured
    // webhook secret. Production deployments must configure the secret.
    return !process.env.VERCEL;
  }
  const signature = String(req.headers?.["x-signature"] ?? "");
  const requestId = String(req.headers?.["x-request-id"] ?? "");
  const pieces = Object.fromEntries(
    signature.split(",").map(function (part) {
      const [key, ...value] = part.trim().split("=");
      return [key, value.join("=")];
    }),
  );
  if (!pieces.ts || !pieces.v1 || !requestId) return false;
  const manifest =
    "id:" + String(paymentId).toLowerCase() + ";request-id:" + requestId + ";ts:" + pieces.ts + ";";
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const receivedBuffer = Buffer.from(pieces.v1, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

async function finalizeApprovedPayment(checkout, payment) {
  if (
    !checkout ||
    !payment ||
    payment.status !== "approved" ||
    String(payment.external_reference ?? "") !== String(checkout.id) ||
    String(payment.currency_id ?? "") !== "MXN" ||
    !Number.isFinite(Number(payment.transaction_amount)) ||
    roundMoney(Number(payment.transaction_amount)) !== roundMoney(Number(checkout.total))
  ) {
    return false;
  }
  const result = await supabaseRequest("/rest/v1/rpc/confirmar_checkout_mercadopago", {
    method: "POST",
    body: {
      p_checkout_id: checkout.id,
      p_mp_payment_id: String(payment.id),
    },
  });
  return result?.ok === true;
}

async function searchAndVerifyPayment(checkout) {
  const token = getAccessToken();
  const params = new URLSearchParams({
    external_reference: checkout.id,
    sort: "date_created",
    criteria: "desc",
    limit: "10",
  });
  const response = await fetch(
    "https://api.mercadopago.com/v1/payments/search?" + params.toString(),
    {
      headers: { Authorization: "Bearer " + token },
      signal: AbortSignal.timeout(12_000),
    },
  );
  if (!response.ok) {
    console.error("Mercado Pago payment search failed", response.status);
    throw new Error("No pudimos consultar el estado del pago.");
  }
  const data = await response.json();
  const payments = Array.isArray(data?.results) ? data.results : [];
  return payments.find(function (payment) {
    return (
      String(payment.external_reference ?? "") === String(checkout.id) &&
      String(payment.currency_id ?? "") === "MXN" &&
      Number.isFinite(Number(payment.transaction_amount)) &&
      roundMoney(Number(payment.transaction_amount)) === roundMoney(Number(checkout.total))
    );
  }) ?? null;
}

async function paymentStatus(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Método no permitido." });
  }
  let user;
  try {
    user = await verifyUser(req);
  } catch {
    return sendJson(res, 503, { error: "No pudimos validar tu sesión." });
  }
  if (!user) return sendJson(res, 401, { error: "Inicia sesión para revisar el pago." });
  const url = new URL(req.url ?? "/", "http://localhost");
  const checkoutId = url.searchParams.get("checkout_id") ?? "";
  if (!UUID_PATTERN.test(checkoutId)) {
    return sendJson(res, 400, { error: "El identificador del pago no es válido." });
  }
  try {
    const checkout = await getCheckout(checkoutId);
    if (!checkout || checkout.cliente_id !== user.id) {
      return sendJson(res, 404, { error: "No encontramos ese pago para tu cuenta." });
    }
    if (checkout.status === "approved") {
      return sendJson(res, 200, {
        status: "approved",
        order_ids: checkout.order_ids ?? [],
        total: Number(checkout.total),
        items: checkout.cart_snapshot ?? [],
      });
    }
    if (checkout.status === "failed" || checkout.status === "expired") {
      return sendJson(res, 200, {
        status: checkout.status,
        checkout_url: checkout.checkout_url ?? null,
      });
    }
    const payment = await searchAndVerifyPayment(checkout);
    if (payment?.status === "approved") {
      const finalized = await finalizeApprovedPayment(checkout, payment);
      if (!finalized) {
        return sendJson(res, 503, { error: "El pago se recibió, pero el pedido aún se está confirmando." });
      }
      const updated = await getCheckout(checkoutId);
      return sendJson(res, 200, {
        status: "approved",
        order_ids: updated?.order_ids ?? [],
        total: Number(checkout.total),
        items: checkout.cart_snapshot ?? [],
      });
    }
    const state = payment ? mapProviderStatus(payment.status) : "pending";
    if (state === "rejected") {
      return sendJson(res, 200, {
        status: "rejected",
        checkout_url: checkout.checkout_url ?? null,
      });
    }
    if (checkout.expires_at && Date.parse(checkout.expires_at) <= Date.now()) {
      await setCheckoutStatus(checkout.id, "expired");
      return sendJson(res, 200, {
        status: "expired",
        checkout_url: checkout.checkout_url ?? null,
      });
    }
    return sendJson(res, 200, {
      status: "pending",
      checkout_url: checkout.checkout_url ?? null,
      total: Number(checkout.total),
    });
  } catch (error) {
    console.error("Mercado Pago status check failed", error?.message ?? "unknown");
    return sendJson(res, 503, {
      error: error?.message ?? "No pudimos revisar el pago. Intenta de nuevo.",
    });
  }
}

async function paymentWebhook(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Método no permitido." });
  }
  if (process.env.VERCEL && !process.env.MERCADOPAGO_WEBHOOK_SECRET) {
    return sendJson(res, 503, { error: "Falta configurar la firma del webhook de Mercado Pago." });
  }
  const url = new URL(req.url ?? "/", "http://localhost");
  const body = await parseBody(req);
  const paymentId = String(
    url.searchParams.get("data.id") ?? body?.data?.id ?? body?.id ?? "",
  );
  if (!paymentId || paymentId.length > 100 || !/^[0-9]+$/.test(paymentId)) {
    return sendJson(res, 200, { received: true });
  }
  if (!isValidWebhookSignature(req, paymentId)) {
    return sendJson(res, 401, { error: "Firma de notificación no válida." });
  }

  try {
    const payment = await fetchProviderPayment(paymentId);
    const checkoutId = String(payment?.external_reference ?? "");
    if (!UUID_PATTERN.test(checkoutId)) return sendJson(res, 200, { received: true });
    const checkout = await getCheckout(checkoutId);
    if (!checkout) return sendJson(res, 200, { received: true });
    if (payment.status === "approved") {
      const finalized = await finalizeApprovedPayment(checkout, payment);
      if (!finalized) {
        return sendJson(res, 409, { error: "No se pudo confirmar el pago." });
      }
      return sendJson(res, 200, { received: true });
    }
    return sendJson(res, 200, { received: true });
  } catch (error) {
    console.error("Mercado Pago webhook processing failed", error?.message ?? "unknown");
    return sendJson(res, 503, { error: "No se pudo procesar la notificación." });
  }
}

export async function handleMercadoPagoRequest(req, res, action) {
  if (action === "create-preference") return createPreference(req, res);
  if (action === "status") return paymentStatus(req, res);
  if (action === "webhook") return paymentWebhook(req, res);
  return sendJson(res, 404, { error: "Ruta de pago no encontrada." });
}
