import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

const setupSql = readFileSync(new URL("../supabase_setup.sql", import.meta.url), "utf8");

function readPolicy(name: string): string {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = setupSql.match(
    new RegExp(`CREATE POLICY ${escapedName} ON public\\.mensajes_chat[\\s\\S]*?;`),
  );
  assert.ok(match, `Expected ${name} policy in supabase_setup.sql`);
  return match[0];
}

it("limits chat reads to the designated admin, order customer, or assigned courier", function () {
  const selectPolicy = readPolicy("mensajes_select");
  const selectGuard = readPolicy("mensajes_select_scope_guard");

  for (const policy of [selectPolicy, selectGuard]) {
    assert.match(policy, /public\.is_changuito_admin\(\)/);
    assert.match(policy, /p\.cliente_id\s*=\s*auth\.uid\(\)/);
    assert.match(policy, /p\.repartidor_id\s*=\s*auth\.uid\(\)/);
    assert.match(policy, /perfil\.rol\s*=\s*'repartidor'/);
    assert.doesNotMatch(policy, /USING\s*\(\s*true\s*\)/i);
  }
  assert.match(selectGuard, /AS RESTRICTIVE FOR SELECT/);
});

it("keeps chat inserts tied to an authorized order participant and matching role", function () {
  const insertPolicy = readPolicy("mensajes_insert");
  const insertGuard = readPolicy("mensajes_insert_scope_guard");

  for (const policy of [insertPolicy, insertGuard]) {
    assert.match(policy, /autor_id\s*=\s*auth\.uid\(\)/);
    assert.match(policy, /p\.cliente_id\s*=\s*auth\.uid\(\)\s+AND autor_rol\s*=\s*'cliente'/);
    assert.match(policy, /p\.repartidor_id\s*=\s*auth\.uid\(\)/);
    assert.match(policy, /autor_rol\s*=\s*'repartidor'/);
    assert.match(policy, /public\.is_changuito_admin\(\)\s+AND autor_rol\s*=\s*'admin'/);
  }
  assert.match(insertGuard, /AS RESTRICTIVE FOR INSERT/);
});
