import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("the dependency lockfile remains installable outside the development environment", function () {
  const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
  const privateRegistryPackages = Object.entries(lock.packages)
    .filter(function ([, entry]) {
      if (!entry.resolved) return false;
      const url = new URL(entry.resolved);
      return url.protocol !== "https:" || url.hostname !== "registry.npmjs.org";
    })
    .map(function ([name]) { return name; });
  assert.deepEqual(
    privateRegistryPackages,
    [],
    "Use portable public npm URLs in the committed lockfile so production can install dependencies.",
  );
});
