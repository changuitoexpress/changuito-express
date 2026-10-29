// Supabase espera solo la raíz del proyecto (https://xxxx.supabase.co).
// Si la variable incluye una ruta como /rest/v1/, las llamadas de auth fallan con
// "Invalid path specified in request URL", así que nos quedamos con el origen.
export function normalizeSupabaseUrl(raw: string | undefined): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}
