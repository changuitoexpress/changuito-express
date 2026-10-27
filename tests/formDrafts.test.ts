import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  clearFormDraft,
  clearUserFormDrafts,
  formDraftKey,
  readFormDraft,
  writeFormDraft,
} from "../src/formDrafts";

class MemoryStorage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  clear() {
    this.values.clear();
  }
}

const storage = new MemoryStorage();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: storage,
});

afterEach(function () {
  storage.clear();
});

describe("authenticated form drafts", function () {
  it("restores draft values for the matching user", function () {
    const values = { street: "Av. Reforma", payment: "tarjeta" };
    writeFormDraft("user-one", "checkout", values, 1000);

    assert.deepEqual(readFormDraft("user-one", "checkout", 2000), values);
    assert.equal(readFormDraft("user-two", "checkout", 2000), null);
  });

  it("removes expired or malformed drafts instead of restoring them", function () {
    writeFormDraft("user-one", "checkout", { street: "Old address" }, 1000);
    assert.equal(readFormDraft("user-one", "checkout", 1000 + 86_400_001), null);
    assert.equal(storage.getItem(formDraftKey("user-one", "checkout")), null);

    storage.setItem(formDraftKey("user-one", "checkout"), "{broken");
    assert.equal(readFormDraft("user-one", "checkout", 2000), null);
    assert.equal(storage.getItem(formDraftKey("user-one", "checkout")), null);
  });

  it("clears one form or all drafts for the explicitly signed-out user only", function () {
    writeFormDraft("user-one", "checkout", { step: "payment" });
    writeFormDraft("user-one", "profile", { name: "Ana" });
    writeFormDraft("user-two", "checkout", { step: "address" });

    clearFormDraft("user-one", "checkout");
    assert.equal(readFormDraft("user-one", "checkout"), null);
    assert.deepEqual(readFormDraft("user-one", "profile"), { name: "Ana" });

    clearUserFormDrafts("user-one");
    assert.equal(readFormDraft("user-one", "profile"), null);
    assert.deepEqual(readFormDraft("user-two", "checkout"), { step: "address" });
  });
});
