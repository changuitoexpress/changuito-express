import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { handleWhatsAppWebhook } from "../server/whatsapp/webhook.js";
import { handleWhatsAppCrm } from "../server/whatsapp/crm.js";
import { assertSafeSender, verifySignature } from "../server/whatsapp/config.js";

const ids = {
  admin: "10000000-0000-4000-8000-000000000001",
  courier: "10000000-0000-4000-8000-000000000002",
  other: "10000000-0000-4000-8000-000000000003",
  conversation: "20000000-0000-4000-8000-000000000001",
  message: "30000000-0000-4000-8000-000000000001",
  nonce: "40000000-0000-4000-8000-000000000001",
};
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=", "base64");
function harness(t, overrides = {}) {
  const savedFetch = global.fetch;
  const env = {
    VITE_SUPABASE_URL: "https://fixture.supabase.co",
    VITE_SUPABASE_ANON_KEY: "fixture-anon", SUPABASE_SERVICE_ROLE_KEY: "fixture-service",
    WHATSAPP_ACCESS_TOKEN: "fixture-meta-token", WHATSAPP_APP_SECRET: "fixture-meta-signature",
    WHATSAPP_VERIFY_TOKEN: "fixture-verify", WHATSAPP_MODE: "test",
    WHATSAPP_TEST_PHONE_NUMBER_ID: "123456789012345", WHATSAPP_ALLOWED_RECIPIENTS: "15555550123",
  };
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  t.after(() => {
    global.fetch = savedFetch;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  const state = {
    role: "admin", user: ids.admin, calls: [], events: new Map(), messages: [], sends: 0, ingests: 0,
    photoFail: false, claimBusy: false, nonceSaved: null, sender: "+1 555 555 0000",
    conversation: { id: ids.conversation, phone_number_id: env.WHATSAPP_TEST_PHONE_NUMBER_ID,
      contact: { phone: "15555550123", display_name: "Cliente de prueba" },
      status: "abierta", assigned_to: ids.courier, last_inbound_at: new Date().toISOString(),
      last_message_at: new Date().toISOString() },
    ...overrides,
  };
  const json = (x, status = 200) => new Response(JSON.stringify(x), { status, headers: { "Content-Type": "application/json" } });
  global.fetch = async function (input, options = {}) {
    const url = new URL(input);
    const body = typeof options.body === "string" ? JSON.parse(options.body) : options.body;
    const method = options.method || "GET";
    state.calls.push({ host: url.hostname, path: url.pathname, method, body, search: url.searchParams });
    if (url.hostname === "graph.facebook.com") {
      if (url.pathname.endsWith("/messages")) {
        state.sends++;
        if (state.sendError) throw new Error("network-timeout");
        return json({ messages: [{ id: "wamid.outgoing" }] });
      }
      if (url.pathname.endsWith("/media")) return json({ id: "987654321" });
      if (url.pathname.endsWith("/987654321")) return json({
        url: state.mediaUrl ?? "https://lookaside.fbsbx.com/photo",
        mime_type: "image/png", file_size: png.length,
      });
      return json({ display_phone_number: state.sender });
    }
    if (url.hostname === "lookaside.fbsbx.com") {
      if (state.photoFail) throw new Error("image-download-timeout");
      return new Response(png, { headers: { "Content-Type": "image/png" } });
    }
    assert.equal(url.hostname, "fixture.supabase.co", "No unexpected network destination");
    if (url.pathname === "/auth/v1/user") {
      if (state.expired) return json({}, 401);
      return json({ id: state.user });
    }
    if (url.pathname.includes("/storage/v1/")) {
      if (url.pathname.includes("/object/sign/")) return json({ signedURL: "/object/sign/whatsapp-crm/" + ids.conversation + "/photo.png?token=fixture" });
      return json({ Key: "fixture" });
    }
    const table = url.pathname.split("/").pop();
    if (url.pathname.includes("/rpc/")) {
      if (table === "whatsapp_expire_sends") return json(null);
      if (table === "whatsapp_ingest") {
        state.ingests++;
        const existing = state.messages.find(m => m.wa_message_id === body.p_wamid);
        if (existing) return json(existing);
        const message = { id: ids.message, conversation_id: ids.conversation, body: body.p_text,
          direction: "in", status: "received", kind: body.p_kind, wa_message_id: body.p_wamid, image_path: null };
        state.messages.push(message);
        return json(message);
      }
      if (table === "whatsapp_claim_event") {
        if (state.claimBusy) return json(false);
        state.events.get(body.p_id).status = "processing";
        return json(true);
      }
      if (table === "whatsapp_reserve_send") {
        if (state.expiredWindow) return json({ code: "P0001", message: "La ventana de 24 horas terminó" }, 400);
        if (state.nonceSaved) return json({ existing: true, message: state.nonceSaved });
        const m = { id: ids.message, conversation_id: ids.conversation, body: body.p_text,
          kind: body.p_kind, direction: "out", actor_id: body.p_actor, status: "sending" };
        state.messages.push(m);
        state.nonceSaved = m;
        return json({ existing: false, message: m });
      }
      if (table === "whatsapp_finish_send") {
        const m = state.messages.find(m => m.id === body.p_message);
        Object.assign(m, { status: body.p_status, wa_message_id: body.p_wamid, image_path: body.p_image, error: body.p_error });
        return json(m);
      }
      if (table === "whatsapp_change_case") {
        if (body.p_action === "assign") state.conversation.assigned_to = body.p_courier;
        else state.conversation.status = "archivada";
        return json({ ok: true });
      }
      if (table === "whatsapp_delivery_status") { state.delivery = body; return json(null); }
      throw new Error("Unhandled fixture RPC " + table);
    }
    if (table === "perfiles") {
      return json(url.searchParams.has("rol") ? [{ id: ids.courier, nombre: "Repartidor de prueba" }] : [{ id: state.user, rol: state.role }]);
    }
    if (table === "whatsapp_conversaciones") return json([state.conversation]);
    if (table === "whatsapp_asignaciones") return json([]);
    if (table === "whatsapp_mensajes") {
      const id = url.searchParams.get("id")?.replace("eq.", "");
      if (method === "PATCH") { Object.assign(state.messages.find(m => m.id === id), body); return json(null); }
      const wamid = url.searchParams.get("wa_message_id")?.replace("eq.", "");
      return json(state.messages.filter(m => (!id || m.id === id) && (!wamid || m.wa_message_id === wamid)));
    }
    if (table === "whatsapp_webhook_events") {
      if (method === "POST") {
        for (const event of body) if (!state.events.has(event.id)) state.events.set(event.id, { ...event, status: "pending" });
        return json(null);
      }
      const filter = url.searchParams.get("id");
      if (method === "PATCH") { Object.assign(state.events.get(filter.slice(3)), body); return json(null); }
      let events = [...state.events.values()];
      if (filter?.startsWith("eq.")) events = events.filter(e => e.id === filter.slice(3));
      if (url.searchParams.has("or")) events = events.filter(e => e.status !== "processed").slice(0, 1);
      return json(events);
    }
    throw new Error("Unhandled fixture table " + table);
  };
  return state;
}
async function invoke(handler, { method = "POST", url = "/", body, headers = {} } = {}) {
  let raw = "";
  const res = { statusCode: 200, setHeader() {}, end(text) { raw = text; } };
  await handler({ method, url, headers, ...(body === undefined ? {} : { body }) }, res);
  let parsed; try { parsed = JSON.parse(raw); } catch { parsed = raw; }
  return { status: res.statusCode, body: parsed };
}
function webhookPayload(type = "text") {
  return { object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: {
    metadata: { phone_number_id: "123456789012345", display_phone_number: "+1 555 555 0000" },
    contacts: [{ wa_id: "15555550123", profile: { name: "Cliente de prueba" } }],
    messages: [{ id: "wamid.inbound", from: "15555550123", timestamp: String(Math.floor(Date.now() / 1000)), type,
      ...(type === "image" ? { image: { id: "987654321", caption: "¿Es este producto?" } } : { text: { body: "Hola Changuito" } }) }],
  } }] }] };
}
function signed(payload) {
  const raw = Buffer.from(JSON.stringify(payload));
  return { body: raw, headers: { "x-hub-signature-256": "sha256=" + createHmac("sha256", "fixture-meta-signature").update(raw).digest("hex") } };
}
function crm(action, body, method = "POST") {
  return invoke(handleWhatsAppCrm, { url: "/api/whatsapp/crm?action=" + action, method,
    body: body === undefined ? undefined : Buffer.from(JSON.stringify(body)), headers: { authorization: "Bearer fixture-session" } });
}

