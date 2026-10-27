export interface FreeShippingProgress {
  progressPercent: number;
  cycleCount: number;
  remainingOrders: number;
}

export function getFreeShippingProgress(deliveredOrders: number): FreeShippingProgress {
  const cycleCount = deliveredOrders % 10 || (deliveredOrders > 0 ? 10 : 0);

  return {
    progressPercent: Math.round((cycleCount / 10) * 100),
    cycleCount: cycleCount,
    remainingOrders: 10 - cycleCount,
  };
}
