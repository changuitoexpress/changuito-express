import { handleAdminYarvisRequest } from "../server/adminYarvis.js";

export default async function handler(req, res) {
  return handleAdminYarvisRequest(req, res);
}
