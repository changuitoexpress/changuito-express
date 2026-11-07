import { fail, uuid } from "./config.js";

function dbConfig() {
  const origin = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!origin || !key) throw fail(503, "Falta la configuración de Supabase del servidor.");
  return { origin: new URL(origin).origin, key };
}
export async function db(path, options = {}) {
  const { origin, key } = dbConfig();
  const response = await fetch(origin + "/rest/v1/" + path, {
    ...options,
    headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", ...options.headers },
    signal: AbortSignal.timeout(10000),
  });
  const result = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    if (result?.code === "P0001") throw fail(409, String(result.message).slice(0, 250));
    throw fail(503, "Supabase no pudo completar la operación del CRM. Revisa la migración y la conexión.");
  }
  return result;
}
export function rpc(name, args) {
  return db("rpc/" + name, { method: "POST", body: JSON.stringify(args) });
}
export async function authenticate(req) {
  const authorization = req.headers?.authorization;
  if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) throw fail(401, "Inicia sesión para abrir el CRM.");
  const { origin } = dbConfig();
  const anon = process.env.VITE_SUPABASE_ANON_KEY;
  if (!anon) throw fail(503, "Falta configuración de autenticación.");
  const r = await fetch(origin + "/auth/v1/user", {
    headers: { apikey: anon, Authorization: authorization }, signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw fail(401, "La sesión ya no es válida.");
  const user = await r.json();
  uuid(user.id);
  const profiles = await db("perfiles?select=id,rol&id=eq." + user.id);
  const role = profiles?.[0]?.rol;
  if (!["admin", "repartidor"].includes(role)) throw fail(403, "No tienes permiso para abrir el CRM.");
  return { id: user.id, role, isAdmin: role === "admin" };
}
const CONVERSATION_SELECT = "*,contact:whatsapp_contactos(phone,display_name)";
export async function getConversation(id, actor, numberId) {
  uuid(id);
  const rows = await db("whatsapp_conversaciones?select=" + CONVERSATION_SELECT + "&id=eq." + id);
  const c = rows?.[0];
  if (!c || (numberId && c.phone_number_id !== numberId) || (!actor.isAdmin && c.assigned_to !== actor.id)) {
    throw fail(403, "Ya no tienes acceso a esta conversación.");
  }
  return c;
}
export { CONVERSATION_SELECT };
export async function storage(path, options = {}) {
  const { origin, key } = dbConfig();
  const r = await fetch(origin + "/storage/v1/" + path, {
    ...options, headers: { apikey: key, Authorization: "Bearer " + key, ...options.headers },
    signal: AbortSignal.timeout(15000),
  });
  const result = await r.json().catch(() => null);
  if (!r.ok) throw fail(503, "No se pudo guardar o abrir la fotografía privada.");
  return { result, origin };
}
export async function saveImage(path, bytes, mime) {
  await storage("object/whatsapp-crm/" + path, {
    method: "POST", headers: { "Content-Type": mime, "x-upsert": "true" }, body: bytes,
  });
}
export async function signedImage(path) {
  const { result, origin } = await storage("object/sign/whatsapp-crm/" + path, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: 60 }),
  });
  const signed = result?.signedURL ?? result?.signedUrl;
  if (!signed || !signed.startsWith("/object/sign/")) throw fail(503, "No se pudo autorizar la fotografía.");
  return origin + "/storage/v1" + signed;
}
