import assert from "node:assert/strict";
import { it } from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const testUrl = process.env.SUPABASE_RLS_TEST_URL;
const anonKey = process.env.SUPABASE_RLS_TEST_ANON_KEY;
const accountValues = {
  admin: [process.env.SUPABASE_RLS_ADMIN_EMAIL, process.env.SUPABASE_RLS_ADMIN_PASSWORD],
  customer: [process.env.SUPABASE_RLS_CUSTOMER_EMAIL, process.env.SUPABASE_RLS_CUSTOMER_PASSWORD],
  courier: [process.env.SUPABASE_RLS_COURIER_EMAIL, process.env.SUPABASE_RLS_COURIER_PASSWORD],
  merchant: [process.env.SUPABASE_RLS_MERCHANT_EMAIL, process.env.SUPABASE_RLS_MERCHANT_PASSWORD],
};
const configuredValues = [testUrl, anonKey, ...Object.values(accountValues).flat()].filter(Boolean).length;

if (configuredValues > 0 && configuredValues < 10) {
  throw new Error(
    "Set the local SUPABASE_RLS_TEST_URL, SUPABASE_RLS_TEST_ANON_KEY, and email/password pairs for admin, customer, courier, and merchant.",
  );
}

function assertLocalTestConfiguration() {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(testUrl as string);
  } catch {
    throw new Error("SUPABASE_RLS_TEST_URL must point to local Supabase.");
  }

  if (
    parsedUrl.protocol !== "http:" ||
    !["127.0.0.1", "localhost"].includes(parsedUrl.hostname) ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    throw new Error(
      "RLS integration tests only run against local Supabase at localhost or 127.0.0.1.",
    );
  }
  assert.equal(
    accountValues.admin[0]?.toLowerCase(),
    "uliseseven.7@gmail.com",
    "The admin fixture must use the designated admin email.",
  );
  for (const [role, [email, password]] of Object.entries(accountValues)) {
    assert.ok(email?.toLowerCase().endsWith("@example.test"), `${role} must be a local test account.`);
    assert.ok(password, `${role} must have a test password.`);
  }
}

