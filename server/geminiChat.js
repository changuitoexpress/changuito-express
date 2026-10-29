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
  const merchantIds = new Set(validatedItems.map(function (item) {
    return item.product.merchantId;
  }));
  if (merchantIds.size > 1) {
    return {
      reply: "Puedo ayudarte con un negocio a la vez para calcular bien el envío. ¿De cuál negocio quieres hacer el pedido?",
      items: [],
    };
  }

  return {
    reply:
      typeof modelResult?.reply === "string"
        ? modelResult.reply.trim().slice(0, 700)
        : "Encontré algunas opciones. Revisa la propuesta y dime si quieres cambiar algo.",
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
    "Usa exclusivamente productos e IDs de CATALOGO. No inventes nombres, precios, disponibilidad ni negocios.",
    "No escribas precios en tu texto: la aplicación los calcula con el catálogo real.",
    "Devuelve en items la propuesta COMPLETA del pedido, no solo los cambios. Conserva el borrador salvo que el cliente lo quite, cancele o corrija.",
    "Si el pedido es ambiguo, no agregues un producto por suposición: explica qué falta y devuelve items vacío o conserva el borrador existente.",
    "No agregues nada al carrito ni confirmes la compra. La aplicación espera confirmación explícita del cliente.",
    "Un carrito solo puede incluir productos de un negocio. Si el pedido mezcla negocios, pregunta cuál prefiere y devuelve items vacío.",
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
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=" +
        encodeURIComponent(apiKey),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(25_000),
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
  } catch {
    return sendJson(res, 504, {
      error: "ChanguiBot tardó demasiado. Intenta enviar tu pedido otra vez.",
    });
  }

  if (!response.ok) {
    // Do not include provider payloads or credentials in application logs/responses.
    console.error("Gemini API request failed with status", response.status);
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
