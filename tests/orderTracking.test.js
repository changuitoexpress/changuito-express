import assert from "node:assert/strict";
import { test } from "node:test";
import { getOrderTrackingStage, ORDER_TRACKING_STEPS } from "../src/orderTracking.js";

test("maps active order statuses to the customer tracking steps", function () {
  assert.deepEqual(ORDER_TRACKING_STEPS, ["Recibido", "Preparando", "En camino", "Entregado"]);
  assert.equal(getOrderTrackingStage("pendiente"), 0);
  assert.equal(getOrderTrackingStage("preparando"), 1);
  assert.equal(getOrderTrackingStage("en preparación"), 1);
  assert.equal(getOrderTrackingStage("en_camino"), 2);
  assert.equal(getOrderTrackingStage("entregado"), 3);
});

test("keeps cancelled orders out of the active delivery progress", function () {
  assert.equal(getOrderTrackingStage("cancelado"), -1);
});
