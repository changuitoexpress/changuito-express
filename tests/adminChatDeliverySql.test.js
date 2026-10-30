import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const sql = readFileSync(
  new URL("../supabase_admin_upgrade.sql", import.meta.url),
  "utf8",
);

test("installs the database-side admin check before the delivery RPC", function () {
  const adminCheck = sql.indexOf("FUNCTION public.is_changuito_admin()");
  const deliveryRpc = sql.indexOf("FUNCTION public.cambiar_estatus_pedido");
  assert.ok(adminCheck >= 0 && deliveryRpc > adminCheck);
  assert.match(sql, /lower\(auth\.jwt\(\) ->> 'email'\)\s*=\s*'uliseseven\.7@gmail\.com'/);
  assert.match(sql, /DROP FUNCTION IF EXISTS public\.cambiar_estatus_pedido\(uuid, text\)/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.cambiar_estatus_pedido\(uuid, text\) TO authenticated/);
});

test("keeps customer/courier conversations scoped to their own assigned order", function () {
  const policies = sql.match(/CREATE POLICY \S+ ON public\.mensajes_chat[\s\S]*?;/g) ?? [];
  assert.ok(policies.length >= 4);
  const chatSql = policies.join("\n");
  assert.match(chatSql, /p\.cliente_id = auth\.uid\(\) AND p\.repartidor_id IS NOT NULL/);
  assert.match(chatSql, /p\.repartidor_id = auth\.uid\(\)/);
  assert.match(chatSql, /autor_id = auth\.uid\(\)/);
  assert.match(chatSql, /AS RESTRICTIVE FOR SELECT/);
  assert.match(chatSql, /AS RESTRICTIVE FOR INSERT/);
  assert.doesNotMatch(chatSql, /USING\s*\(\s*true\s*\)/i);
});

test("stores chat photos in a private, participant-scoped bucket", function () {
  assert.match(sql, /'chat-pedidos',\s*'chat-pedidos',\s*false/);
  assert.match(sql, /chat_pedidos_select_scope_guard/);
  assert.match(sql, /chat_pedidos_insert_scope_guard/);
  assert.match(sql, /ALTER PUBLICATION supabase_realtime ADD TABLE public\.mensajes_chat/);
});
