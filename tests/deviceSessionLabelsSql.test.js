import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const sql = readFileSync(new URL("../supabase_setup.sql", import.meta.url), "utf8");

test("keeps device labels private and scopes reads to the signed-in owner", function () {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.device_session_labels/);
  assert.match(sql, /ALTER TABLE public\.device_session_labels ENABLE ROW LEVEL SECURITY/);
  assert.match(
    sql,
    /REVOKE ALL ON TABLE public\.device_session_labels FROM PUBLIC, anon, authenticated/,
  );
  assert.match(sql, /labels\.user_id = s\.user_id/);
  assert.match(sql, /WHERE s\.user_id = auth\.uid\(\)/);
  assert.match(
    sql,
    /REVOKE ALL ON FUNCTION public\.list_my_device_sessions\(\) FROM PUBLIC, anon/,
  );
  assert.match(
    sql,
    /GRANT EXECUTE ON FUNCTION public\.list_my_device_sessions\(\) TO authenticated/,
  );
});

test("limits label writes to the caller's active sessions", function () {
  const labelFunction = sql.slice(
    sql.indexOf("CREATE OR REPLACE FUNCTION public.set_my_device_session_label"),
    sql.indexOf("REVOKE ALL ON FUNCTION public.set_my_device_session_label"),
  );
  assert.match(labelFunction, /s\.user_id = auth\.uid\(\)/);
  assert.match(labelFunction, /s\.id = p_session_id/);
  assert.match(labelFunction, /s\.not_after IS NULL OR s\.not_after > now\(\)/);
  assert.match(labelFunction, /VALUES \(auth\.uid\(\), p_session_id, v_label, now\(\)\)/);
  assert.match(labelFunction, /char_length\(v_label\) > 40/);
  assert.match(
    sql,
    /REVOKE ALL ON FUNCTION public\.set_my_device_session_label\(uuid, text\) FROM PUBLIC, anon/,
  );
  assert.match(
    sql,
    /GRANT EXECUTE ON FUNCTION public\.set_my_device_session_label\(uuid, text\) TO authenticated/,
  );
});
