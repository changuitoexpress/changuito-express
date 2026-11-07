import { supabase } from "./App";

export interface WaConversation {
  id: string;
  phone_number_id: string;
  status: "abierta" | "archivada";
  assigned_to: string | null;
  last_inbound_at: string | null;
  last_message_at: string;
  contact: { phone: string; display_name: string | null };
}
export interface WaMessage {
  id: string;
  conversation_id: string;
  direction: "in" | "out";
  kind: "text" | "image" | "unsupported";
  body: string;
  actor_id: string | null;
  status: string;
  error: string | null;
  image_path: string | null;
  created_at: string;
}
export interface WaAssignment {
  id: string;
  previous_courier: string | null;
  next_courier: string | null;
  actor_id: string | null;
  event: string;
  created_at: string;
}
export interface WaConfig {
  configured: boolean;
  missing: string[];
  mode: "test";
  channelLabel: string;
  pendingEvents: number;
}
export interface WaList {
  conversations: WaConversation[];
  couriers: { id: string; nombre: string | null }[];
  config: WaConfig;
}
export interface WaDetail {
  conversation: WaConversation;
  messages: WaMessage[];
  assignments: WaAssignment[];
  nextBefore: string | null;
}
export async function whatsappGet<T>(action: string, params: Record<string, string> = {}): Promise<T> {
  return request<T>("GET", action, params);
}
export async function whatsappPost<T>(action: string, body: Record<string, unknown>): Promise<T> {
  return request<T>("POST", action, body);
}
async function request<T>(method: string, action: string, data: Record<string, unknown>): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Inicia sesión para abrir el CRM.");
  const query = new URLSearchParams({ action });
  if (method === "GET") for (const [key, value] of Object.entries(data)) query.set(key, String(value));
  const response = await fetch("/api/whatsapp/crm?" + query, {
    method,
    headers: { Authorization: "Bearer " + session.access_token, ...(method === "POST" ? { "Content-Type": "application/json" } : {}) },
    ...(method === "POST" ? { body: JSON.stringify(data) } : {}),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error ?? "No se pudo conectar con el CRM.");
  return result as T;
}
