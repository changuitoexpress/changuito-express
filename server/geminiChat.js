const MAX_BODY_BYTES = 140_000;
const MAX_CATALOG_ITEMS = 650;
const MAX_REQUESTS_PER_WINDOW = 18;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const rateLimits = new Map();

function sendJson(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function getClientIp(req) {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim().slice(0, 80);
  }
  return String(req.socket?.remoteAddress ?? "unknown").slice(0, 80);
}

function isRateLimited(req) {
  const now = Date.now();
  const ip = getClientIp(req);
  const previous = rateLimits.get(ip);
  if (!previous || now - previous.startedAt >= RATE_WINDOW_MS) {
    rateLimits.set(ip, { startedAt: now, count: 1 });
    if (rateLimits.size > 2000) {
      for (const [key, value] of rateLimits) {
        if (now - value.startedAt >= RATE_WINDOW_MS) rateLimits.delete(key);
      }
    }
    return false;
  }
  previous.count += 1;
  return previous.count > MAX_REQUESTS_PER_WINDOW;
}

async function readRequestBody(req) {
  if (req.body !== undefined) {
    const body =
      typeof req.body === "string" || Buffer.isBuffer(req.body)
        ? req.body.toString()
        : JSON.stringify(req.body);
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) throw new Error("body-too-large");
    return typeof req.body === "object" && !Buffer.isBuffer(req.body)
      ? req.body
      : JSON.parse(body);
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("body-too-large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sanitizeCatalog(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, MAX_CATALOG_ITEMS).flatMap(function (item) {
    if (!item || typeof item !== "object") return [];
    const id = String(item.id ?? "").slice(0, 80);
    const name = String(item.name ?? "").trim().slice(0, 120);
    const merchantId = String(item.merchantId ?? "").slice(0, 80);
    const merchantName = String(item.merchantName ?? "").trim().slice(0, 100);
    const price = Number(item.price);
    if (!id || !name || !merchantId || !Number.isFinite(price) || price < 0) {
      return [];
    }
    return [{ id, name, merchantId, merchantName, price }];
  });
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-8).flatMap(function (entry) {
    if (!entry || (entry.role !== "user" && entry.role !== "bot")) return [];
    const text = String(entry.text ?? "").trim().slice(0, 700);
    return text ? [{ role: entry.role, text }] : [];
  });
}

function ocultarIdentificadores(text, catalog) {
  let safeText = text;
  const byId = new Map();
  for (const product of catalog) {
    byId.set(product.id, product.name);
    byId.set(product.merchantId, product.merchantName);
  }
  for (const [id, label] of Array.from(byId.entries()).sort(function (a, b) {
    return b[0].length - a[0].length;
  })) {
    if (!id) continue;
    const token = new RegExp(
      "(^|[^a-z0-9_])" + id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?=$|[^a-z0-9_])",
      "gi",
    );
    safeText = safeText.replace(token, function (_match, prefix) {
      return prefix + label;
    });
  }
  return safeText;
}

