import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { pipeline } from "node:stream/promises";
import { handleWhatsAppWebhook } from "./whatsapp/webhook.js";
import { handleWhatsAppCrm } from "./whatsapp/crm.js";
import { requireTestConfig } from "./whatsapp/config.js";
import { handleGeminiChatRequest } from "./geminiChat.js";
import { handleAdminYarvisRequest } from "./adminYarvis.js";
import { handleMercadoPagoRequest } from "./mercadoPago.js";

const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".ico": "image/x-icon", ".woff2": "font/woff2",
};

export function validateProductionEnvironment() {
  requireTestConfig();
  const missing = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]
    .filter(function (key) { return !process.env[key]?.trim(); });
  if (missing.length) throw new Error("Faltan variables de producción: " + missing.join(", "));
  if (new URL(process.env.VITE_SUPABASE_URL).protocol !== "https:") {
    throw new Error("Supabase requiere una URL HTTPS.");
  }
}

export function logWhatsAppEnvironment() {
  const required = [
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_APP_SECRET",
    "WHATSAPP_VERIFY_TOKEN",
    "WHATSAPP_TEST_PHONE_NUMBER_ID",
    "WHATSAPP_ALLOWED_RECIPIENTS",
  ];
  const present = required.filter(function (key) { return Boolean(process.env[key]?.trim()); });
  console.info("[whatsapp-config] startup " + JSON.stringify({
    present,
    WHATSAPP_MODE: process.env.WHATSAPP_MODE ?? "unset",
  }));
}

export function productionServer(root = resolve("dist")) {
  return createServer(async function (req, res) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    try {
      const url = new URL(req.url, "http://server.invalid");
      if (url.pathname === "/api/whatsapp/webhook") return await handleWhatsAppWebhook(req, res);
      if (url.pathname === "/api/whatsapp/crm") return await handleWhatsAppCrm(req, res);
      if (url.pathname === "/api/gemini-chat") return await handleGeminiChatRequest(req, res);
      if (url.pathname === "/api/admin-yarvis") return await handleAdminYarvisRequest(req, res);
      const payments = {
        "/api/mercadopago/create-preference": "create-preference",
        "/api/mercadopago/status": "status",
        "/api/mercadopago/webhook": "webhook",
      };
      if (Object.hasOwn(payments, url.pathname)) {
        return await handleMercadoPagoRequest(req, res, payments[url.pathname]);
      }
      res.setHeader("Cache-Control", "no-store");
      if (url.pathname.startsWith("/api/")) {
        res.writeHead(404).end("Not found");
        return;
      }
      if (!["GET", "HEAD"].includes(req.method)) {
        res.setHeader("Allow", "GET, HEAD");
        res.writeHead(405).end();
        return;
      }
      const pathname = decodeURIComponent(url.pathname);
      if (pathname.split("/").some(function (part) { return part.startsWith("."); })) {
        res.writeHead(404).end("Not found");
        return;
      }
      let file = resolve(root, "." + pathname);
      if (pathname.includes("\0") || (file !== root && !file.startsWith(root + sep))) {
        res.writeHead(400).end();
        return;
      }
      let info = await stat(file).catch(function () { return null; });
      if (!info?.isFile()) {
        if (extname(pathname)) {
          res.writeHead(404).end("Not found");
          return;
        }
        file = resolve(root, "index.html");
        info = await stat(file);
      }
      res.setHeader("Content-Type", types[extname(file)] || "application/octet-stream");
      res.setHeader("Content-Length", info.size);
      if (file.startsWith(resolve(root, "assets") + sep)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
      if (req.method === "HEAD") res.end();
      else await pipeline(createReadStream(file), res);
    } catch {
      if (!res.headersSent) res.writeHead(500, { "Cache-Control": "no-store" });
      if (!res.writableEnded) res.end("No se pudo completar la solicitud.");
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    logWhatsAppEnvironment();
    validateProductionEnvironment();
    const port = Number(process.env.PORT || 5000);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Puerto no válido.");
    const server = productionServer();
    server.requestTimeout = 60000;
    server.headersTimeout = 20000;
    server.listen(port, "0.0.0.0", function () {
      console.log("Servidor de producción listo en puerto " + port + " · WhatsApp solo de prueba.");
    });
    process.on("SIGTERM", function () { server.close(); });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
