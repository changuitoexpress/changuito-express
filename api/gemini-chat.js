import { handleGeminiChatRequest } from "../server/geminiChat.js";

export default async function handler(req, res) {
  return handleGeminiChatRequest(req, res);
}
