export interface FreeShippingProgress {
  progressPercent: number;
  cycleCount: number;
  remainingOrders: number;
  available: boolean;
  availableRewards: number;
}

export function getFreeShippingProgress(
  deliveredOrders: number,
  usedFreeShipments: number = 0,
): FreeShippingProgress {
  const delivered = Math.max(0, Math.floor(deliveredOrders));
  const used = Math.max(0, Math.floor(usedFreeShipments));
  const availableRewards = Math.max(0, Math.floor(delivered / 10) - used);
  const available = availableRewards > 0;
  const cycleCount = available ? 10 : delivered % 10;

  return {
    progressPercent: Math.round((cycleCount / 10) * 100),
    cycleCount: cycleCount,
    remainingOrders: available ? 0 : 10 - cycleCount,
    available: available,
    availableRewards: availableRewards,
  };
}

export interface ShippingCharge {
  baseCharge: number;
  multiBusinessCharge: number;
  discount: number;
  total: number;
}

export function getShippingCharge(
  baseCharge: number,
  multiBusinessCharge: number,
  useFreeShipping: boolean,
): ShippingCharge {
  const base = Math.max(0, baseCharge);
  const multiBusiness = Math.max(0, multiBusinessCharge);
  const discount = useFreeShipping ? base : 0;

  return {
    baseCharge: base,
    multiBusinessCharge: multiBusiness,
    discount: discount,
    total: base - discount + multiBusiness,
  };
}
