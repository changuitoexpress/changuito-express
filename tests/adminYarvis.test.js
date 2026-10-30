import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { handleAdminYarvisRequest } from "../server/adminYarvis.js";

process.env.GEMINI_API_KEY = "fixture-yarvis-model-key";
process.env.SESSION_SECRET = "fixture-yarvis-session-secret";
process.env.VITE_SUPABASE_URL = "https://fixture.supabase.co";
process.env.VITE_SUPABASE_ANON_KEY = "fixture-anon-key";

const ids = {
  admin: "223e4567-e89b-42d3-a456-426614174000",
  order: "123e4567-e89b-42d3-a456-426614174001",
  courier: "323e4567-e89b-42d3-a456-426614174002",
  merchant: "423e4567-e89b-42d3-a456-426614174003",
  product: "523e4567-e89b-42d3-a456-426614174004",
};

let requestNumber = 0;

afterEach(function () {
  mock.restoreAll();
});

function createHarness(options = {}) {
  const state = {
    order: {
      id: ids.order,
      negocio_nombre: "Tortas de prueba",
      estatus: "pendiente",
      repartidor_id: null,
    },
    product: {
      id: ids.product,
      merchant_id: ids.merchant,
      name: "Torta de prueba",
      price: 50,
      is_available: true,
      image_url: null,
    },
    patches: [],
    modelCalls: [],
    protectedCalls: 0,
    admin: options.admin !== false,
  };
  mock.method(globalThis, "fetch", async function (input, init = {}) {
    const url = new URL(String(input));
    const method = init.method ?? "GET";
    if (url.pathname === "/auth/v1/user") {
      return new Response(JSON.stringify({ id: ids.admin }), { status: 200 });
    }
    if (url.pathname === "/rest/v1/rpc/is_changuito_admin") {
      state.protectedCalls += 1;
      return new Response(JSON.stringify(state.admin), { status: 200 });
    }
    if (url.pathname === "/rest/v1/rpc/cambiar_estatus_pedido") {
      return new Response(JSON.stringify({ ok: true, estatus: "entregado" }), { status: 200 });
    }
    if (url.pathname === "/rest/v1/pedidos" && method === "HEAD") {
      return new Response(null, { status: 200, headers: { "content-range": "0-0/2" } });
    }
    if (url.pathname.startsWith("/rest/v1/") && method === "PATCH") {
      state.patches.push({ path: url.pathname, query: url.searchParams, body: JSON.parse(init.body) });
      if (url.pathname === "/rest/v1/pedidos") {
        state.order = { ...state.order, ...JSON.parse(init.body) };
      }
      if (url.pathname === "/rest/v1/products") {
        state.product = { ...state.product, ...JSON.parse(init.body) };
      }
      return new Response(JSON.stringify([{ id: ids.order }]), { status: 200 });
    }
    if (url.pathname === "/rest/v1/pedidos") {
      if (url.searchParams.has("id")) {
        return new Response(JSON.stringify([state.order]), { status: 200 });
      }
      return new Response(JSON.stringify([{
        ...state.order,
        created_at: "2026-10-30T12:00:00.000Z",
      }]), { status: 200 });
    }
    if (url.pathname === "/rest/v1/merchants") {
      return new Response(JSON.stringify([{
        id: ids.merchant,
        name: "Tortas de prueba",
        category: "Restaurantes",
        is_open: true,
      }]), { status: 200 });
    }
    if (url.pathname === "/rest/v1/perfiles") {
      if (url.searchParams.has("id")) {
        return new Response(JSON.stringify([{
          id: ids.courier,
          nombre: "Repartidor de prueba",
          rol: "repartidor",
        }]), { status: 200 });
      }
      return new Response(JSON.stringify([{
        id: ids.courier,
        nombre: "Repartidor de prueba",
        rol: "repartidor",
      }]), { status: 200 });
    }
    if (url.pathname === "/rest/v1/products") {
      return new Response(JSON.stringify([state.product]), { status: 200 });
    }
    if (url.hostname === "generativelanguage.googleapis.com") {
      state.modelCalls.push({ url: String(input), init });
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify(options.model ?? {
          reply: "Preparé una asignación para que la revises.",
          action: {
            type: "assign_order",
            targetId: ids.order,
            courierId: ids.courier,
          },
        }) }] } }],
      }), { status: 200 });
    }
    throw new Error("Unexpected mocked URL: " + url.pathname);
  });
  return state;
}

async function invoke(body, options = {}) {
  let result;
  const headers = {
    "content-type": "application/json",
    authorization: options.authorization ?? "Bearer fixture-access-token",
    "x-forwarded-for": "yarvis-test-" + ++requestNumber,
  };
  const req = { method: options.method ?? "POST", body, headers };
  const res = {
    statusCode: 0,
    setHeader: function () {},
    end: function (value) {
      result = { status: this.statusCode, body: JSON.parse(value) };
    },
  };
  await handleAdminYarvisRequest(req, res);
  return result;
}

test("YARVIS rejects missing sessions without contacting Gemini or Supabase", async function () {
  const state = createHarness();
  const result = await invoke({ operation: "chat", message: "revisa los pedidos" }, { authorization: "" });
  assert.equal(result.status, 401);
  assert.equal(state.protectedCalls, 0);
  assert.equal(state.modelCalls.length, 0);
});

