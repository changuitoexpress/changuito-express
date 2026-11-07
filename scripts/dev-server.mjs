import { createServer } from "vite";

// Run Vite in the workflow process, not in an npm -> shell -> Vite child chain.
const portIndex = process.argv.indexOf("--port");
const port = portIndex < 0 ? 5173 : Number(process.argv[portIndex + 1]);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error("Puerto de desarrollo no válido.");
  process.exit(1);
}
let server;
let stopping = false;
const parentPid = process.ppid;
async function stop() {
  if (stopping) return;
  stopping = true;
  const timeout = setTimeout(function () { process.exit(1); }, 5000);
  timeout.unref();
  try {
    await server?.close();
    process.exit(0);
  } catch {
    process.exit(1);
  }
}
process.once("SIGTERM", stop);
process.once("SIGINT", stop);
// Also close if a workflow supervisor disappears without forwarding a signal.
setInterval(function () {
  if (process.ppid !== parentPid) void stop();
}, 1000).unref();

try {
  server = await createServer({
    server: { host: "0.0.0.0", port, strictPort: true },
  });
  if (!stopping) {
    await server.listen();
    console.log("Servidor de desarrollo administrado · PID " + process.pid);
    server.printUrls();
  }
} catch (error) {
  console.error(error.message);
  await server?.close();
  process.exitCode = 1;
}
