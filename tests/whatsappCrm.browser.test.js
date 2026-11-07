import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=", "base64");
const adminId = "10000000-0000-4000-8000-000000000001";
const courierId = "10000000-0000-4000-8000-000000000002";
const secondCourier = "10000000-0000-4000-8000-000000000003";
const c1 = "20000000-0000-4000-8000-000000000001";
const c2 = "20000000-0000-4000-8000-000000000002";
const m1 = "30000000-0000-4000-8000-000000000001";

async function fixture(browser, isAdmin) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
  const page = await context.newPage();
  const errors = [], writes = [];
  page.on("pageerror", e => errors.push(e.message));
  const user = { id: isAdmin ? adminId : courierId, email: isAdmin ? "uliseseven.7@gmail.com" : "courier-crm@example.test",
    aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const access = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url") + "." +
    Buffer.from(JSON.stringify({ sub: user.id, exp, role: "authenticated" })).toString("base64url") + ".fixture";
  const conversations = [
    { id: c1, phone_number_id: "123456789", status: "abierta", assigned_to: isAdmin ? null : courierId,
      last_inbound_at: new Date().toISOString(), last_message_at: new Date().toISOString(),
      contact: { phone: "15555550123", display_name: "Cliente CRM Uno" } },
    { id: c2, phone_number_id: "123456789", status: "abierta", assigned_to: secondCourier,
      last_inbound_at: new Date().toISOString(), last_message_at: new Date().toISOString(),
      contact: { phone: "15555550124", display_name: "Cliente CRM Dos" } },
  ];
  const messages = [{ id: m1, conversation_id: c1, direction: "in", kind: "image",
    body: "¿Puedes comprar este producto?", actor_id: null, status: "received", error: null,
    image_path: c1 + "/" + m1 + ".png", created_at: new Date().toISOString() }];
  const assignments = [];
  const config = { configured: true, missing: [], mode: "test", channelLabel: "Meta · número de prueba", pendingEvents: 0 };
  const cors = { "content-type": "application/json", "access-control-allow-origin": "*",
    "access-control-allow-headers": "*", "access-control-allow-methods": "*",
    "access-control-expose-headers": "content-range", "content-range": "0-0/0" };
  const json = (route, data, status = 200) => route.fulfill({ status, headers: cors, body: JSON.stringify(data) });
  await page.route("**/auth/v1/**", route => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    return json(route, route.request().url().includes("/token")
      ? { access_token: access, refresh_token: "fixture-refresh", expires_at: exp, expires_in: 3600, token_type: "bearer", user } : user);
  });
  await page.route("**/rest/v1/**", route => {
    const request = route.request(), url = new URL(request.url()), table = url.pathname.split("/").pop();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (!["GET", "HEAD"].includes(request.method())) writes.push(table);
    const profile = { id: user.id, nombre: isAdmin ? "Admin CRM" : "Repartidor CRM", rol: isAdmin ? "admin" : "repartidor" };
    const rows = table === "perfiles" ? [profile] : [];
    return json(route, (request.headers().accept ?? "").includes("object") ? rows[0] ?? null : rows);
  });
  await page.route("**/api/whatsapp/crm**", async route => {
    const request = route.request(), url = new URL(request.url());
    const action = url.searchParams.get("action");
    const body = request.method() === "POST" ? request.postDataJSON() : {};
    const id = url.searchParams.get("id") || body.id;
    const conversation = conversations.find(c => c.id === id);
    const allowed = c => isAdmin || c.assigned_to === courierId;
    if (action === "list") return json(route, { conversations: conversations.filter(c => allowed(c) &&
      (c.status === "archivada") === (url.searchParams.get("archived") === "true")),
      couriers: isAdmin ? [{ id: courierId, nombre: "Repartidor Uno" }, { id: secondCourier, nombre: "Repartidor Dos" }] : [],
      config });
    if (action === "media") return json(route, { url: "data:image/png;base64," + png.toString("base64") });
    if (conversation && !allowed(conversation)) return json(route, { error: "Ya no tienes acceso a esta conversación." }, 403);
    if (action === "detail") return json(route, { conversation, messages: messages.filter(m => m.conversation_id === id),
      assignments, nextBefore: null });
    if (action === "send") {
      const m = { id: crypto.randomUUID(), conversation_id: id, direction: "out", kind: body.image ? "image" : "text",
        body: body.text, actor_id: user.id, status: "sent", error: null,
        image_path: body.image ? id + "/fixture.png" : null, created_at: new Date().toISOString() };
      messages.push(m); return json(route, { message: m });
    }
    if (action === "assign") {
      assignments.push({ id: crypto.randomUUID(), previous_courier: conversation.assigned_to,
        next_courier: body.courierId, actor_id: user.id, event: "assign", created_at: new Date().toISOString() });
      conversation.assigned_to = body.courierId;
      return json(route, { ok: true });
    }
    if (action === "archive") { conversation.status = "archivada"; return json(route, { ok: true }); }
    return json(route, { error: "Unhandled fixture action" }, 400);
  });
  // Any provider request in this browser test is a bug, never send it.
  await page.route("https://graph.facebook.com/**", route => route.abort());
  const base = process.env.REPLIT_DEV_DOMAIN ? "https://" + process.env.REPLIT_DEV_DOMAIN : "http://127.0.0.1:5173";
  await page.goto(base);
  await page.getByLabel("Correo electrónico", { exact: true }).fill(user.email);
  await page.getByLabel("Contraseña", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Entrar", exact: true }).last().click();
  await page.getByLabel("Abrir menú").click({ timeout: 20000 });
  await page.getByRole("button", { name: isAdmin ? /^God Mode$/ : /Panel Repartidor/ }).click();
  await page.getByRole("button", { name: "WhatsApp", exact: true }).click();
  const crm = page.getByRole("region", { name: "CRM de WhatsApp" });
  try {
    await crm.getByRole("button", { name: /Abrir conversación con Cliente CRM Uno/ }).waitFor({ timeout: 8000 });
  } catch (error) {
    console.error("CRM fixture state:", await page.locator("body").innerText(), "Errors:", errors);
    await page.screenshot({ path: "/tmp/whatsapp-crm-fixture-failure.png" });
    throw error;
  }
  return { page, context, crm, conversations, messages, config, errors, writes };
}
test("WhatsApp CRM: admin assignment, text/photos, reassignment/archive and courier revocation stay separate from orders", async () => {
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox"] });
  try {
    const f = await fixture(browser, true);
    await f.crm.getByRole("button", { name: /Abrir conversación con Cliente CRM Uno/ }).click();
    await f.crm.getByLabel("Asignar repartidor").selectOption(courierId);
    await f.page.waitForFunction(() => document.querySelector('[aria-label="Asignar repartidor"]')?.value.endsWith("002"));
    const composer = f.crm.locator("textarea");
    await composer.fill("Compra confirmada desde Changuito");
    await f.crm.getByRole("button", { name: "Enviar mensaje", exact: true }).click();
    await f.crm.getByText("Compra confirmada desde Changuito", { exact: true }).waitFor();
    await f.crm.locator('input[type="file"]').setInputFiles({ name: "compra.png", mimeType: "image/png", buffer: png });
    await composer.fill("Fotografía de la compra");
    await f.crm.getByRole("button", { name: "Enviar mensaje", exact: true }).click();
    await f.crm.getByText("Fotografía de la compra", { exact: true }).waitFor();
    await f.crm.locator('img').first().waitFor();
    await f.crm.getByLabel("Asignar repartidor").selectOption(secondCourier);
    await f.crm.getByText("Repartidor Uno", { exact: false }).last().waitFor();
    await f.page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await f.crm.evaluate(el => el.getBoundingClientRect().right <= innerWidth + 1), "Mobile CRM must fit");
    await f.page.screenshot({ path: "/tmp/whatsapp-crm-mobile.png" });
    f.page.once("dialog", d => d.accept());
    await f.crm.getByRole("button", { name: "Archivar conversación" }).click();
    await f.crm.getByRole("button", { name: "Archivadas", exact: true }).click();
    await f.crm.getByRole("button", { name: /Abrir conversación con Cliente CRM Uno/ }).click();
    assert.equal(await f.crm.getByRole("button", { name: "Enviar mensaje", exact: true }).isDisabled(), true);
    await f.page.setViewportSize({ width: 1280, height: 900 });
    await f.page.screenshot({ path: "/tmp/whatsapp-crm-desktop.png" });
    assert.equal(f.errors.length, 0, f.errors.join("\n"));
    assert.deepEqual(f.writes.filter(table => /^(pedidos|mensajes_chat|whatsapp_)/.test(table)), [],
      "CRM must not write directly to Supabase or alter order chats");
    await f.context.close();

    const r = await fixture(browser, false);
    await r.crm.getByRole("button", { name: /Abrir conversación con Cliente CRM Uno/ }).click();
    await r.crm.getByText("¿Puedes comprar este producto?", { exact: true }).waitFor();
    assert.equal(await r.crm.getByLabel("Asignar repartidor").count(), 0);
    assert.equal(await r.crm.getByRole("button", { name: "Archivar conversación" }).count(), 0);
    assert.equal(await r.crm.getByRole("button", { name: /Abrir conversación con Cliente CRM Dos/ }).count(), 0);
    await r.crm.locator("textarea").fill("Ya voy por tu compra");
    await r.crm.getByRole("button", { name: "Enviar mensaje", exact: true }).click();
    await r.crm.getByText("Ya voy por tu compra", { exact: true }).waitFor();
    // Next scoped poll loses this courier's case; old messages/photos must disappear.
    r.conversations[0].assigned_to = secondCourier;
    await r.crm.getByRole("button", { name: "Actualizar conversaciones" }).click();
    await r.crm.getByRole("heading", { name: "La bandeja está vacía" }).waitFor();
    assert.equal(await r.crm.getByText("¿Puedes comprar este producto?", { exact: true }).count(), 0);
    assert.equal(await r.crm.locator("img").count(), 0);
    assert.equal(r.errors.length, 0, r.errors.join("\n"));
    assert.deepEqual(r.writes.filter(table => /^(pedidos|mensajes_chat|whatsapp_)/.test(table)), []);
    await r.context.close();
  } finally { await browser.close(); }
});
