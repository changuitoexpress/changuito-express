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
      { id: "taco", merchant_id: "taco-shop", name: "Taco al pastor", price: 20, is_available: true },
      { id: "rice", merchant_id: "super", name: "Arroz de prueba", description: "Bolsa de un kilo", price: 25, image_url: null, category: "Despensa", is_available: true },
      { id: "milk", merchant_id: "super", name: "Leche de prueba", description: "Un litro", price: 30, image_url: null, category: "Lácteos", is_available: true },
    ];
    const merchants = [
      { ...merchant, category: "hamburguesas" },
      { ...merchant, id: "taco-shop", name: "Taco Prueba", category: "taqueria" },
      { ...merchant, id: "written", name: "Domino de prueba", category: "mandaditos" },
      { ...merchant, id: "super", name: "Negocio interno de súper", category: "tiendita" },
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
      window.__voiceTurns = ["Quiero una hamburguesa y dos papas"];
      window.__spokenReplies = [];
      window.__micStarts = 0;
      window.__micAborts = 0;
      window.__slowSpeech = false;
      class FixtureRecognition {
        start() {
          const self = this;
          self.aborted = false;
          window.__micStarts += 1;
          const words = window.__voiceTurns.shift();
          if (!words) return;
          setTimeout(function () {
            if (self.aborted) return;
            self.onresult?.({ results: [[{ transcript: words }]] });
            self.onend?.();
          }, 20);
        }
        stop() { this.aborted = true; this.onend?.(); }
        abort() { this.aborted = true; window.__micAborts += 1; }
      }
      window.SpeechRecognition = FixtureRecognition;
      window.webkitSpeechRecognition = FixtureRecognition;
      window.SpeechSynthesisUtterance = class {
        constructor(text) { this.text = text; }
      };
      Object.defineProperty(window, "speechSynthesis", {
        configurable: true,
        value: {
          getVoices: function () { return []; },
          cancel: function () {},
          speak: function (utterance) {
            window.__spokenReplies.push(utterance.text);
            setTimeout(function () { utterance.onend?.(); }, window.__slowSpeech ? 1200 : 30);
          },
        },
      });
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
      if (table === "merchants") data = merchants;
      if (table === "products") {
        data = products.map(function (product) {
          return { ...product, price: changedPrice && product.id === "burger" ? 99 : product.price };
        });
        const merchantFilter = url.searchParams.get("merchant_id");
        if (merchantFilter?.startsWith("in.")) {
          const ids = merchantFilter.slice(4, -1).split(",");
          data = data.filter(function (product) { return ids.includes(product.merchant_id); });
        }
        const idFilter = url.searchParams.get("id");
        if (idFilter?.startsWith("eq.")) {
          data = data.filter(function (product) { return product.id === idFilter.slice(3); });
        }
        if (idFilter?.startsWith("in.")) {
          const ids = idFilter.slice(4, -1).split(",");
          data = data.filter(function (product) { return ids.includes(product.id); });
        }
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
      assert.equal(input.message, apiCalls === 2
        ? "Otra opción"
        : apiCalls === 3
          ? "Quiero una hamburguesa del Negocio de prueba y un taco de Taco Prueba"
          : "Quiero una hamburguesa y dos papas");
      assert.equal(input.catalog.length, 5);
      await route.fulfill({
        status: returnQuotaError ? 429 : 200,
        contentType: "application/json",
        body: JSON.stringify(returnQuotaError
          ? { error: "Límite temporal de prueba. Intenta después." }
          : {
              reply: "Preparé esta propuesta para revisar.",
              items: apiCalls === 3
                ? [{ id: "burger", quantity: 1 }, { id: "taco", quantity: 1 }]
                : [{ id: "burger", quantity: 1 }, { id: "fries", quantity: 2 }],
            }),
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

    // Conversation can be interrupted, keeps the full proposal visible, and speaks briefly.
    returnQuotaError = false;
    await page.evaluate(function () {
      window.__slowSpeech = true;
      window.__voiceTurns = [
        "Quiero una hamburguesa del Negocio de prueba y un taco de Taco Prueba",
        "sí",
      ];
    });
    await page.getByRole("button", { name: "Conversar", exact: true }).click();
    const multiBusinessRegion = page.getByRole("region", { name: "Propuesta de pedido" });
    await multiBusinessRegion.waitFor();
    const multiBusinessProposal = await multiBusinessRegion.innerText();
    assert.match(multiBusinessProposal, /2 negocios/);
    assert.match(multiBusinessProposal, /Negocio de prueba/);
    assert.match(multiBusinessProposal, /Taco Prueba/);
    await page.screenshot({ path: "/tmp/changui-assistant-multi-business.jpg" });
    await page.evaluate(function () { window.__slowSpeech = false; });
    await page.waitForFunction(function () {
      const cart = JSON.parse(localStorage.getItem("changuito-cart") || "[]");
      return cart.find(function (item) { return item.id === "burger"; })?.cantidad === 2 &&
        cart.find(function (item) { return item.id === "fries"; })?.cantidad === 2 &&
        cart.find(function (item) { return item.id === "taco"; })?.cantidad === 1;
    });
    assert.equal(apiCalls, 3);
    assert.doesNotMatch(await page.locator("[role=log]").innerText().catch(function () { return ""; }), /\b(?:burger|taco-shop)\b/i);
    const spoken = await page.evaluate(function () { return window.__spokenReplies; });
    assert.ok(spoken.some(function (text) {
      return text.includes("Ya preparé tu propuesta") && !text.includes("Taco Prueba") && !text.includes("119.00 pesos mexicanos");
    }));
    await page.waitForFunction(function () { return document.body.innerText.includes("Te escucho · habla y haz una pausa"); });
    await page.getByRole("button", { name: "Cerrar ChanguiBot", exact: true }).click();
    const micStartsAtClose = await page.evaluate(function () { return window.__micStarts; });
    assert.ok(await page.evaluate(function () { return window.__micAborts > 0; }));

    // Correct category order and visible headings below the sticky header.
    const restaurantHeading = await page.getByRole("heading", { name: "Restaurantes", exact: true }).boundingBox();
    const errandsHeading = await page.getByRole("heading", { name: "Mandaditos", exact: true }).boundingBox();
    assert.ok(restaurantHeading.y < errandsHeading.y);
    await page.getByRole("button", { name: "Restaurantes: Hamburguesas", exact: true }).click();
    await page.waitForFunction(function () {
      const header = document.querySelector("[data-dashboard-header]").getBoundingClientRect();
      const title = document.querySelector("#seccion-hamburguesas h2").getBoundingClientRect();
      return title.top >= header.bottom && title.bottom < innerHeight - 100;
    });
    await page.getByRole("button", { name: "Mandaditos: Restaurantes por escrito", exact: true }).click();
    await page.getByText("Domino de prueba", { exact: true }).click();
    const writtenDialog = page.getByRole("dialog", { name: "Domino de prueba" });
    await writtenDialog.getByLabel("Tu pedido por escrito").fill("Una pizza mediana");
    await page.getByRole("button", { name: "Cerrar pedido por escrito" }).click();

    // Super opens products, not a second business-selection screen.
    await page.getByRole("button", { name: "🛒 Changui Súper", exact: true }).first().click();
    await page.getByRole("button", { name: "Ver Arroz de prueba", exact: true }).waitFor();
    assert.equal(await page.getByText("Negocio interno de súper", { exact: true }).count(), 0);
    const superCategories = page.getByRole("navigation", { name: "Categorías de Changui Súper" });
    await superCategories.getByRole("button", { name: "Lácteos", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: "Ver Arroz de prueba", exact: true }).count(), 0);
    await page.getByRole("button", { name: "Ver Leche de prueba", exact: true }).click();
    const detail = page.getByRole("dialog", { name: "Leche de prueba", exact: true });
    await detail.getByTestId("product-image-empty").waitFor();
    await detail.getByRole("button", { name: "Agregar al carrito", exact: true }).click();
    await page.waitForFunction(function () {
      return JSON.parse(localStorage.getItem("changuito-cart") || "[]").some(function (item) {
        return item.id === "milk" && item.negocio_id === "super" && item.cantidad === 1;
      });
    });
    await page.getByPlaceholder("Buscar productos de Changui Súper...").fill("No existe");
    await page.getByText("No hay productos disponibles para esta selección.", { exact: true }).waitFor();
    await page.getByPlaceholder("Buscar productos de Changui Súper...").fill("");
    await superCategories.getByRole("button", { name: "Todos", exact: true }).click();
    await page.screenshot({ path: "/tmp/changui-super-mobile.jpg" });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: "/tmp/changui-super-desktop.jpg" });
    assert.equal(await page.evaluate(function () { return window.__micStarts; }), micStartsAtClose);
    merchants.find(function (merchant) { return merchant.id === "super"; }).is_open = false;
    await page.reload();
    await page.getByRole("button", { name: "🛒 Changui Súper", exact: true }).first().click();
    await page.getByRole("button", { name: "Ver Leche de prueba", exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Agregar Leche de prueba al carrito", exact: true }).isDisabled(), true);
    await page.getByRole("button", { name: "Ver Leche de prueba", exact: true }).click();
    assert.equal(await page.getByRole("dialog", { name: "Leche de prueba" }).getByRole("button", { name: "Cerrado por ahora" }).isDisabled(), true);
    assert.deepEqual(pageErrors, []);
    console.log("UI verified: conversation spans two businesses and displays names/prices without IDs; confirmation, category order, written orders and Super products work. Mobile and desktop fixtures made no live DB writes.");
    await context.close();
  } finally {
    await browser.close();
  }
});
