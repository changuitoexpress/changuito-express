import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { handleGeminiChatRequest } from "./server/geminiChat.js";
import { handleAdminYarvisRequest } from "./server/adminYarvis.js";
import { handleMercadoPagoRequest } from "./server/mercadoPago.js";
import { handleWhatsAppCrm } from "./server/whatsapp/crm.js";
import { handleWhatsAppWebhook } from "./server/whatsapp/webhook.js";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "changuito-gemini-chat-api",
      configureServer(server) {
        server.middlewares.use("/api/whatsapp/webhook", function (req, res) {
          void handleWhatsAppWebhook(req, res);
        });
        server.middlewares.use("/api/whatsapp/crm", function (req, res) {
          void handleWhatsAppCrm(req, res);
        });
        server.middlewares.use("/api/gemini-chat", function (req, res) {
          void handleGeminiChatRequest(req, res);
        });
        server.middlewares.use("/api/admin-yarvis", function (req, res) {
          void handleAdminYarvisRequest(req, res);
        });
        server.middlewares.use("/api/mercadopago/create-preference", function (req, res) {
          void handleMercadoPagoRequest(req, res, "create-preference");
        });
        server.middlewares.use("/api/mercadopago/status", function (req, res) {
          void handleMercadoPagoRequest(req, res, "status");
        });
        server.middlewares.use("/api/mercadopago/webhook", function (req, res) {
          void handleMercadoPagoRequest(req, res, "webhook");
        });
      },
    },
  ],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    watch: {
      ignored: ["**/.local/**", "**/node_modules/**", "**/.git/**"],
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 5174,
    strictPort: true,
    allowedHosts: true,
  },
});