test("WhatsApp verifies challenge and rejects invalid signatures before storage", async t => {
  const s = harness(t);
  const originalWarn = console.warn;
  const diagnostics = [];
  console.warn = (...args) => diagnostics.push(args.join(" "));
  t.after(() => { console.warn = originalWarn; });
  const ok = await invoke(handleWhatsAppWebhook, { method: "GET", url: "/?hub.mode=subscribe&hub.verify_token=fixture-verify&hub.challenge=12345" });
  assert.equal(ok.status, 200); assert.equal(ok.body, 12345);
  assert.equal((await invoke(handleWhatsAppWebhook, { method: "GET", url: "/?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1" })).status, 403);
  assert.equal((await invoke(handleWhatsAppWebhook, { body: Buffer.from("{}"), headers: { "x-hub-signature-256": "sha256=invalid" } })).status, 401);
  assert.deepEqual(diagnostics, ["[whatsapp-webhook] rejected reason=signature"]);
  const invalidObject = signed({ object: "not_whatsapp_business_account", entry: [] });
  assert.equal((await invoke(handleWhatsAppWebhook, invalidObject)).status, 400);
  assert.equal(diagnostics.at(-1), "[whatsapp-webhook] rejected reason=object_type");
  process.env.WHATSAPP_MODE = "production";
  assert.equal((await invoke(handleWhatsAppWebhook, signed(webhookPayload()))).status, 503);
  assert.equal(diagnostics.at(-1), "[whatsapp-webhook] rejected reason=test_configuration");
  assert.equal(s.calls.length, 0);
  assert.equal(verifySignature(Buffer.from("other"), "sha256=" + "a".repeat(64)), false);
});
test("WhatsApp stores an independent phone conversation and deduplicates webhook retries", async t => {
  const s = harness(t);
  const request = signed(webhookPayload());
  assert.equal((await invoke(handleWhatsAppWebhook, request)).status, 200);
  assert.equal((await invoke(handleWhatsAppWebhook, request)).status, 200);
  assert.equal(s.ingests, 1); assert.equal(s.messages.length, 1); assert.equal(s.events.size, 1);
  assert.equal(s.calls.some(c => /pedidos|mensajes_chat/.test(c.path)), false);
});
test("WhatsApp test mode refuses the real sender, wrong channel and unauthorized recipient", async t => {
  const s = harness(t);
  const originalWarn = console.warn;
  const diagnostics = [];
  console.warn = (...args) => diagnostics.push(args.join(" "));
  t.after(() => { console.warn = originalWarn; });
  assert.throws(() => assertSafeSender("+52 222 333 9999"), /protegido/);
  const wrongChannel = webhookPayload();
  wrongChannel.entry[0].changes[0].value.metadata.phone_number_id = "9999999999";
  assert.equal((await invoke(handleWhatsAppWebhook, signed(wrongChannel))).status, 403);
  assert.equal(diagnostics.at(-1), "[whatsapp-webhook] rejected reason=phone_number_id");
  const stranger = webhookPayload(); stranger.entry[0].changes[0].value.messages[0].from = "15555550999";
  assert.equal((await invoke(handleWhatsAppWebhook, signed(stranger))).status, 200);
  assert.equal(diagnostics.at(-1), "[whatsapp-webhook] rejected reason=allowlist");
  assert.equal(diagnostics.some(line => /15555550999|fixture-meta-signature|sha256=/.test(line)), false);
  assert.equal(s.events.size, 0);
  s.sender = "+52 222 333 9999";
  assert.equal((await crm("send", { id: ids.conversation, nonce: ids.nonce, text: "Hola" })).status, 403);
  assert.equal(s.sends, 0);
});

