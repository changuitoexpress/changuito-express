import { configStatus, errorReply, fail, MAX_PHOTO, parseJson, rawBody, requireTestConfig, sendJson, uuid } from "./config.js";
import { authenticate, CONVERSATION_SELECT, db, getConversation, rpc, saveImage, signedImage } from "./store.js";
import { sendToMeta, uploadToMeta, verifyTestSender } from "./meta.js";
import { retryEvents } from "./webhook.js";

const limiter = new Map();
function limit(actor) {
  const now = Date.now();
  const state = limiter.get(actor.id);
  if (!state || now - state.start > 60000) {
    limiter.set(actor.id, { start: now, count: 1 });
    if (limiter.size > 2000) for (const [key, s] of limiter) if (now - s.start > 60000) limiter.delete(key);
  } else if (++state.count > 30) throw fail(429, "Demasiadas operaciones. Espera un momento.");
}
function photoInput(image) {
  if (!image) return null;
  if (!["image/jpeg", "image/png"].includes(image.mime) || typeof image.base64 !== "string" ||
      image.base64.length > Math.ceil(MAX_PHOTO / 3) * 4 || !/^[a-zA-Z0-9+/]*={0,2}$/.test(image.base64)) {
    throw fail(400, "Sube una foto JPEG o PNG de hasta 2 MB.");
  }
  const bytes = Buffer.from(image.base64, "base64");
  if (!bytes.length || bytes.length > MAX_PHOTO) throw fail(413, "Sube una foto de hasta 2 MB.");
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if ((image.mime === "image/png" && !png) || (image.mime === "image/jpeg" && !jpeg)) {
    throw fail(400, "El contenido de la foto no coincide con su formato.");
  }
  return { bytes, mime: image.mime, name: image.mime === "image/png" ? "compra.png" : "compra.jpg" };
}
async function sendMessage(body, actor) {
  const config = requireTestConfig();
  const conversation = await getConversation(body.id, actor, config.numberId);
  if (!config.allowed.has(conversation.contact.phone)) throw fail(403, "El destinatario no está autorizado para esta prueba.");
  const nonce = uuid(body.nonce);
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const photo = photoInput(body.image);
  if (text.length > 4096 || (photo && text.length > 1024)) throw fail(400, photo ? "La descripción de la foto admite hasta 1024 caracteres." : "El mensaje admite hasta 4096 caracteres.");
  if (!text && !photo) throw fail(400, "Escribe un mensaje o selecciona una foto.");
  // Verify sender metadata on every outbound operation; never register/migrate numbers.
  await verifyTestSender(config);
  const reserved = await rpc("whatsapp_reserve_send", {
    p_id: conversation.id, p_actor: actor.id, p_nonce: nonce, p_text: text, p_kind: photo ? "image" : "text",
  });
  if (reserved.existing) return { message: reserved.message };
  const message = reserved.message;
  let imagePath = null, posting = false, wamid = null;
  try {
    let mediaId = null;
    if (photo) {
      imagePath = conversation.id + "/" + message.id + (photo.mime === "image/png" ? ".png" : ".jpg");
      await saveImage(imagePath, photo.bytes, photo.mime);
      mediaId = await uploadToMeta(config, photo.bytes, photo.mime, photo.name);
    }
    posting = true;
    wamid = await sendToMeta(config, conversation.contact.phone, text, mediaId);
    const saved = await rpc("whatsapp_finish_send", {
      p_message: message.id, p_status: "sent", p_wamid: wamid, p_error: null, p_image: imagePath,
    });
    return { message: saved };
  } catch (error) {
    const uncertain = posting && !error.providerRejected;
    const explanation = uncertain ? "Envío sin confirmación. Puede haber llegado; no lo reenvíes automáticamente."
      : error.status ? error.message : "No se pudo preparar el envío.";
    await rpc("whatsapp_finish_send", {
      p_message: message.id, p_status: uncertain ? "unknown" : "failed",
      p_wamid: wamid, p_error: explanation, p_image: imagePath,
    }).catch(() => {});
    throw fail(uncertain ? 504 : (error.status || 503), explanation);
  }
}
export async function handleWhatsAppCrm(req, res) {
  try {
    if (!["GET", "POST"].includes(req.method)) throw fail(405, "Método no permitido.");
    const actor = await authenticate(req);
    const url = new URL(req.url, "https://crm.invalid");
    const action = url.searchParams.get("action");
    const numberId = process.env.WHATSAPP_TEST_PHONE_NUMBER_ID?.trim();
    if (req.method === "GET" && action === "list") {
      // Recover sends interrupted by a serverless termination without resending.
      await rpc("whatsapp_expire_sends", {});
      const archived = url.searchParams.get("archived") === "true";
      const query = "whatsapp_conversaciones?select=" + CONVERSATION_SELECT + "&status=eq." +
        (archived ? "archivada" : "abierta") + (numberId ? "&phone_number_id=eq." + encodeURIComponent(numberId) : "&id=is.null") +
        (!actor.isAdmin ? "&assigned_to=eq." + actor.id : "") + "&order=last_message_at.desc&limit=100";
      const conversations = await db(query);
      const couriers = actor.isAdmin ? await db("perfiles?select=id,nombre&rol=eq.repartidor&order=nombre.asc") : [];
      const status = configStatus();
      if (actor.isAdmin) {
        const pending = await db("whatsapp_webhook_events?select=id&status=neq.processed&limit=1000");
        status.pendingEvents = pending.length;
      } else status.missing = status.configured ? [] : ["Configuración pendiente del administrador"];
      sendJson(res, 200, { conversations, couriers, config: status });
      return;
    }
    if (req.method === "GET" && action === "detail") {
      const id = url.searchParams.get("id");
      const conversation = await getConversation(id, actor, numberId || "unconfigured");
      let cursor = "";
      const before = url.searchParams.get("before");
      if (before) {
        const [time, messageId] = before.split("|");
        uuid(messageId);
        if (!time || !Number.isFinite(Date.parse(time))) throw fail(400, "Cursor no válido.");
        const iso = encodeURIComponent(new Date(time).toISOString());
        cursor = "&or=(created_at.lt." + iso + ",and(created_at.eq." + iso + ",id.lt." + messageId + "))";
      }
      const messages = await db("whatsapp_mensajes?conversation_id=eq." + id + cursor + "&order=created_at.desc,id.desc&limit=100");
      const assignments = await db("whatsapp_asignaciones?conversation_id=eq." + id + "&order=created_at.desc&limit=100");
      // Recheck scope after queries to avoid returning data from a just-reassigned case.
      await getConversation(id, actor, numberId || "unconfigured");
      const oldest = messages[messages.length - 1];
      sendJson(res, 200, { conversation, messages: messages.reverse(), assignments,
        nextBefore: messages.length === 100 ? oldest.created_at + "|" + oldest.id : null });
      return;
    }
    if (req.method === "GET" && action === "media") {
      const id = uuid(url.searchParams.get("id"));
      const rows = await db("whatsapp_mensajes?select=id,conversation_id,image_path&id=eq." + id);
      const m = rows?.[0];
      if (!m) throw fail(404, "Foto no encontrada.");
      await getConversation(m.conversation_id, actor, numberId || "unconfigured");
      if (!m.image_path?.startsWith(m.conversation_id + "/" + m.id + ".")) throw fail(404, "Fotografía todavía no disponible.");
      const imageUrl = await signedImage(m.image_path);
      await getConversation(m.conversation_id, actor, numberId || "unconfigured");
      sendJson(res, 200, { url: imageUrl });
      return;
    }
    if (req.method !== "POST") throw fail(404, "Acción no encontrada.");
    limit(actor);
    const body = parseJson(await rawBody(req));
    if (action === "send") {
      sendJson(res, 200, await sendMessage(body, actor));
      return;
    }
    if (!actor.isAdmin) throw fail(403, "Solo el administrador puede asignar, archivar o reintentar eventos.");
    if (["assign", "archive"].includes(action)) {
      await getConversation(body.id, actor, numberId || "unconfigured");
      const result = await rpc("whatsapp_change_case", {
        p_id: uuid(body.id), p_actor: actor.id, p_action: action,
        p_courier: action === "assign" && body.courierId ? uuid(body.courierId) : null,
      });
      sendJson(res, 200, result);
    } else if (action === "retry") {
      sendJson(res, 200, await retryEvents(requireTestConfig()));
    } else throw fail(404, "Acción no encontrada.");
  } catch (error) { errorReply(res, error); }
}
