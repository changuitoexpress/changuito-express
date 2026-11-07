import { test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";

async function availablePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise(function (done) { server.close(done); });
  return port;
}
function launch(port) {
  const child = spawn(process.execPath, ["scripts/dev-server.mjs", "--port", String(port)], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", function (chunk) { output += chunk; });
  child.stderr.on("data", function (chunk) { output += chunk; });
  const exit = once(child, "exit");
  return { child, exit, output: function () { return output; } };
}
async function ready(instance) {
  for (let i = 0; i < 150; i++) {
    if (instance.output().includes("Servidor de desarrollo administrado")) return;
    if (instance.child.exitCode !== null) throw new Error(instance.output());
    await delay(100);
  }
  throw new Error("El servidor no arrancó: " + instance.output());
}
test("managed Vite rejects duplicates and releases its port on workflow stop and restart", { timeout: 40000 }, async function () {
  const port = await availablePort();
  const instances = [];
  try {
    const first = launch(port);
    instances.push(first);
    await ready(first);
    assert.equal((await fetch("http://127.0.0.1:" + port)).status, 200);
    const duplicate = launch(port);
    instances.push(duplicate);
    const [code] = await duplicate.exit;
    assert.equal(code, 1);
    assert.match(duplicate.output(), /already in use/);
    assert.equal(first.child.exitCode, null, "duplicate must not kill the owner");
    first.child.kill("SIGTERM");
    assert.equal((await first.exit)[0], 0);
    const restarted = launch(port);
    instances.push(restarted);
    await ready(restarted);
    assert.equal((await fetch("http://127.0.0.1:" + port)).status, 200);
    restarted.child.kill("SIGINT");
    assert.equal((await restarted.exit)[0], 0);
  } finally {
    for (const instance of instances) {
      if (instance.child.exitCode === null) instance.child.kill("SIGKILL");
      await instance.exit;
    }
  }
});
