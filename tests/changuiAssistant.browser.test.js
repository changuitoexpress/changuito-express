import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright";

test("dictates, quotes, rechecks prices and confirms once without real data writes", async function () {
  const browser = await chromium.launch({
    executablePath: "/repl/tools/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const context = await browser.newContext({ viewport: { width: 402, height: 874 } });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", function (error) { pageErrors.push(error.message); });
    const merchant = {
      id: "shop",
      name: "Negocio de prueba",
      category: "restaurante",
      rating: 5,
      delivery_time: "30 min",
      image_url: null,
      is_open: true,
      phone_number: "5550000000",
      description: "Datos en memoria",
    };
    let changedPrice = false;
    let apiCalls = 0;
    let returnQuotaError = false;
    const products = [
      { id: "burger", merchant_id: "shop", name: "Hamburguesa de res", price: 89, is_available: true },
      { id: "fries", merchant_id: "shop", name: "Papas a la francesa", price: 45, is_available: true },
    ];
    const user = {
      id: "fixture-chat-user",
      email: "fixture@example.test",
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

    await page.addInitScript(function () {
      class FixtureRecognition {
        start() {
          const self = this;
          setTimeout(function () {
            self.onresult?.({ results: [[{ transcript: "Quiero una hamburguesa y dos papas" }]] });
            self.onend?.();
          }, 20);
        }
        stop() { this.onend?.(); }
      }
      window.SpeechRecognition = FixtureRecognition;
      window.webkitSpeechRecognition = FixtureRecognition;
    });
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
      let data = [];
      if (table === "perfiles") data = [{ id: user.id, nombre: "Prueba", rol: "cliente" }];
      if (table === "merchants") data = [merchant];
      if (table === "products") {
        data = products.map(function (product) {
          return { ...product, price: changedPrice && product.id === "burger" ? 99 : product.price };
        });
      }
      if (table === "monedero_cliente") data = [{ user_id: user.id, saldo_cashback: 0, pedidos_realizados: 0, envios_gratis_usados: 0 }];
      await route.fulfill({
        status: request.method() === "OPTIONS" ? 204 : 200,
        headers: {
          "content-type": "application/json",
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "access-control-expose-headers": "content-range",
          "content-range": "0-0/0",
        },
        body: request.method() === "OPTIONS" ? "" : JSON.stringify(acceptsObject ? data[0] ?? null : data),
      });
    });
    await page.route("**/api/gemini-chat", async function (route) {
      apiCalls += 1;
      assert.equal(route.request().headers().authorization, "Bearer " + accessToken);
      const input = route.request().postDataJSON();
      assert.equal(input.message, apiCalls === 1 ? "Quiero una hamburguesa y dos papas" : "Otra opción");
      assert.equal(input.catalog.length, 2);
      await route.fulfill({
        status: returnQuotaError ? 429 : 200,
        contentType: "application/json",
        body: JSON.stringify(returnQuotaError
          ? { error: "Límite temporal de prueba. Intenta después." }
          : { reply: "Preparé esta propuesta para revisar.", items: [{ id: "burger", quantity: 1 }, { id: "fries", quantity: 2 }] }),
      });
    });

    const baseUrl = process.env.REPLIT_DEV_DOMAIN
      ? "https://" + process.env.REPLIT_DEV_DOMAIN
      : "http://127.0.0.1:5173";
    await page.goto(baseUrl);
    await page.getByLabel("Correo electrónico", { exact: true }).fill(user.email);
    await page.getByLabel("Contraseña", { exact: true }).fill("fixture-password");
    await page.getByRole("button", { name: "Entrar", exact: true }).last().click();
    await page.getByTitle("ChanguiBot IA", { exact: true }).first().click({ timeout: 15000 });
    const input = page.getByLabel("Escribe o dicta tu pedido", { exact: true });
    await input.waitFor();
    await page.getByRole("button", { name: "Dictar pedido", exact: true }).click();
    await page.waitForFunction(function () {
      return document.querySelector('input[aria-label="Escribe o dicta tu pedido"]')?.value === "Quiero una hamburguesa y dos papas";
    });
    await page.getByRole("button", { name: "Enviar pedido", exact: true }).click();
    await page.getByRole("region", { name: "Propuesta de pedido" }).waitFor();
    assert.equal(await page.locator('[aria-label="0 productos en el carrito"]').count(), 1);
    assert.match(await page.getByRole("region", { name: "Propuesta de pedido" }).innerText(), /179\.00/);
    await page.screenshot({ path: "/tmp/changui-assistant-proposal.jpg", fullPage: false });

    changedPrice = true;
    await page.getByRole("button", { name: "Confirmar y pasar al carrito", exact: true }).click();
    await page.getByText("El catálogo cambió:", { exact: false }).waitFor();
    assert.equal(await page.locator('[aria-label="0 productos en el carrito"]').count(), 1);
    assert.match(await page.getByRole("region", { name: "Propuesta de pedido" }).innerText(), /189\.00/);
    await page.getByRole("button", { name: "Confirmar y pasar al carrito", exact: true }).dblclick();
    await page.waitForFunction(function () {
      return JSON.parse(localStorage.getItem("changuito-cart") || "[]").length === 2;
    });
    const cart = await page.evaluate(function () {
      return JSON.parse(localStorage.getItem("changuito-cart") || "[]");
    });
    assert.deepEqual(cart.map(function (item) { return [item.id, item.cantidad, item.precio]; }), [
      ["burger", 1, 99],
      ["fries", 2, 45],
    ]);

    returnQuotaError = true;
    await input.fill("Otra opción");
    await page.getByRole("button", { name: "Enviar pedido", exact: true }).click();
    await page.getByText("Límite temporal de prueba. Intenta después.", { exact: true }).waitFor();
    assert.equal(apiCalls, 2);
    assert.deepEqual(pageErrors, []);
    console.log("UI verified: dictated text, $179 quote, price refresh to $189, one confirmation, explicit quota error; no live DB writes.");
    await context.close();
  } finally {
    await browser.close();
  }
});
