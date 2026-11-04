import { supabase } from "./App";

export async function iniciarPagoMercadoPago(
  items: Array<{ id: string; quantity: number }>,
  address: string,
  shippingZoneId: string | null,
) {
  const { data, error } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (error || !accessToken) {
    throw new Error("Tu sesión venció. Inicia sesión de nuevo para pagar.");
  }

  const response = await fetch("/api/mercadopago/create-preference", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify({
      items: items.map(function (item) {
        return { id: item.id, quantity: item.quantity };
      }),
      address,
      shipping_zone_id: shippingZoneId,
    }),
  });

  let result: any = null;
  try {
    result = await response.json();
  } catch {}
  if (typeof result?.init_point !== "string") {
    throw new Error(result?.error ?? "No pudimos iniciar el pago con Mercado Pago.");
  }
  return result as { checkout_id: string; init_point: string; total: number; currency: string };
}