test("WhatsApp logs real-number protection with a reason code only", async t => {
  harness(t);
  const originalWarn = console.warn;
  const diagnostics = [];
  console.warn = (...args) => diagnostics.push(args.join(" "));
  t.after(() => { console.warn = originalWarn; });
  const payload = webhookPayload();
  payload.entry[0].changes[0].value.metadata.display_phone_number = "+52 222 333 9999";
  assert.equal((await invoke(handleWhatsAppWebhook, signed(payload))).status, 403);
  assert.deepEqual(diagnostics, ["[whatsapp-webhook] rejected reason=real_number_protection"]);
  assert.equal(/222|fixture-meta-signature|sha256=/.test(diagnostics.join(" ")), false);
});
test("WhatsApp incoming photo is private and retries a durable failed media event", async t => {
  const s = harness(t, { photoFail: true });
  const req = signed(webhookPayload("image"));
  assert.notEqual((await invoke(handleWhatsAppWebhook, req)).status, 200);
  assert.equal([...s.events.values()][0].status, "failed");
  assert.equal(s.messages[0].image_path, null);
  s.photoFail = false;
  const retry = await crm("retry", {});
  assert.equal(retry.status, 200); assert.equal(retry.body.processed, 1);
  assert.equal(s.messages.length, 1);
  assert.match(s.messages[0].image_path, new RegExp(ids.conversation));
  assert.equal([...s.events.values()][0].status, "processed");
});
test("WhatsApp refuses forged raw payload handling and keeps locked events retryable", async t => {
  const s = harness(t, { claimBusy: true });
  assert.equal((await invoke(handleWhatsAppWebhook, { body: { object: "whatsapp_business_account" } })).status, 400);
  assert.equal((await invoke(handleWhatsAppWebhook, signed(webhookPayload()))).status, 503);
  assert.equal(s.messages.length, 0);
  assert.equal(s.events.size, 1);
});
test("WhatsApp rejects expired sessions, customer access and unassigned couriers", async t => {
  const s = harness(t);
  assert.equal((await invoke(handleWhatsAppCrm, { method: "GET", url: "/?action=list" })).status, 401);
  s.expired = true; assert.equal((await crm("list", undefined, "GET")).status, 401);
  s.expired = false; s.role = "cliente";
  assert.equal((await crm("list", undefined, "GET")).status, 403);
  s.role = "repartidor"; s.user = ids.other;
  assert.equal((await crm("send", { id: ids.conversation, nonce: ids.nonce, text: "Hola" })).status, 403);
  assert.equal((await crm("assign", { id: ids.conversation, courierId: ids.other })).status, 403);
  assert.equal(s.sends, 0);
});
test("WhatsApp assigned courier sends only via official API, with idempotency", async t => {
  const s = harness(t, { role: "repartidor", user: ids.courier });
  const body = { id: ids.conversation, nonce: ids.nonce, text: "Ya encontré tu compra" };
  const r = await crm("send", body);
  assert.equal(r.status, 200); assert.equal(r.body.message.status, "sent");
  assert.equal((await crm("send", body)).status, 200);
  assert.equal(s.sends, 1);
  const call = s.calls.find(c => c.host === "graph.facebook.com" && c.path.endsWith("/messages"));
  assert.equal(call.body.to, "15555550123");
  assert.equal(call.body.messaging_product, "whatsapp");
  assert.equal(call.body.text.body, body.text);
});
test("WhatsApp sends a purchase photo through Meta upload, never a public bucket", async t => {
  const s = harness(t);
  const r = await crm("send", { id: ids.conversation, nonce: ids.nonce, text: "Tu compra",
    image: { mime: "image/png", name: "compra.png", base64: png.toString("base64") } });
  assert.equal(r.status, 200); assert.equal(s.sends, 1);
  assert.ok(s.calls.some(c => c.path.endsWith("/media") && c.method === "POST"));
  const send = s.calls.find(c => c.path.endsWith("/messages"));
  assert.deepEqual(send.body.image, { id: "987654321", caption: "Tu compra" });
  assert.ok(s.messages[0].image_path);
  assert.equal(s.calls.some(c => c.path.includes("/public/")), false);
});
test("WhatsApp rejects the expired service window and invalid images without sending", async t => {
  const s = harness(t, { expiredWindow: true });
  assert.equal((await crm("send", { id: ids.conversation, nonce: ids.nonce, text: "Fuera de ventana" })).status, 409);
  assert.equal(s.sends, 0);
  const badPhoto = await crm("send", { id: ids.conversation, nonce: ids.nonce, text: "",
    image: { mime: "image/png", base64: Buffer.from("not an image").toString("base64") } });
  assert.equal(badPhoto.status, 400);
});
test("WhatsApp does not automatically resend a delivery with an uncertain result", async t => {
  const s = harness(t, { sendError: true });
  const body = { id: ids.conversation, nonce: ids.nonce, text: "En camino" };
  const first = await crm("send", body);
  assert.equal(first.status, 504); assert.equal(s.messages[0].status, "unknown");
  assert.equal((await crm("send", body)).body.message.status, "unknown");
  assert.equal(s.sends, 1);
});
test("WhatsApp admin changes case assignment/archive through guarded CRM RPCs", async t => {
  const s = harness(t);
  assert.equal((await crm("assign", { id: ids.conversation, courierId: ids.other })).status, 200);
  assert.equal(s.conversation.assigned_to, ids.other);
  assert.equal((await crm("archive", { id: ids.conversation })).status, 200);
  assert.equal(s.conversation.status, "archivada");
  assert.equal(s.calls.some(c => /pedidos|mensajes_chat/.test(c.path)), false);
});
test("WhatsApp rejects untrusted media URLs without following them", async t => {
  const s = harness(t, { mediaUrl: "https://attacker.invalid/internal" });
  assert.equal((await invoke(handleWhatsAppWebhook, signed(webhookPayload("image")))).status, 502);
  assert.equal(s.calls.some(c => c.host === "attacker.invalid"), false);
});
test("WhatsApp signed delivery statuses update only provider-associated messages", async t => {
  const s = harness(t);
  s.messages.push({ id: ids.message, wa_message_id: "wamid.outgoing", direction: "out" });
  const payload = webhookPayload();
  const value = payload.entry[0].changes[0].value;
  delete value.messages;
  value.statuses = [{ id: "wamid.outgoing", recipient_id: "15555550123", status: "read", timestamp: "1234567890" }];
  assert.equal((await invoke(handleWhatsAppWebhook, signed(payload))).status, 200);
  assert.equal(s.delivery.p_status, "read");
});