function makeClient() {
  return createClient(testUrl as string, anonKey as string, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}

async function signIn(role: keyof typeof accountValues) {
  const client = makeClient();
  const [email, password] = accountValues[role];
  const result = await client.auth.signInWithPassword({
    email: email as string,
    password: password as string,
  });
  assert.equal(result.error, null, `Could not sign in the ${role} test account.`);
  assert.ok(result.data.user, `The ${role} test account must exist.`);
  return { client, user: result.data.user };
}

type Row = Record<string, unknown>;

async function readRows(client: SupabaseClient, table: string) {
  const result = await client.from(table).select("*");
  assert.equal(result.error, null, `The admin must be able to read ${table}.`);
  return result.data as Row[];
}

async function assertNoRows(result: { data: unknown[] | null; error: unknown }, message: string) {
  assert.ok(result.error || !result.data?.length, message);
}

it(
  "enforces admin-data access through authenticated REST and RPC requests",
  { skip: configuredValues === 0 },
  async function () {
    assertLocalTestConfiguration();
    const signedIn = await Promise.all(
      (Object.keys(accountValues) as (keyof typeof accountValues)[]).map(signIn),
    );
    const clients = Object.fromEntries(
      (Object.keys(accountValues) as (keyof typeof accountValues)[]).map((role, index) => [
        role,
        signedIn[index].client,
      ]),
    ) as Record<keyof typeof accountValues, SupabaseClient>;

    try {
      const admin = signedIn[0];
      const customer = signedIn[1];
      const courier = signedIn[2];
      const merchant = signedIn[3];
      assert.equal(admin.user.email?.toLowerCase(), "uliseseven.7@gmail.com");

      const [profiles, orders, wallets, requests, merchants] = await Promise.all([
        readRows(clients.admin, "perfiles"),
        readRows(clients.admin, "pedidos"),
        readRows(clients.admin, "monedero_cliente"),
        readRows(clients.admin, "solicitudes_rol"),
        readRows(clients.admin, "merchants"),
      ]);

      const profileFor = function (id: string) {
        return profiles.find(function (row) { return row.id === id; });
      };
      const adminProfile = profileFor(admin.user.id);
      assert.ok(adminProfile, "The admin must be able to read their profile.");
      assert.ok(profileFor(customer.user.id), "The admin must be able to read customer profiles.");
      assert.ok(profileFor(courier.user.id), "The admin must be able to read courier profiles.");
      assert.ok(profileFor(merchant.user.id), "The admin must be able to read merchant profiles.");

      const customerOrder = orders.find(function (row) {
        return row.cliente_id === customer.user.id && row.estatus !== "entregado";
      });
      const unrelatedOrder = orders.find(function (row) {
        return row.cliente_id !== customer.user.id && row.repartidor_id !== courier.user.id;
      });
      const courierOrder = orders.find(function (row) { return row.repartidor_id === courier.user.id; });
      const otherCourierOrder = orders.find(function (row) {
        return row.repartidor_id && row.repartidor_id !== courier.user.id;
      });
      const availableOrder = orders.find(function (row) {
        return row.estatus === "pendiente" && !row.repartidor_id;
      });
      const merchantRecord = merchants.find(function (row) { return row.owner_id === merchant.user.id; });
      assert.ok(customerOrder, "Seed a customer-owned order in local Supabase.");
      assert.ok(unrelatedOrder, "Seed an unrelated order in local Supabase.");
      assert.ok(courierOrder, "Seed an order assigned to the courier fixture.");
      assert.ok(otherCourierOrder, "Seed an order assigned to a different courier.");
      assert.ok(availableOrder, "Seed an unassigned pending order for courier pickup.");
      assert.ok(merchantRecord, "Seed a merchant owned by the merchant fixture.");
      const merchantOrder = orders.find(function (row) { return row.negocio_id === merchantRecord.id; });
      const otherMerchantOrder = orders.find(function (row) { return row.negocio_id !== merchantRecord.id; });
      assert.ok(merchantOrder, "Seed an order for the merchant fixture.");
      assert.ok(otherMerchantOrder, "Seed an order for another merchant.");
      const customerWallet = wallets.find(function (row) { return row.user_id === customer.user.id; });
      const otherWallet = wallets.find(function (row) { return row.user_id !== customer.user.id; });
      const otherRequest = requests.find(function (row) { return row.user_id !== customer.user.id; });
      assert.ok(customerWallet, "Seed a wallet for the customer fixture.");
      assert.ok(otherWallet, "Seed a wallet for another account.");
      assert.ok(otherRequest, "Seed a role request belonging to another account.");

      for (const [table, column, id] of [
        ["perfiles", "id", customer.user.id],
        ["monedero_cliente", "user_id", customer.user.id],
        ["solicitudes_rol", "user_id", customer.user.id],
      ] as const) {
        const result = await clients.admin.from(table).select("*").eq(column, id);
        assert.equal(result.error, null, `Admin reads for ${table} should succeed.`);
      }

      for (const [table, column, id] of [
        ["perfiles", "id", customer.user.id],
        ["monedero_cliente", "user_id", customer.user.id],
        ["solicitudes_rol", "user_id", customer.user.id],
      ] as const) {
        const result = await clients.customer.from(table).select("*").eq(column, id);
        assert.equal(result.error, null, `An account may read its own ${table} record.`);
        assert.ok(result.data?.length, `The customer should see their own ${table} record.`);
      }

      await assertNoRows(
        await clients.customer.from("perfiles").select("*").eq("id", courier.user.id),
        "A customer must not read another user's private profile.",
      );
      await assertNoRows(
        await clients.customer.from("monedero_cliente").select("*").eq("user_id", otherWallet.user_id as string),
        "A customer must not read another user's wallet.",
      );
      await assertNoRows(
        await clients.customer.from("solicitudes_rol").select("*").eq("id", otherRequest.id as string),
        "A customer must not read another user's role request.",
      );
      await assertNoRows(
        await clients.customer.from("pedidos").select("*").eq("id", unrelatedOrder.id as string),
        "A customer must not read an unrelated order.",
      );
      for (const [table, column, id, value] of [
        ["monedero_cliente", "user_id", otherWallet.user_id as string, otherWallet.saldo_cashback],
        ["solicitudes_rol", "id", otherRequest.id as string, otherRequest.estado],
      ] as const) {
        const result = await clients.customer.from(table).update(
          table === "monedero_cliente" ? { saldo_cashback: value } : { estado: value },
        ).eq(column, id).select(column);
        await assertNoRows(result, `A customer must not modify protected ${table} data.`);
      }
      const selfRoleEscalation = await clients.customer.from("perfiles")
        .update({ rol: "repartidor" }).eq("id", customer.user.id).select("id");
      await assertNoRows(selfRoleEscalation, "A customer must not grant themselves a privileged role.");

      const customerOrders = await clients.customer.from("pedidos").select("id").eq("cliente_id", customer.user.id);
      assert.equal(customerOrders.error, null);
      assert.ok(customerOrders.data?.some(function (row) { return row.id === customerOrder.id; }));

      const courierOrders = await clients.courier.from("pedidos").select("id");
      assert.equal(courierOrders.error, null);
      assert.ok(courierOrders.data?.some(function (row) { return row.id === courierOrder.id; }));
      assert.ok(courierOrders.data?.some(function (row) { return row.id === availableOrder.id; }));
      assert.ok(!courierOrders.data?.some(function (row) { return row.id === otherCourierOrder.id; }),
        "A courier must not read another courier's assigned order.");
      const courierOwnUpdate = await clients.courier.from("pedidos")
        .update({ estatus: courierOrder.estatus })
        .eq("id", courierOrder.id as string).select("id");
      assert.equal(courierOwnUpdate.error, null);
      assert.ok(courierOwnUpdate.data?.length,
        "A courier must retain the ability to update their assigned order.");
      const courierUpdate = await clients.courier.from("pedidos")
        .update({ estatus: otherCourierOrder.estatus }).eq("id", otherCourierOrder.id as string).select("id");
      await assertNoRows(courierUpdate, "A courier must not update another courier's order.");

      const merchantOrdersResult = await clients.merchant.from("pedidos").select("id");
      assert.equal(merchantOrdersResult.error, null);
      assert.ok(merchantOrdersResult.data?.some(function (row) { return row.id === merchantOrder.id; }));
      assert.ok(!merchantOrdersResult.data?.some(function (row) { return row.id === otherMerchantOrder.id; }),
        "A merchant must not read another merchant's orders.");
      const merchantOrderUpdate = await clients.merchant.from("pedidos")
        .update({ estatus: merchantOrder.estatus })
        .eq("id", merchantOrder.id as string).select("id");
      await assertNoRows(merchantOrderUpdate, "A merchant must not update order operations directly.");

      const adminWalletUpdate = await clients.admin.from("monedero_cliente")
        .update({ saldo_cashback: otherWallet.saldo_cashback })
        .eq("user_id", otherWallet.user_id as string).select("user_id");
      assert.equal(adminWalletUpdate.error, null);
      assert.ok(adminWalletUpdate.data?.length, "The admin must be able to update a protected wallet.");
      const adminOrderUpdate = await clients.admin.from("pedidos")
        .update({ estatus: customerOrder.estatus })
        .eq("id", customerOrder.id as string).select("id");
      assert.equal(adminOrderUpdate.error, null);
      assert.ok(adminOrderUpdate.data?.length, "The admin must be able to update order status.");

      const unauthorizedStatus = await clients.customer.rpc("cambiar_estatus_pedido", {
        p_id: customerOrder.id,
        p_estatus: customerOrder.estatus,
      });
      assert.equal(unauthorizedStatus.error, null);
      assert.equal((unauthorizedStatus.data as Row).error, "Sin permisos.");
      const unauthorizedApproval = await clients.customer.rpc("resolver_solicitud_rol", {
        p_solicitud_id: otherRequest.id,
        p_decision: "rechazado",
      });
      assert.equal(unauthorizedApproval.error, null);
      assert.equal((unauthorizedApproval.data as Row).error, "Solo el admin puede resolver solicitudes.");

      const adminStatus = await clients.admin.rpc("cambiar_estatus_pedido", {
        p_id: customerOrder.id,
        p_estatus: customerOrder.estatus,
      });
      assert.equal(adminStatus.error, null);
      assert.equal((adminStatus.data as Row).ok, true, "The admin must be authorized to use the status RPC.");

      const originalRequestState = otherRequest.estado;
      try {
        const adminApproval = await clients.admin.rpc("resolver_solicitud_rol", {
          p_solicitud_id: otherRequest.id,
          p_decision: "rechazado",
        });
        assert.equal(adminApproval.error, null);
        assert.equal((adminApproval.data as Row).ok, true,
          "The admin must be authorized to resolve a role request.");
      } finally {
        const restoreRequest = await clients.admin.from("solicitudes_rol")
          .update({ estado: originalRequestState })
          .eq("id", otherRequest.id as string);
        assert.equal(restoreRequest.error, null, "The role-request fixture state must be restored.");
      }
    } finally {
      await Promise.all(Object.values(clients).map(function (client) {
        return client.auth.signOut({ scope: "local" }).catch(function () {});
      }));
    }
  },
);
