import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { afterEach, mock, test } from "node:test";
import { handleMercadoPagoRequest } from "../server/mercadoPago.js";

const ids = {
  customer: "123e4567-e89b-42d3-a456-426614174000",
  merchant: "223e4567-e89b-42d3-a456-426614174001",
  product: "323e4567-e89b-42d3-a456-426614174002",
  checkout: "423e4567-e89b-42d3-a456-426614174003",
};

process.env.VITE_SUPABASE_URL = "https://fixture.supabase.co";
process.env.VITE_SUPABASE_ANON_KEY = "fixture-anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-service-role";
process.env.MERCADOPAGO_ACCESS_TOKEN = "fixture-test-token";

afterEach(function () {
  mock.restoreAll();
  delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
  delete process.env.VERCEL;
});

function createResponse() {
  const response = {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(value) {
      this.body = value ?? "";
    },
    json() {
      return JSON.parse(this.body);
    },
  };
  return response;
}

function createRequest(action, options = {}) {
  const headers = {
    "content-type": "application/json",
    ...(options.headers ?? {}),
  };
  return {
    method: options.method ?? (action === "status" ? "GET" : "POST"),
    url: options.url ?? "/api/mercadopago/" + action,
    headers,
    body: options.body,
    socket: { remoteAddress: "127.0.0.1" },
  };
}

test("payment preference uses live catalog prices and creates no order before approval", async function () {
  let checkoutBody;
  let preferenceBody;
  const clientIp = "192.0.2.10";
  mock.method(globalThis, "fetch", async function (input, init = {}) {
    const url = new URL(String(input));
    if (url.pathname === "/auth/v1/user") {
      return new Response(JSON.stringify({ id: ids.customer, email: "customer@example.test" }), {
        status: 200,
      });
    }
    if (url.pathname === "/rest/v1/products") {
      return new Response(JSON.stringify([{
        id: ids.product,
        merchant_id: ids.merchant,
        name: "Producto real",
        price: 100,
        is_available: true,
      }]), { status: 200 });
    }
    if (url.pathname === "/rest/v1/merchants") {
      return new Response(JSON.stringify([{
        id: ids.merchant,
        name: "Negocio de prueba",
        is_open: true,
      }]), { status: 200 });
    }
    if (url.pathname === "/rest/v1/mercadopago_checkouts" && init.method !== "POST" && init.method !== "PATCH") {
      return new Response(JSON.stringify([]), { status: 200 });
    }
    if (url.pathname === "/rest/v1/mercadopago_checkouts" && init.method === "POST") {
      checkoutBody = JSON.parse(init.body);
      return new Response(JSON.stringify([{
        id: ids.checkout,
        ...checkoutBody,
      }]), { status: 201 });
    }
    if (url.pathname === "/checkout/preferences") {
      preferenceBody = JSON.parse(init.body);
      return new Response(JSON.stringify({
        id: "pref-test-1",
        sandbox_init_point: "https://sandbox.mercadopago.com.mx/checkout/test",
      }), { status: 201 });
    }
    if (url.pathname === "/rest/v1/mercadopago_checkouts" && init.method === "PATCH") {
      return new Response(null, { status: 204 });
    }
    throw new Error("Unexpected test request: " + url.pathname + " " + init.method);
  });

  const req = createRequest("create-preference", {
    headers: {
      authorization: "Bearer fixture-customer-token",
      origin: "https://sample.replit.dev",
      "x-forwarded-for": clientIp,
    },
    body: {
      items: [{ id: ids.product, quantity: 2, price: 0.01 }],
      address: "Calle de prueba 10",
      shipping_zone_id: null,
    },
  });
  const res = createResponse();
  await handleMercadoPagoRequest(req, res, "create-preference");

  assert.equal(res.statusCode, 200);
  assert.equal(res.json().total, 250);
  assert.equal(checkoutBody.total, 250);
  assert.equal(checkoutBody.orders_snapshot[0].items[0].precio_unitario, 100);
  assert.equal(preferenceBody.items[0].unit_price, 250);
  assert.equal(preferenceBody.external_reference, ids.checkout);
  const notificationUrl = new URL(preferenceBody.notification_url);
  assert.equal(notificationUrl.protocol, "https:");
  assert.equal(notificationUrl.pathname, "/api/mercadopago/webhook");
});

test("payment webhook finalizes only a provider-confirmed MXN payment with matching amount", async function () {
  process.env.MERCADOPAGO_WEBHOOK_SECRET = "test-webhook-secret";
  const paymentId = "9001";
  const requestId = "fixture-request-1";
  const timestamp = "1793360000000";
  const manifest = "id:" + paymentId + ";request-id:" + requestId + ";ts:" + timestamp + ";";
  const signature = createHmac("sha256", process.env.MERCADOPAGO_WEBHOOK_SECRET)
    .update(manifest)
    .digest("hex");
  let finalized = false;
  mock.method(globalThis, "fetch", async function (input, init = {}) {
    const url = new URL(String(input));
    if (url.hostname === "api.mercadopago.com" && url.pathname === "/v1/payments/9001") {
      return new Response(JSON.stringify({
        id: paymentId,
        status: "approved",
        currency_id: "MXN",
        transaction_amount: 250,
        external_reference: ids.checkout,
      }), { status: 200 });
    }
    if (url.pathname === "/rest/v1/mercadopago_checkouts") {
      return new Response(JSON.stringify([{
        id: ids.checkout,
        cliente_id: ids.customer,
        total: 250,
        status: "pending",
        expires_at: "2099-01-01T00:00:00.000Z",
      }]), { status: 200 });
    }
    if (url.pathname === "/rest/v1/rpc/confirmar_checkout_mercadopago") {
      finalized = true;
      assert.equal(JSON.parse(init.body).p_mp_payment_id, paymentId);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    throw new Error("Unexpected test request: " + url.pathname);
  });

  const req = createRequest("webhook", {
    url: "/api/mercadopago/webhook?data.id=9001&type=payment",
    headers: {
      "x-signature": "ts=" + timestamp + ",v1=" + signature,
      "x-request-id": requestId,
    },
    body: { data: { id: paymentId }, type: "payment" },
  });
  const res = createResponse();
  await handleMercadoPagoRequest(req, res, "webhook");

  assert.equal(res.statusCode, 200);
  assert.equal(finalized, true);
});

test("payment status requires the checkout owner", async function () {
  const res = createResponse();
  await handleMercadoPagoRequest(
    createRequest("status", { url: "/api/mercadopago/status?checkout_id=" + ids.checkout }),
    res,
    "status",
  );
  assert.equal(res.statusCode, 401);
});
