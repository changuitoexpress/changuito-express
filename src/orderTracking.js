export const ORDER_TRACKING_STEPS = [
  "Recibido",
  "Preparando",
  "En camino",
  "Entregado",
];

export function getOrderTrackingStage(status) {
  const normalized = String(status ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (["cancelado", "cancelled", "canceled"].includes(normalized)) return -1;
  if (["entregado", "delivered", "complete", "completed"].includes(normalized)) return 3;
  if (["en_camino", "on_the_way", "out_for_delivery"].includes(normalized)) return 2;
  if (
    [
      "preparando",
      "preparacion",
      "en_preparacion",
      "en_proceso",
      "confirmado",
      "aceptado",
      "preparing",
      "accepted",
    ].includes(normalized)
  ) {
    return 1;
  }

  return 0;
}
