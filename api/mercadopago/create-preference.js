import { handleMercadoPagoRequest } from "../../server/mercadoPago.js";

export default function handler(req, res) {
  return handleMercadoPagoRequest(req, res, "create-preference");
}
