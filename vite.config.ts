import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { handleGeminiChatRequest } from "./server/geminiChat.js";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "changuito-gemini-chat-api",
      configureServer(server) {
        server.middlewares.use("/api/gemini-chat", function (req, res) {
          void handleGeminiChatRequest(req, res);
        });
      },
    },
  ],
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
    watch: {
      ignored: ["**/.local/**", "**/node_modules/**", "**/.git/**"],
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
  },
});
