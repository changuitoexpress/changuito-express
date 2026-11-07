import { handleWhatsAppWebhook } from "../../server/whatsapp/webhook.js";
export const config = { api: { bodyParser: false } };
export const maxDuration = 60;
export default handleWhatsAppWebhook;
