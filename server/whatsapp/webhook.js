import { createHash } from "node:crypto";
import { assertSafeSender, errorReply, fail, normalizePhone, parseJson, rawBody, requireTestConfig, safeEqual, sendJson, verifySignature } from "./config.js";
import { db, rpc, saveImage } from "./store.js";
import { downloadMetaImage } from "./meta.js";

function tagged(error, reason) {
  if (error && typeof error === "object") error.webhookReason = reason;
  return error;
}

function reject(status, reason, message) {
  return tagged(fail(status, message), reason);
}

function noteReason(reasons, reason) {
  if (reasons) reasons.add(reason);
}

function logReasons(reasons) {
  for (const reason of reasons) {
    console.warn("[whatsapp-webhook] rejected reason=" + reason);
  }
}

export function extractEvents(payload, config, diagnosticReasons) {
  if (payload?.object !== "whatsapp_business_account") {
    throw reject(400, "object_type", "Objeto de webhook no válido.");
  }
  const events = [];
  for (const entry of payload.entry ?? []) for (const change of entry.changes ?? []) {
    if (change.field !== "messages") continue;
    const value = change.value;
    if (String(value?.metadata?.phone_number_id) !== config.numberId) {
      throw reject(403, "phone_number_id", "Este webhook solo admite el número de prueba configurado.");
    }
    if (value.metadata.display_phone_number) {
      try {
        assertSafeSender(value.metadata.display_phone_number);
      } catch (error) {
        throw tagged(error, error.status === 403 ? "real_number_protection" : "display_phone_number");
      }
    }
    for (const m of value.messages ?? []) {
      let phone;
      try {
        phone = normalizePhone(m.from);
      } catch (error) {
        throw tagged(error, "sender_phone");
      }
      if (!config.allowed.has(phone)) {
        noteReason(diagnosticReasons, "allowlist");
        continue;
      }
      if (!m.id || String(m.id).length > 300) {
        throw reject(400, "message_id", "Mensaje sin identificador válido.");
      }
      const name = value.contacts?.find(c => c.wa_id === m.from)?.profile?.name ?? "";
      events.push({ id: "message:" + m.id, payload: { type: "message", numberId: config.numberId, phone, name, message: m } });
    }
    for (const s of value.statuses ?? []) {
      if (!["sent", "delivered", "read", "failed"].includes(s.status) || !s.id) continue;
      let recipient;
      try {
        recipient = normalizePhone(s.recipient_id);
      } catch (error) {
        throw tagged(error, "status_recipient");
      }
      if (!config.allowed.has(recipient)) {
        noteReason(diagnosticReasons, "allowlist");
        continue;
      }
      const hash = createHash("sha256").update(JSON.stringify(s)).digest("hex");
      events.push({ id: "status:" + hash, payload: { type: "status", numberId: config.numberId, status: s } });
    }
  }
  return events;
}
async function processPayload(payload, config) {
  if (payload.numberId !== config.numberId) throw fail(403, "El evento pertenece a otro canal.");
  if (payload.type === "status") {
    const s = payload.status;
    const known = await db("whatsapp_mensajes?select=id&wa_message_id=eq." + encodeURIComponent(s.id) + "&limit=1");
    // Meta may deliver a status before the send response is persisted.
    if (!known?.length) throw fail(503, "Estado pendiente de vincular con su mensaje.");
    await rpc("whatsapp_delivery_status", {
      p_wamid: s.id, p_status: s.status,
      p_error: s.status === "failed" ? "Meta no pudo entregar el mensaje (código " + String(s.errors?.[0]?.code ?? "desconocido") + ")." : null,
    });
    return;
  }
  if (!config.allowed.has(payload.phone)) throw fail(403, "Destinatario fuera de la lista de prueba.");
  const m = payload.message;
  const kind = m.type === "image" ? "image" : m.type === "text" ? "text" : "unsupported";
  const text = kind === "text" ? String(m.text?.body ?? "") : kind === "image" ? String(m.image?.caption ?? "")
    : "Mensaje recibido de tipo " + String(m.type ?? "desconocido").slice(0, 30) + ". Esta base admite texto y fotografías.";
  let time = Number(m.timestamp) * 1000;
  if (!Number.isFinite(time) || time < 1 || time > Date.now() + 300000) time = Date.now();
  const message = await rpc("whatsapp_ingest", {
    p_number: config.numberId, p_phone: payload.phone, p_name: payload.name,
    p_wamid: m.id, p_text: text, p_kind: kind, p_media: kind === "image" ? m.image?.id ?? null : null,
    p_time: new Date(time).toISOString(),
  });
  if (kind === "image" && !message.image_path) {
    try {
      const image = await downloadMetaImage(config, m.image.id);
      const path = message.conversation_id + "/" + message.id + (image.mime === "image/png" ? ".png" : ".jpg");
      await saveImage(path, image.bytes, image.mime);
      await db("whatsapp_mensajes?id=eq." + message.id, {
        method: "PATCH", body: JSON.stringify({ image_path: path, error: null }),
      });
    } catch (error) {
      await db("whatsapp_mensajes?id=eq." + message.id, {
        method: "PATCH", body: JSON.stringify({ error: "No se pudo descargar la fotografía. Pendiente de revisión o reintento." }),
      });
      throw error;
    }
  }
}
export async function processEvent(id, config) {
  const events = await db("whatsapp_webhook_events?id=eq." + encodeURIComponent(id) + "&limit=1");
  if (!events?.length) throw fail(503, "Evento pendiente de guardar.");
  if (events[0].status === "processed") return true;
  if (!(await rpc("whatsapp_claim_event", { p_id: id }))) return false;
  try {
    await processPayload(events[0].payload, config);
    await db("whatsapp_webhook_events?id=eq." + encodeURIComponent(id), {
      method: "PATCH", body: JSON.stringify({ status: "processed", lease_until: null, error: null }),
    });
    return true;
  } catch (error) {
    await db("whatsapp_webhook_events?id=eq." + encodeURIComponent(id), {
      method: "PATCH", body: JSON.stringify({ status: "failed", lease_until: null,
        error: error.status ? error.message.slice(0, 250) : "Fallo temporal de conexión." }),
    });
    throw error;
  }
}
export async function retryEvents(config) {
  // Durable, explicitly triggered retry; no promises left running after response.
  const cutoff = encodeURIComponent(new Date().toISOString());
  const events = await db("whatsapp_webhook_events?select=id&or=(status.in.(pending,failed),and(status.eq.processing,lease_until.lt." + cutoff + "))&order=created_at.asc&limit=1");
  let processed = 0, failed = 0;
  for (const event of events ?? []) {
    try { if (await processEvent(event.id, config)) processed++; } catch { failed++; }
  }
  return { processed, failed };
}
export async function handleWhatsAppWebhook(req, res) {
  const diagnosticReasons = new Set();
  try {
    const url = new URL(req.url, "https://webhook.invalid");
    if (req.method === "GET") {
      if (process.env.WHATSAPP_MODE !== "test" || !process.env.WHATSAPP_VERIFY_TOKEN) {
        throw fail(503, "La verificación del número de prueba aún no está configurada.");
      }
      if (url.searchParams.get("hub.mode") !== "subscribe" ||
          !safeEqual(url.searchParams.get("hub.verify_token"), process.env.WHATSAPP_VERIFY_TOKEN)) {
        throw fail(403, "Verificación rechazada.");
      }
      const challenge = url.searchParams.get("hub.challenge");
      if (!challenge || challenge.length > 200) throw fail(400, "Challenge no válido.");
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.end(challenge);
      return;
    }
    if (req.method !== "POST") throw fail(405, "Método no permitido.");
    let raw;
    try {
      raw = await rawBody(req, 1024 * 1024);
    } catch (error) {
      throw tagged(error, "request_body");
    }
    if (!verifySignature(raw, req.headers?.["x-hub-signature-256"])) {
      throw reject(401, "signature", "Firma de Meta no válida.");
    }
    let config;
    try {
      config = requireTestConfig();
    } catch (error) {
      throw tagged(error, "test_configuration");
    }
    let payload;
    try {
      payload = parseJson(raw);
    } catch (error) {
      throw tagged(error, "invalid_json");
    }
    const events = extractEvents(payload, config, diagnosticReasons);
    if (events.length > 100) throw reject(413, "batch_size", "Lote de eventos demasiado grande.");
    if (events.length) await db("whatsapp_webhook_events?on_conflict=id", {
      method: "POST", headers: { Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify(events),
    });
    // Process one event per request to keep image handling within serverless limits.
    // Meta retries 503 and all events remain durably queued; admin can also retry.
    const filter = "(" + events.map(e => '"' + e.id.replace(/["\\]/g, "") + '"').join(",") + ")";
    const saved = events.length ? await db("whatsapp_webhook_events?select=id,status&id=in." + encodeURIComponent(filter)) : [];
    const pending = saved.filter(e => e.status !== "processed");
    if (pending.length && !(await processEvent(pending[0].id, config))) throw fail(503, "Evento en proceso; reintento pendiente.");
    if (pending.length > 1) throw fail(503, "Lote guardado. Faltan eventos por procesar; se requiere reintento.");
    logReasons(diagnosticReasons);
    sendJson(res, 200, { ok: true });
  } catch (error) {
    if (req.method === "POST") {
      diagnosticReasons.add(error.webhookReason || "processing");
      logReasons(diagnosticReasons);
    }
    errorReply(res, error);
  }
}
