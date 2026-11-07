import { createHmac, timingSafeEqual } from "node:crypto";

export const MAX_PHOTO = 2 * 1024 * 1024;
export const MAX_INBOUND_PHOTO = 5 * 1024 * 1024;
export function fail(status, message) {
  return Object.assign(new Error(message), { status });
}
export function normalizePhone(value) {
  const phone = String(value ?? "").replace(/[\s()+-]/g, "");
  if (!/^[1-9]\d{6,14}$/.test(phone)) throw fail(400, "Número internacional no válido.");
  return phone;
}
export function uuid(value) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value))) {
    throw fail(400, "Identificador no válido.");
  }
  return value;
}
export function configStatus() {
  const keys = ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_APP_SECRET", "WHATSAPP_VERIFY_TOKEN",
    "WHATSAPP_TEST_PHONE_NUMBER_ID", "WHATSAPP_ALLOWED_RECIPIENTS"];
  const missing = keys.filter(key => !process.env[key]?.trim());
  if (process.env.WHATSAPP_MODE !== "test") missing.push("WHATSAPP_MODE=test");
  return { configured: missing.length === 0, missing, mode: "test", channelLabel: "Meta · número de prueba", pendingEvents: 0 };
}
export function requireTestConfig() {
  const status = configStatus();
  if (!status.configured) throw fail(503, "WhatsApp de prueba no está configurado. Faltan: " + status.missing.join(", "));
  const numberId = process.env.WHATSAPP_TEST_PHONE_NUMBER_ID.trim();
  if (!/^\d{5,30}$/.test(numberId)) throw fail(503, "El identificador del número de prueba no es válido.");
  const version = process.env.WHATSAPP_GRAPH_VERSION || "v27.0";
  if (!/^v\d{1,2}\.0$/.test(version)) throw fail(503, "Versión de Graph API no válida.");
  const allowed = new Set(process.env.WHATSAPP_ALLOWED_RECIPIENTS.split(",").map(normalizePhone));
  return { numberId, version, allowed, token: process.env.WHATSAPP_ACCESS_TOKEN };
}
export function assertSafeSender(displayNumber) {
  // This phase must never use the existing business cellphone number.
  const phone = normalizePhone(displayNumber);
  if (["2223339999", "522223339999", "5212223339999"].includes(phone)) {
    throw fail(403, "El número real está protegido. Solo se permite el número de prueba de Meta.");
  }
}
export function verifySignature(raw, signature) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !/^sha256=[a-f0-9]{64}$/.test(signature ?? "")) return false;
  const expected = createHmac("sha256", secret).update(raw).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"));
}
export function safeEqual(a, b) {
  if (!a || !b) return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(body));
}
export async function rawBody(req, max = 3 * 1024 * 1024) {
  // The deployed webhook disables bodyParser: signatures MUST cover original bytes.
  if (req.body !== undefined) {
    if (!Buffer.isBuffer(req.body) && typeof req.body !== "string") {
      throw fail(400, "Se requiere el cuerpo original de la solicitud.");
    }
    const bytes = Buffer.from(req.body);
    if (bytes.length > max) throw fail(413, "Solicitud demasiado grande.");
    return bytes;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > max) throw fail(413, "Solicitud demasiado grande.");
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}
export function parseJson(raw) {
  try { return JSON.parse(raw.toString("utf8")); }
  catch { throw fail(400, "JSON no válido."); }
}
export function errorReply(res, error) {
  // Provider/database errors never expose URLs, credentials or raw payloads.
  sendJson(res, error.status || 503, { error: error.status ? error.message : "El CRM no pudo completar la operación. Intenta actualizar." });
}
