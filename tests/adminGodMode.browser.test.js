import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright";

test("God Mode: resumen, productos, negocios, otros y pedido por negocio", async function () {
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox"] });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", function (e) { pageErrors.push(e.message); });
    const writes = [];
    const yarvisCalls = [];
    let imageUploads = 0;
    const merchants = [
      { id: "m1", name: "Burger Prueba", category: "hamburguesas", is_open: true, rating: 5, cashback_pct: null },
      { id: "m2", name: "Domino Prueba", category: "mandaditos", is_open: true, rating: 5, cashback_pct: 3 },
    ];
    const products = [{ id: "p1", merchant_id: "m1", name: "Hamburguesa clásica", description: "x", price: 89, image_url: null, category: "Burgers", is_available: true }];
    const pedidos = [
      { id: "o1", total_pagar: 200, estatus: "entregado", created_at: new Date().toISOString(), negocio_nombre: "Burger Prueba", forma_pago: "efectivo", cliente_id: "c1" },
      { id: "o2", total_pagar: 100, estatus: "pendiente", created_at: new Date().toISOString(), negocio_nombre: "Domino Prueba", forma_pago: "tarjeta", cliente_id: "c1", repartidor_id: "r1" },
    ];
    const user = {
      id: "fixture-chat-user",
      email: "uliseseven.7@gmail.com",
      aud: "authenticated",
      role: "authenticated",
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    };
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const accessToken = [
      Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),
      Buffer.from(JSON.stringify({ sub: user.id, exp: expiresAt, role: "authenticated" })).toString("base64url"),
      "fixture-signature",
    ].join(".");

    await page.route("**/auth/v1/**", async function (route) {
      const request = route.request();
      const isToken = request.url().includes("/token");
      await route.fulfill({
        status: request.method() === "OPTIONS" ? 204 : 200,
        headers: {
          "content-type": "application/json",
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
        },
        body: request.method() === "OPTIONS" ? "" : JSON.stringify(
          isToken
            ? { access_token: accessToken, token_type: "bearer", refresh_token: "fixture-refresh", expires_in: 3600, expires_at: expiresAt, user }
            : user,
        ),
      });
    });
    await page.route("**/rest/v1/**", async function (route) {
      const request = route.request();
      const url = new URL(request.url());
      const table = url.pathname.split("/").pop();
      const acceptsObject = (request.headers().accept ?? "").includes("object");
      if (request.method() !== "GET" && request.method() !== "OPTIONS") writes.push(request.method() + " " + table + " " + (request.postData() ?? ""));
      if (request.method() === "PATCH" && table === "merchants") {
        const merchantId = (url.searchParams.get("id") ?? "").replace(/^eq\./, "");
        const merchant = merchants.find(function (m) { return m.id === merchantId; });
        if (merchant) Object.assign(merchant, request.postDataJSON());
      }
      let rpcResponse = null;
      if (request.method() === "POST" && table === "cambiar_estatus_pedido") {
        const args = request.postDataJSON();
        const pedido = pedidos.find(function (p) { return p.id === args.p_id; });
        if (pedido) pedido.estatus = args.p_estatus;
        rpcResponse = { ok: true, estatus: args.p_estatus };
      }
      let data = [];
      if (table === "perfiles") data = [{ id: user.id, nombre: "Admin", rol: "admin" }];
      if (table === "merchants") data = merchants;
      if (table === "products") data = products;
      if (table === "pedidos") data = pedidos;
      if (request.method() !== "GET" && request.method() !== "OPTIONS") data = [{ id: "x" }];
      await route.fulfill({
        status: request.method() === "OPTIONS" ? 204 : 200,
        headers: { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range", "content-range": "0-0/0" },
        body: request.method() === "OPTIONS" ? "" : JSON.stringify(rpcResponse ?? (acceptsObject ? data[0] ?? null : data)),
      });
    });
    await page.route("**/api/admin-yarvis", async function (route) {
      const request = route.request();
      const body = request.postDataJSON();
      yarvisCalls.push(body);
      assert.match(request.headers().authorization, /^Bearer /);
      const photo = !!body.imageName;
      const response = body.operation === "execute"
        ? { ok: true, message: "Cambio confirmado en la prueba de YARVIS." }
        : {
          reply: "Revisa esta propuesta antes de confirmar.",
          action: {
            type: photo ? "upload_product_photo" : "change_order_status",
            payload: photo ? { merchantId: "m1", productId: "p1" } : { orderId: "o2", estatus: "entregado" },
            summary: photo ? "Agregar la foto a Hamburguesa clásica." : "Marcar el pedido de Domino Prueba como entregado.",
            confirmationToken: photo ? "fixture-photo-approval" : "fixture-order-approval",
          },
        };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(response) });
    });
    await page.route("**/storage/v1/object/changuito-fotos/**", async function (route) {
      const isOptions = route.request().method() === "OPTIONS";
      if (!isOptions) imageUploads += 1;
      await route.fulfill({
        status: isOptions ? 204 : 200,
        headers: { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" },
        body: isOptions ? "" : JSON.stringify({ Key: "changuito-fotos/fixture-photo", Id: "fixture-image" }),
      });
    });
    const baseUrl = process.env.REPLIT_DEV_DOMAIN ? "https://" + process.env.REPLIT_DEV_DOMAIN : "http://127.0.0.1:5173";
    await page.goto(baseUrl);
    await page.getByLabel("Correo electrónico", { exact: true }).fill(user.email);
    await page.getByLabel("Contraseña", { exact: true }).fill("fixture-password");
    await page.getByRole("button", { name: "Entrar", exact: true }).last().click();
    await page.getByLabel("Abrir menú").click({ timeout: 20000 });
    await page.getByRole("button", { name: "God Mode" }).click();

    await page.getByText("Tendencia de ventas").waitFor();
    assert.match(await page.locator("body").innerText(), /\$300/);
    await page.screenshot({ path: "/tmp/god-resumen.jpg" });

    await page.getByRole("button", { name: "Abrir asistente YARVIS" }).click();
    const yarvis = page.getByRole("dialog", { name: "Asistente YARVIS" });
    await yarvis.getByLabel("Mensaje para YARVIS").fill("Marca el pedido de Domino como entregado");
    await yarvis.getByRole("button", { name: "Enviar mensaje", exact: true }).click();
    await yarvis.getByRole("button", { name: "Confirmar cambio", exact: true }).waitFor();
    assert.equal(yarvisCalls.filter(function (call) { return call.operation === "execute"; }).length, 0);
    await yarvis.getByRole("button", { name: "Cancelar", exact: true }).click();
    assert.equal(yarvisCalls.filter(function (call) { return call.operation === "execute"; }).length, 0);

    await yarvis.getByLabel("Mensaje para YARVIS").fill("Vuelve a preparar la entrega");
    await yarvis.getByRole("button", { name: "Enviar mensaje", exact: true }).click();
    await yarvis.getByRole("button", { name: "Confirmar cambio", exact: true }).click();
    await yarvis.getByText("Cambio confirmado. La información del panel se actualizará.", { exact: true }).waitFor();
    assert.match(await yarvis.innerText(), /Cambio confirmado en la prueba de YARVIS\./);
    assert.equal(yarvisCalls.filter(function (call) { return call.operation === "execute"; }).length, 1);

    await page.setViewportSize({ width: 402, height: 874 });
    await yarvis.locator('input[type="file"]').setInputFiles({
      name: "prueba.png",
      mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jI1sAAAAASUVORK5CYII=", "base64"),
    });
    await yarvis.getByLabel("Mensaje para YARVIS").fill("Agrega esta foto a Hamburguesa clásica");
    await yarvis.getByRole("button", { name: "Enviar mensaje", exact: true }).click();
    await yarvis.getByRole("button", { name: "Confirmar cambio", exact: true }).waitFor();
    assert.equal(imageUploads, 0);
    await page.screenshot({ path: "/tmp/yarvis-mobile.jpg" });
    assert.ok(await yarvis.evaluate(function (element) { return element.getBoundingClientRect().right <= window.innerWidth; }));
    await yarvis.getByRole("button", { name: "Confirmar cambio", exact: true }).click();
    await page.waitForFunction(function () { return !document.querySelector('textarea[disabled]'); });
    assert.equal(imageUploads, 1);
    const photoExecution = yarvisCalls.find(function (call) { return call.confirmationToken === "fixture-photo-approval"; });
    assert.match(photoExecution.imageUrl, /\/storage\/v1\/object\/public\/changuito-fotos\/productos\/m1\/yarvis\/p1\//);
    await yarvis.getByRole("button", { name: "Cerrar YARVIS" }).click();
    await page.setViewportSize({ width: 1280, height: 900 });

    await page.getByRole("button", { name: /Pedidos/ }).click();
    page.once("dialog", function (dialog) { dialog.accept(); });
    await page.getByRole("button", { name: "Marcar pedido de Domino Prueba como entregado" }).click();
    await page.waitForFunction(function () { return document.body.innerText.includes("Entregado"); });
    assert.ok(writes.some(function (w) { return w.startsWith("POST cambiar_estatus_pedido") && w.includes("\"p_estatus\":\"entregado\""); }));

    await page.getByText("Domino Prueba", { exact: true }).click();
    await page.getByRole("button", { name: "Supervisar conversación" }).click();
    await page.getByText("Conversa sobre este pedido").waitFor();
    await page.getByRole("button", { name: "Volver" }).click();

    await page.getByRole("button", { name: /Mandaditos/ }).click();
    await page.getByText("Domino Prueba", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Elegir destino" }).click();
    await page.getByLabel("Tipo de comida en Restaurantes").selectOption("hamburguesas");
    await page.getByRole("button", { name: "Mover a Restaurantes" }).click();
    await page.getByText("Domino Prueba ahora aparecerá en Restaurantes.").waitFor();

    await page.getByRole("button", { name: /Restaurantes/ }).click();
    await page.getByText("Domino Prueba", { exact: true }).waitFor();
    await page.getByText("Hamburguesa clásica").waitFor();
    await page.getByText("Hamburguesa clásica").locator("xpath=../..").getByRole("button", { name: "Editar", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Guardar" }).click();
    await page.getByText("Producto guardado.").waitFor();
    assert.ok(writes.some(function (w) { return w.startsWith("PATCH products") && w.includes("\"price\":89"); }));
    await page.screenshot({ path: "/tmp/god-productos.jpg" });

    await page.getByRole("button", { name: /Otros/ }).click();
    await page.getByText("Changui Shopping").first().waitFor();
    assert.deepEqual(pageErrors, []);
    await page.getByRole("button", { name: /Restaurantes/ }).click();
    await page.getByRole("button", { name: "Editar", exact: true }).nth(1).click();
    await page.getByRole("dialog").getByText("Cashback a clientes (%)").waitFor();
    await page.screenshot({ path: "/tmp/god-negocios.jpg" });
    await page.getByRole("dialog").getByRole("button", { name: "Guardar" }).click();
    await page.getByText("Negocio guardado.").waitFor();
    assert.ok(writes.some(function (w) { return w.startsWith("PATCH merchants") && w.includes("\"category\":\"hamburguesas\"") && w.includes("\"cashback_pct\":3"); }));

    assert.ok(writes.some(function (w) { return w.startsWith("PATCH merchants") && w.includes("\"category\":\"hamburguesas\""); }));
  } finally {
    await browser.close();
  }
});
