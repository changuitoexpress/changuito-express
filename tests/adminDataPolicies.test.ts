import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

const setupSql = readFileSync(new URL("../supabase_setup.sql", import.meta.url), "utf8");

function readPolicy(name: string, table: string): string {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedTable = table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = setupSql.match(
    new RegExp(`CREATE POLICY ${escapedName} ON public\\.${escapedTable}[\\s\\S]*?;`),
  );
  assert.ok(match, `Expected ${name} policy on ${table} in supabase_setup.sql`);
  return match[0];
}

it("enables row-level security on private admin data tables", function () {
  for (const table of ["perfiles", "pedidos", "solicitudes_rol", "monedero_cliente"]) {
    assert.match(
      setupSql,
      new RegExp(`ALTER TABLE(?: IF EXISTS)? public\\.${table} ENABLE ROW LEVEL SECURITY`),
      `${table} must enforce row-level security`,
    );
  }
});

it("limits profiles, wallets, and role requests to their owner or the designated admin", function () {
  const policies = [
    readPolicy("perfiles_self_or_admin_select", "perfiles"),
    readPolicy("perfiles_self_or_admin_select_guard", "perfiles"),
    readPolicy("monedero_cliente_self_or_admin_select", "monedero_cliente"),
    readPolicy("monedero_cliente_select_guard", "monedero_cliente"),
    readPolicy("solicitudes_admin_select", "solicitudes_rol"),
    readPolicy("solicitudes_admin_select_guard", "solicitudes_rol"),
  ];

  for (const policy of policies) {
    assert.match(policy, /public\.is_changuito_admin\(\)/);
    assert.match(policy, /auth\.uid\(\)/);
    assert.doesNotMatch(policy, /USING\s*\(\s*true\s*\)/i);
  }
});

it("scopes order reads to customers, assigned or eligible couriers, merchants, and admin", function () {
  const selectPolicy = readPolicy("pedidos_select_auth", "pedidos");
  const selectGuard = readPolicy("pedidos_select_scope_guard", "pedidos");

  for (const policy of [selectPolicy, selectGuard]) {
    assert.match(policy, /public\.is_changuito_admin\(\)/);
    assert.match(policy, /cliente_id\s*=\s*auth\.uid\(\)/);
    assert.match(policy, /repartidor_id\s*=\s*auth\.uid\(\)/);
    assert.match(policy, /estatus\s*=\s*'pendiente'\s+AND\s+repartidor_id\s+IS\s+NULL/);
    assert.match(policy, /m\.owner_id\s*=\s*auth\.uid\(\)/);
    assert.match(policy, /merchant_admins/);
    assert.doesNotMatch(policy, /USING\s*\(\s*true\s*\)/i);
  }
  assert.match(selectGuard, /AS RESTRICTIVE FOR SELECT/);
});

it("restricts order writes, wallet changes, and role-request resolution", function () {
  const orderUpdate = readPolicy("pedidos_update_scope_guard", "pedidos");
  const walletUpdate = readPolicy("monedero_cliente_update_guard", "monedero_cliente");
  const requestUpdate = readPolicy("solicitudes_admin_update_guard", "solicitudes_rol");

  assert.match(orderUpdate, /public\.is_changuito_admin\(\)/);
  assert.match(orderUpdate, /repartidor_id\s*=\s*auth\.uid\(\)/);
  assert.match(orderUpdate, /p\.rol\s*=\s*'repartidor'/);
  assert.match(walletUpdate, /AS RESTRICTIVE FOR UPDATE/);
  assert.match(walletUpdate, /public\.is_changuito_admin\(\)/);
  assert.match(requestUpdate, /AS RESTRICTIVE FOR UPDATE/);
  assert.match(requestUpdate, /public\.is_changuito_admin\(\)/);
  assert.match(setupSql, /GRANT UPDATE \(estatus, repartidor_id\) ON public\.pedidos TO authenticated/);
});

it("checks admin identity inside privileged role and order RPCs", function () {
  for (const [name, nextSection] of [
    ["cambiar_estatus_pedido", "tomar_pedido_repartidor"],
    ["resolver_solicitud_rol", "Keep merchant details"],
  ]) {
    const start = setupSql.indexOf(`FUNCTION ${name}`);
    assert.notEqual(start, -1, `Expected ${name} in supabase_setup.sql`);
    const end = setupSql.indexOf(nextSection, start);
    assert.notEqual(end, -1, `Expected the end boundary after ${name}`);
    const functionSql = setupSql.slice(start, end);
    assert.match(functionSql, /SECURITY DEFINER/);
    assert.match(functionSql, /IF NOT public\.is_changuito_admin\(\) THEN/);
  }
});