function validateModelResult(modelResult, catalog) {
  const productsById = new Map(catalog.map(function (product) {
    return [product.id, product];
  }));
  const combined = new Map();
  const rawItems = Array.isArray(modelResult?.items)
    ? modelResult.items.slice(0, 20)
    : [];

  for (const item of rawItems) {
    const productId = String(item?.productId ?? "");
    const quantity = Number(item?.quantity);
    if (!productsById.has(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      continue;
    }
    combined.set(productId, Math.min(20, (combined.get(productId) ?? 0) + quantity));
  }

  const validatedItems = Array.from(combined.entries()).map(function ([id, quantity]) {
    return { id, quantity, product: productsById.get(id) };
  });
  let reply = ocultarIdentificadores(
    typeof modelResult?.reply === "string"
      ? modelResult.reply.trim().slice(0, 700)
      : "Revisa la propuesta y dime si quieres cambiar algo.",
    catalog,
  );
  if (rawItems.length > 0 && validatedItems.length === 0) {
    reply = "No pude asociar esa propuesta con productos disponibles. Dime el negocio y el producto para revisarlo.";
  } else if (
    /\$\s*\d|\d[\d.,]*\s*(?:pesos|mxn)|pedido confirmado|(?:agregu[eé]|a[nñ]ad[ií]).*carrito/i.test(reply)
  ) {
    reply = validatedItems.length > 0
      ? "Preparé esta propuesta. Revisa las cantidades y los precios del catálogo antes de confirmar."
      : "Puedo orientarte con productos del catálogo. Dime qué negocio y producto prefieres.";
  }
  return {
    reply,
    items: validatedItems.map(function (item) {
      return { id: item.id, quantity: item.quantity };
    }),
  };
}

export async function handleGeminiChatRequest(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Método no permitido." });
  }
  if (!String(req.headers?.["content-type"] ?? "").startsWith("application/json")) {
    return sendJson(res, 415, { error: "Usa una solicitud JSON." });
  }
  const authorization = req.headers?.authorization;
  if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) {
    return sendJson(res, 401, { error: "Vuelve a entrar a la app para usar ChanguiBot." });
  }
  if (isRateLimited(req)) {
    return sendJson(res, 429, {
      error: "Llegaste al límite de mensajes por ahora. Espera unos minutos y vuelve a intentarlo.",
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return sendJson(res, 503, {
      error: "El asistente no está configurado por el momento.",
    });
  }
  try {
    const supabaseOrigin = new URL(process.env.VITE_SUPABASE_URL).origin;
    const verification = await fetch(supabaseOrigin + "/auth/v1/user", {
      headers: {
        apikey: process.env.VITE_SUPABASE_ANON_KEY ?? "",
        Authorization: authorization,
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!verification.ok) {
      return sendJson(res, 401, {
        error: "Tu sesión no está disponible. Vuelve a entrar para usar ChanguiBot.",
      });
    }
    const user = await verification.json();
    if (typeof user?.id !== "string" || !user.id) {
      return sendJson(res, 401, { error: "No pude verificar tu sesión." });
    }
  } catch {
    return sendJson(res, 503, {
      error: "No pude verificar tu sesión por ahora. Intenta de nuevo.",
    });
  }

  let body;
  try {
    body = await readRequestBody(req);
  } catch (error) {
    const tooLarge = error?.message === "body-too-large";
    return sendJson(res, tooLarge ? 413 : 400, {
      error: tooLarge ? "La solicitud es demasiado grande." : "No pudimos leer el mensaje.",
    });
  }

  const message = String(body?.message ?? "").trim().slice(0, 900);
  const catalog = sanitizeCatalog(body?.catalog);
  const history = sanitizeHistory(body?.history);
  const draft = Array.isArray(body?.draft)
    ? body.draft.slice(0, 20).map(function (item) {
        return {
          productId: String(item?.productId ?? "").slice(0, 80),
          quantity: Math.min(20, Math.max(1, Number(item?.quantity) || 1)),
        };
      })
    : [];

  if (!message) return sendJson(res, 400, { error: "Escribe o dicta tu pedido." });
  if (catalog.length === 0) {
    return sendJson(res, 409, {
      error: "No pude cargar el catálogo. Intenta cerrar y abrir ChanguiBot de nuevo.",
    });
  }

  const prompt = [
    "Eres ChanguiBot, asistente de pedidos de Changuito Express en México.",
    "Habla español mexicano, de forma amable, clara y breve.",
    "Debes orientar, identificar productos y ayudar a preparar una propuesta.",
    "Selecciona productos exclusivamente por su ID interno del CATALOGO. No inventes nombres, precios, disponibilidad ni negocios.",
    "Los IDs son secretos internos de la integración: jamás los muestres, pronuncies ni escribas en reply. Usa nombres comerciales en el texto; conserva IDs solo en el campo estructurado productId.",
    "No escribas precios en tu texto: la aplicación los calcula con el catálogo real.",
    "Mantén reply en una o dos frases cortas, como una persona atendiendo por chat. La propuesta completa ya aparece en pantalla: no repitas toda la lista del pedido ni vuelvas a resumirla al final.",
    "Cuando el cliente esté ajustando el pedido, responde solo al cambio o haz una pregunta concreta. No cierres la conversación mientras el cliente pueda querer agregar o cambiar algo.",
    "Devuelve en items la propuesta COMPLETA del pedido, no solo los cambios. Conserva el borrador salvo que el cliente lo quite, cancele o corrija.",
    "Si el pedido es ambiguo, no agregues un producto por suposición: explica qué falta y devuelve items vacío o conserva el borrador existente.",
    "No agregues nada al carrito ni confirmes la compra. La aplicación espera confirmación explícita del cliente.",
    "Puedes preparar una sola propuesta con productos de varios negocios y la aplicación los organizará por negocio dentro del mismo carrito.",
    "Incluye todos los negocios que el cliente haya mencionado con claridad. No excluyas artículos solo porque provienen de negocios distintos.",
    "Si hay productos repetidos con el mismo nombre en diferentes negocios y el cliente no especificó cuál, pregunta por el negocio antes de agregar ese producto. No adivines.",
    "En reply usa nombres comerciales solo cuando ayuden a aclarar; nunca enumeres IDs, JSON ni códigos internos.",
    "Si el mensaje pide algo que no existe en el catálogo, dilo con claridad y sugiere opciones reales del mismo negocio cuando las haya.",
    "No pidas ni repitas datos sensibles, direcciones, contraseñas ni números de tarjeta.",
    "",
    "CATALOGO:",
    JSON.stringify(catalog),
    "",
    "HISTORIAL RECIENTE:",
    JSON.stringify(history),
    "",
    "BORRADOR ACTUAL (IDs y cantidades):",
    JSON.stringify(draft),
    "",
    "MENSAJE NUEVO DEL CLIENTE:",
    message,
  ].join("\n");

  let response;
  try {
    response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        signal: AbortSignal.timeout(40_000),
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: "Interpreta pedidos con cuidado y devuelve solo el JSON solicitado." }],
          },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 900,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                reply: { type: "STRING" },
                items: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      productId: { type: "STRING" },
                      quantity: { type: "INTEGER" },
                    },
                    required: ["productId", "quantity"],
                  },
                },
              },
              required: ["reply", "items"],
            },
          },
        }),
      },
    );
  } catch (error) {
    console.error("Gemini request connection error", error?.name ?? "UnknownError");
    return sendJson(res, 504, {
      error: "ChanguiBot tardó demasiado. Intenta enviar tu pedido otra vez.",
    });
  }

  if (!response.ok) {
    let providerStatus = "UNKNOWN";
    let providerMessage = "";
    try {
      const details = await response.json();
      providerStatus = String(details?.error?.status ?? "UNKNOWN");
      providerMessage = String(details?.error?.message ?? "")
        .replaceAll(apiKey, "[redacted]")
        .slice(0, 280);
    } catch {}
    console.error("Gemini API request failed", response.status, providerStatus, providerMessage);
    return sendJson(
      res,
      response.status === 429 ? 429 : 502,
      {
        error:
          response.status === 429
            ? "ChanguiBot llegó a su límite temporal. Intenta de nuevo en un momento."
            : "No pude consultar a ChanguiBot. Intenta de nuevo.",
      },
    );
  }

  let result;
  try {
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts
      ?.map(function (part) { return part.text ?? ""; })
      .join("")
      .trim();
    result = validateModelResult(JSON.parse(text), catalog);
  } catch {
    return sendJson(res, 502, {
      error: "No pude entender la respuesta del asistente. Intenta otra vez.",
    });
  }

  return sendJson(res, 200, result);
}
