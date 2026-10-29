import assert from "node:assert/strict";
import { afterEach, test, mock } from "node:test";
import { handleGeminiChatRequest } from "../server/geminiChat.js";

// Fixture values override this test process only. No live API is called.
process.env.GEMINI_API_KEY = "fixture-server-secret";
process.env.VITE_SUPABASE_URL = "https://fixture.supabase.co/rest/v1/";
process.env.VITE_SUPABASE_ANON_KEY = "fixture-public-key";

const catalog = [
  { id: "burger", name: "Hamburguesa", price: 89, merchantId: "shop", merchantName: "Prueba" },
  { id: "fries", name: "Papas", price: 45, merchantId: "shop", merchantName: "Prueba" },
  { id: "product_5af91", name: "Taco", price: 20, merchantId: "store_4bd20", merchantName: "Otro" },
];
let requestNumber = 0;

afterEach(function () {
  mock.restoreAll();
});

async function invoke(body, overrides = {}) {
  let result;
  const headers = {
    "content-type": "application/json",
    authorization: "Bearer fixture-access-token",
    "x-forwarded-for": "fixture-" + ++requestNumber,
    ...overrides.headers,
  };
  const req = { method: "POST", body, ...overrides, headers };
  const res = {
    statusCode: 0,
    setHeader: function () {},
    end: function (value) {
      result = { status: this.statusCode, body: JSON.parse(value) };
    },
  };
  await handleGeminiChatRequest(req, res);
  return result;
}

function mockProvider(modelResult, options = {}) {
  const calls = [];
  mock.method(globalThis, "fetch", async function (url, init) {
    calls.push({ url, init });
    if (url === "https://fixture.supabase.co/auth/v1/user") {
      return new Response(JSON.stringify({ id: "fixture-user" }), {
        status: options.authStatus ?? 200,
      });
    }
    return new Response(
      options.rawResponse ??
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(modelResult) }] } }],
        }),
      { status: options.providerStatus ?? 200 },
    );
  });
  return calls;
}

test("requires a session before calling Gemini", async function () {
  const calls = mockProvider({});
  const result = await invoke({ message: "hola", catalog }, { headers: { authorization: "" } });
  assert.equal(result.status, 401);
  assert.equal(calls.length, 0);
});

test("validates the Supabase session and keeps the Gemini key server-side", async function () {
  const calls = mockProvider({
    reply: "Revisa tu propuesta.",
    items: [{ productId: "burger", quantity: 1 }, { productId: "fries", quantity: 2 }],
  });
  const result = await invoke({ message: "Una hamburguesa y dos papas", catalog });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.items, [{ id: "burger", quantity: 1 }, { id: "fries", quantity: 2 }]);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].init.headers["x-goog-api-key"], "fixture-server-secret");
  assert.equal(calls[1].url.includes("fixture-server-secret"), false);
  assert.equal(JSON.stringify(result).includes("fixture-server-secret"), false);
});

test("asks Gemini for short replies without repeating the visible proposal", async function () {
  const calls = mockProvider({ reply: "Preparé tu propuesta.", items: [] });
  const result = await invoke({ message: "¿Qué me recomiendas?", catalog });
  assert.equal(result.status, 200);
  const prompt = JSON.parse(calls[1].init.body).contents[0].parts[0].text;
  assert.match(prompt, /una o dos frases cortas/);
  assert.match(prompt, /no repitas toda la lista del pedido/);
});

test("rejects expired sessions before provider usage", async function () {
  const calls = mockProvider({}, { authStatus: 401 });
  const result = await invoke({ message: "hola", catalog });
  assert.equal(result.status, 401);
  assert.equal(calls.length, 1);
});

test("does not accept invented IDs or invalid quantities", async function () {
  mockProvider({
    reply: "Encontré productos.",
    items: [
      { productId: "invented", quantity: 2 },
      { productId: "burger", quantity: 500 },
      { productId: "fries", quantity: 1.5 },
    ],
  });
  const result = await invoke({ message: "pedido", catalog });
  assert.deepEqual(result.body.items, []);
  assert.match(result.body.reply, /No pude asociar/);
});

test("merges repeated items and retains products from each requested business", async function () {
  mockProvider({
    reply: "Incluí burger del negocio shop y product_5af91 del negocio store_4bd20.",
    items: [
      { productId: "burger", quantity: 1 },
      { productId: "burger", quantity: 1 },
      { productId: "product_5af91", quantity: 2 },
    ],
  });
  const result = await invoke({ message: "pedido", catalog });
  assert.deepEqual(result.body.items, [{ id: "burger", quantity: 2 }, { id: "product_5af91", quantity: 2 }]);
  assert.match(result.body.reply, /Hamburguesa del negocio Prueba y Taco del negocio Otro/);
  assert.doesNotMatch(result.body.reply, /\b(?:burger|shop|product_5af91|store_4bd20)\b/i);
});

test("never repeats prices or false checkout claims from generated prose", async function () {
  mockProvider({ reply: "Pedido confirmado por $9", items: [{ productId: "burger", quantity: 1 }] });
  const result = await invoke({ message: "pedido", catalog });
  assert.equal(result.status, 200);
  assert.doesNotMatch(result.body.reply, /\$9|confirmado/);
});

test("returns an explicit quota error without falling back to keyword ordering", async function () {
  mock.method(console, "error", function () {});
  mockProvider({}, { providerStatus: 429, rawResponse: '{"error":{"status":"RESOURCE_EXHAUSTED"}}' });
  const result = await invoke({ message: "pedido", catalog });
  assert.equal(result.status, 429);
  assert.match(result.body.error, /límite temporal/);
});

test("rejects unsupported methods, content types, oversized bodies, and missing catalogs", async function () {
  mockProvider({});
  assert.equal((await invoke({}, { method: "GET" })).status, 405);
  assert.equal((await invoke({}, { headers: { "content-type": "text/plain" } })).status, 415);
  assert.equal((await invoke({ message: "x".repeat(150000), catalog })).status, 413);
  assert.equal((await invoke({ message: "hola", catalog: [] })).status, 409);
});
