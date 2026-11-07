import { handleWhatsAppCrm } from "../../server/whatsapp/crm.js";
export const config = { api: { bodyParser: false } };
export const maxDuration = 60;
export default handleWhatsAppCrm;
