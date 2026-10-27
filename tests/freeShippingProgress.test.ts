import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getFreeShippingProgress } from "../src/freeShippingProgress";

describe("progreso hacia envío gratis", function () {
  const milestones = [
    { deliveredOrders: 0, progressPercent: 0, cycleCount: 0, remainingOrders: 10 },
    { deliveredOrders: 9, progressPercent: 90, cycleCount: 9, remainingOrders: 1 },
    { deliveredOrders: 10, progressPercent: 100, cycleCount: 10, remainingOrders: 0 },
    { deliveredOrders: 11, progressPercent: 10, cycleCount: 1, remainingOrders: 9 },
  ];

  for (const milestone of milestones) {
    it(`muestra el progreso correcto con ${milestone.deliveredOrders} pedidos entregados`, function () {
      assert.deepEqual(getFreeShippingProgress(milestone.deliveredOrders), {
        progressPercent: milestone.progressPercent,
        cycleCount: milestone.cycleCount,
        remainingOrders: milestone.remainingOrders,
      });
    });
  }
});