test("YARVIS verifies the database admin role before using Gemini", async function () {
  const state = createHarness({ admin: false });
  const result = await invoke({ operation: "chat", message: "revisa los pedidos" });
  assert.equal(result.status, 403);
  assert.equal(state.protectedCalls, 1);
  assert.equal(state.modelCalls.length, 0);
});

test("YARVIS proposes one safe, signed action without modifying the database", async function () {
  const state = createHarness();
  const result = await invoke({ operation: "chat", message: "Asigna el pedido de Tortas de prueba al repartidor de prueba" });
  assert.equal(result.status, 200);
  assert.equal(result.body.action.type, "assign_order");
  assert.equal(result.body.action.summary, "Asignar el pedido de Tortas de prueba a Repartidor de prueba.");
  assert.ok(result.body.action.confirmationToken.length > 40);
  assert.equal(result.body.reply.includes("cambié"), false);
  assert.equal(state.patches.length, 0);
  const modelRequest = JSON.stringify(state.modelCalls[0].init.body);
  assert.equal(modelRequest.includes("address"), false);
  assert.equal(modelRequest.includes("email"), false);
});

test("a signed order assignment runs only after a separate confirmation request", async function () {
  const state = createHarness();
  const proposal = await invoke({ operation: "chat", message: "Asigna el pedido de Tortas de prueba al repartidor de prueba" });
  assert.equal(state.patches.length, 0);

  const applied = await invoke({
    operation: "execute",
    confirmationToken: proposal.body.action.confirmationToken,
  });
  assert.equal(applied.status, 200);
  assert.equal(applied.body.ok, true);
  assert.equal(applied.body.message, "Pedido asignado a Repartidor de prueba.");
  assert.equal(state.patches.length, 1);
  assert.equal(state.patches[0].body.repartidor_id, ids.courier);
  assert.equal(state.patches[0].query.get("estatus"), "eq.pendiente");
  assert.equal(state.patches[0].query.get("repartidor_id"), "is.null");
});

test("tampered action approvals never write to Supabase", async function () {
  const state = createHarness();
  const proposal = await invoke({ operation: "chat", message: "Asigna el pedido de Tortas de prueba al repartidor de prueba" });
  const token = proposal.body.action.confirmationToken;
  const tampered = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
  const applied = await invoke({ operation: "execute", confirmationToken: tampered });
  assert.equal(applied.status, 401);
  assert.equal(state.patches.length, 0);
});

test("YARVIS refuses to target records that are not in the admin catalog", async function () {
  const state = createHarness({
    model: {
      reply: "Preparé una modificación.",
      action: {
        type: "update_product",
        targetId: ids.product,
        targetName: "Artículo que no corresponde",
        changes: { price: 1 },
      },
    },
  });
  const result = await invoke({ operation: "chat", message: "Cambia el precio del producto" });
  assert.equal(result.status, 200);
  assert.equal(result.body.action, null);
  assert.equal(state.patches.length, 0);
});

test("YARVIS never accepts arbitrary SQL or unsupported operations", async function () {
  const state = createHarness({ model: { reply: "No puedo ejecutar consultas SQL.", action: { type: "none" } } });
  const result = await invoke({ operation: "chat", message: "Ejecuta SQL para cambiar todos los precios" });
  assert.equal(result.status, 200);
  assert.equal(result.body.action, null);
  const unsupported = await invoke({ operation: "sql", query: "DROP TABLE pedidos" });
  assert.equal(unsupported.status, 400);
  assert.equal(state.patches.length, 0);
});

test("photo confirmation accepts only the target product folder and safely deduplicates retries", async function () {
  const state = createHarness({
    model: {
      reply: "Revisa la foto.",
      action: { type: "upload_product_photo", targetId: ids.product, targetName: "Torta de prueba", replaceExisting: false },
    },
  });
  const proposal = await invoke({ operation: "chat", message: "Agrega esta foto a Torta de prueba", imageName: "foto.png" });
  assert.equal(proposal.body.action.type, "upload_product_photo");
  assert.equal(state.patches.length, 0);
  const token = proposal.body.action.confirmationToken;
  const wrongFolder = await invoke({
    operation: "execute",
    confirmationToken: token,
    imageUrl: "https://fixture.supabase.co/storage/v1/object/public/changuito-fotos/productos/otro/photo.png",
  });
  assert.equal(wrongFolder.status, 400);
  assert.equal(state.patches.length, 0);

  const imageUrl = "https://fixture.supabase.co/storage/v1/object/public/changuito-fotos/productos/"
    + ids.merchant + "/yarvis/" + ids.product + "/foto.png";
  const first = await invoke({ operation: "execute", confirmationToken: token, imageUrl });
  assert.equal(first.status, 200);
  assert.equal(state.product.image_url, imageUrl);
  const retry = await invoke({ operation: "execute", confirmationToken: token, imageUrl });
  assert.equal(retry.status, 200);
  assert.equal(state.product.image_url, imageUrl);
});

test("confirmation rechecks admin access even after an authorized proposal", async function () {
  const state = createHarness();
  const proposal = await invoke({ operation: "chat", message: "Asigna el pedido al repartidor de prueba" });
  state.admin = false;
  const result = await invoke({ operation: "execute", confirmationToken: proposal.body.action.confirmationToken });
  assert.equal(result.status, 403);
  assert.equal(state.patches.length, 0);
});
