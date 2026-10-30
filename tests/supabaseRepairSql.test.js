import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const upgrade = readFileSync(new URL("../supabase_admin_upgrade.sql", import.meta.url), "utf8");
const repair = upgrade.slice(upgrade.indexOf("-- 6. REPARACION_BASE_SEGURA"));

test("repairs the live schema atomically without deleting or recalculating existing data", function () {
  assert.ok(repair.startsWith("-- 6. REPARACION_BASE_SEGURA"));
  assert.match(repair, /\bBEGIN;/);
  assert.match(repair, /COMMIT;\s*$/);
  assert.match(repair, /lock_timeout = '5s'/);
  assert.doesNotMatch(repair, /\b(?:DROP TABLE|TRUNCATE|DELETE FROM)\b/i);
  assert.match(repair, /HAVING count\(\*\) > 1/);
  assert.match(repair, /CREATE UNIQUE INDEX IF NOT EXISTS monedero_cliente_user_id_unique/);
  assert.match(repair, /ADD COLUMN IF NOT EXISTS envios_gratis_usados/);
  assert.match(repair, /ADD COLUMN IF NOT EXISTS updated_at/);
});

test("keeps the catalog readable while restricting merchant authority and legacy user records", function () {
  assert.match(repair, /ALTER TABLE public\.merchants ENABLE ROW LEVEL SECURITY/);
  assert.match(repair, /GRANT SELECT ON public\.merchants TO anon, authenticated/);
  assert.match(repair, /ma\.rol IN \('owner', 'editor'\)/);
  for (const field of ["owner_id", "owner_email", "commission", "cashback_pct"]) {
    assert.ok(repair.includes("OLD." + field + " IS DISTINCT FROM NEW." + field));
  }
  assert.match(repair, /ALTER TABLE public\.usuarios ENABLE ROW LEVEL SECURITY/);
  assert.match(repair, /usuarios_repair_scope_guard[\s\S]*?AS RESTRICTIVE/);
});

test("scopes orders and prevents clients from changing totals or inserting delivered orders", function () {
  assert.match(repair, /pedidos_repair_select_guard[\s\S]*?AS RESTRICTIVE FOR SELECT/);
  assert.match(repair, /p_cliente = auth\.uid\(\)/);
  assert.match(repair, /p_repartidor = auth\.uid\(\)/);
  assert.match(repair, /m\.owner_id = auth\.uid\(\)/);
  assert.match(repair, /GRANT UPDATE \(estatus, repartidor_id\) ON public\.pedidos/);
  assert.match(repair, /REVOKE UPDATE \(%I\), INSERT \(%I\)/);
  assert.match(repair, /estatus = 'pendiente' AND repartidor_id IS NULL/);
  assert.match(repair, /cliente_id = auth\.uid\(\)/);
});

test("protects account roles and all wallet reward fields against self-escalation", function () {
  assert.match(repair, /OLD\.rol IS DISTINCT FROM NEW\.rol/);
  assert.match(repair, /BEFORE INSERT OR UPDATE ON public\.perfiles/);
  for (const field of ["saldo_cashback", "saldo_puntos", "pedidos_realizados"]) {
    assert.ok(repair.includes("COALESCE(" + field + ", 0) = 0"));
  }
  assert.match(repair, /envios_gratis_usados = 0/);
  assert.match(repair, /monedero_repair_update_guard[\s\S]*?USING \(public\.is_changuito_admin\(\)\)/);
});

test("restores guarded courier claims and atomic reward redemption with matching client signatures", function () {
  assert.match(repair, /FUNCTION public\.tomar_pedido_repartidor\(p_pedido_id uuid, p_repartidor_id uuid\)/);
  assert.match(repair, /p_repartidor_id IS DISTINCT FROM auth\.uid\(\)/);
  assert.match(repair, /WHERE id = p_pedido_id AND estatus = 'pendiente' AND repartidor_id IS NULL/);
  assert.match(repair, /FUNCTION public\.crear_pedido_con_envio_gratis\(/);
  assert.match(repair, /FROM public\.monedero_cliente WHERE user_id = auth\.uid\(\) FOR UPDATE/);
  assert.match(repair, /floor\(v_entregados \/ 10\.0\)::integer <= v_usados/);
  assert.match(repair, /ON CONFLICT \(user_id\) DO NOTHING/);
  assert.match(repair, /FROM PUBLIC, anon/);
});
