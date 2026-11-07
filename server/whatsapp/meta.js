import { assertSafeSender, fail, MAX_INBOUND_PHOTO } from "./config.js";

export async function graph(config, path, options = {}) {
  const r = await fetch("https://graph.facebook.com/" + config.version + "/" + path, {
    ...options, headers: { Authorization: "Bearer " + config.token, ...options.headers },
    signal: AbortSignal.timeout(15000),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    // Do not echo Meta's error text; it may include submitted content.
    const code = data?.error?.code;
    throw Object.assign(fail(502, code === 190
      ? "El token de prueba de Meta venció o no es válido."
      : "Meta rechazó la solicitud" + (Number.isInteger(code) ? " (código " + code + ")" : "") + "."),
    { providerRejected: true });
  }
  return data;
}
export async function verifyTestSender(config) {
  const sender = await graph(config, config.numberId + "?fields=display_phone_number");
  if (!sender?.display_phone_number) throw fail(503, "No se pudo verificar el número emisor de prueba.");
  assertSafeSender(sender.display_phone_number);
}
export async function uploadToMeta(config, bytes, mime, name) {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", mime);
  form.append("file", new Blob([bytes], { type: mime }), name);
  const data = await graph(config, config.numberId + "/media", { method: "POST", body: form });
  if (!data?.id) throw fail(502, "Meta no devolvió el identificador de la foto.");
  return data.id;
}
export async function sendToMeta(config, phone, text, mediaId) {
  const data = await graph(config, config.numberId + "/messages", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp", recipient_type: "individual", to: phone,
      type: mediaId ? "image" : "text",
      ...(mediaId ? { image: { id: mediaId, ...(text ? { caption: text } : {}) } } : { text: { body: text } }),
    }),
  });
  if (!data?.messages?.[0]?.id) throw fail(502, "Meta no confirmó la aceptación del mensaje. No lo reenvíes automáticamente.");
  return data.messages[0].id;
}
export async function downloadMetaImage(config, mediaId) {
  if (!/^[0-9]{1,40}$/.test(String(mediaId))) throw fail(400, "Identificador de fotografía no válido.");
  const media = await graph(config, encodeURIComponent(mediaId) + "?phone_number_id=" + config.numberId);
  if (!["image/jpeg", "image/png"].includes(media?.mime_type)) throw fail(415, "El formato recibido no es JPEG o PNG.");
  if (Number(media.file_size) > MAX_INBOUND_PHOTO) throw fail(413, "La foto supera los 5 MB.");
  const url = new URL(media.url);
  if (url.protocol !== "https:" || !["facebook.com", "fbcdn.net", "fbsbx.com"].some(d => url.hostname === d || url.hostname.endsWith("." + d))) {
    throw fail(502, "Meta devolvió una dirección de fotografía no autorizada.");
  }
  const r = await fetch(url, { headers: { Authorization: "Bearer " + config.token },
    redirect: "error", signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw fail(502, "No se pudo descargar la foto de Meta.");
  if (Number(r.headers.get("content-length")) > MAX_INBOUND_PHOTO) throw fail(413, "Foto demasiado grande.");
  const chunks = [];
  let size = 0;
  for await (const chunk of r.body) {
    size += chunk.byteLength;
    if (size > MAX_INBOUND_PHOTO) throw fail(413, "Foto demasiado grande.");
    chunks.push(Buffer.from(chunk));
  }
  return { bytes: Buffer.concat(chunks), mime: media.mime_type };
}
