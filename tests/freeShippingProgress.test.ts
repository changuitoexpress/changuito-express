import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getFreeShippingProgress,
  getShippingCharge,
} from "../src/freeShippingProgress";

describe("progreso hacia envío gratis", function () {
  const milestones = [
    { deliveredOrders: 0, used: 0, progressPercent: 0, cycleCount: 0, remainingOrders: 10, available: false, availableRewards: 0 },
    { deliveredOrders: 9, used: 0, progressPercent: 90, cycleCount: 9, remainingOrders: 1, available: false, availableRewards: 0 },
    { deliveredOrders: 10, used: 0, progressPercent: 100, cycleCount: 10, remainingOrders: 0, available: true, availableRewards: 1 },
    { deliveredOrders: 11, used: 0, progressPercent: 100, cycleCount: 10, remainingOrders: 0, available: true, availableRewards: 1 },
    { deliveredOrders: 11, used: 1, progressPercent: 10, cycleCount: 1, remainingOrders: 9, available: false, availableRewards: 0 },
    { deliveredOrders: 20, used: 1, progressPercent: 100, cycleCount: 10, remainingOrders: 0, available: true, availableRewards: 1 },
    { deliveredOrders: 20, used: 2, progressPercent: 0, cycleCount: 0, remainingOrders: 10, available: false, availableRewards: 0 },
  ];

  for (const milestone of milestones) {
    it(`muestra el progreso correcto con ${milestone.deliveredOrders} pedidos y ${milestone.used} recompensas usadas`, function () {
      assert.deepEqual(getFreeShippingProgress(milestone.deliveredOrders, milestone.used), {
        progressPercent: milestone.progressPercent,
        cycleCount: milestone.cycleCount,
        remainingOrders: milestone.remainingOrders,
        available: milestone.available,
        availableRewards: milestone.availableRewards,
      });
    });
  }
});

describe("cargo de envío", function () {
  it("descuenta la tarifa base sin ocultar el recargo por varios negocios", function () {
    assert.deepEqual(getShippingCharge(50, 15, true), {
      baseCharge: 50,
      multiBusinessCharge: 15,
      discount: 50,
      total: 15,
    });
  });

  it("conserva el cargo normal cuando no hay recompensa disponible", function () {
    assert.deepEqual(getShippingCharge(50, 15, false), {
      baseCharge: 50,
      multiBusinessCharge: 15,
      discount: 0,
      total: 65,
    });
  });
});
