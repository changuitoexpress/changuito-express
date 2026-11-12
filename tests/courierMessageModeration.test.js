import assert from "node:assert/strict";
import { test } from "node:test";
import { isInsultingCourierMessage } from "../src/courierMessageModeration.js";

test("detects insulting courier messages with accents and punctuation", function () {
  assert.equal(isInsultingCourierMessage("Eres una vieja loca"), true);
  assert.equal(isInsultingCourierMessage("¡Qué pendejó!"), true);
  assert.equal(isInsultingCourierMessage("No seas un idiota."), true);
});

test("does not block respectful or unrelated messages", function () {
  assert.equal(isInsultingCourierMessage("Siento que usted está exagerando."), false);
  assert.equal(isInsultingCourierMessage("Ya llegué con su pedido."), false);
  assert.equal(isInsultingCourierMessage(""), false);
});
