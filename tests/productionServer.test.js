import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { productionServer, validateProductionEnvironment } from "../server/production.js";

test("production serves SPA and authenticated CRM without exposing source or secrets", async function () {
  const root = await mkdtemp(join(tmpdir(), "changuito-production-"));
  await writeFile(join(root, "index.html"), "<html>Changuito</html>");
  const server = productionServer(root);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = "http://127.0.0.1:" + server.address().port;
  const before = process.env.WHATSAPP_VERIFY_TOKEN;
  const beforeMode = process.env.WHATSAPP_MODE;
  process.env.WHATSAPP_VERIFY_TOKEN = "fixture-verification-token";
  process.env.WHATSAPP_MODE = "test";
  try {
    const page = await fetch(origin + "/");
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Changuito/);
    assert.equal((await fetch(origin + "/dashboard")).status, 200);
    assert.equal((await fetch(origin + "/.env")).status, 404);
    assert.equal((await fetch(origin + "/server/production.js")).status, 404);
    assert.equal((await fetch(origin + "/api/missing")).status, 404);
    assert.equal((await fetch(origin + "/api/whatsapp/crm?action=list")).status, 401);
    const verification = await fetch(origin + "/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=fixture-verification-token&hub.challenge=fixture");
    assert.equal(verification.status, 200);
    assert.equal(await verification.text(), "fixture");
    assert.equal((await fetch(origin + "/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=fixture")).status, 403);
    const unsigned = await fetch(origin + "/api/whatsapp/webhook", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    });
    assert.equal(unsigned.status, 401);
  } finally {
    if (before === undefined) delete process.env.WHATSAPP_VERIFY_TOKEN;
    else process.env.WHATSAPP_VERIFY_TOKEN = before;
    if (beforeMode === undefined) delete process.env.WHATSAPP_MODE;
    else process.env.WHATSAPP_MODE = beforeMode;
    server.closeAllConnections();
    await new Promise(function (done) { server.close(done); });
    await rm(root, { recursive: true, force: true });
  }
});

test("production refuses to start without WhatsApp configuration", function () {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  delete process.env.WHATSAPP_ACCESS_TOKEN;
  try {
    assert.throws(validateProductionEnvironment, /WHATSAPP_ACCESS_TOKEN/);
  } finally {
    if (token !== undefined) process.env.WHATSAPP_ACCESS_TOKEN = token;
  }
});
