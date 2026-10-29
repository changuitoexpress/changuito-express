import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { it } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { signOutEverywhere } from "../src/authFlows";

const testUrl = process.env.SUPABASE_TEST_URL;
const testAnonKey = process.env.SUPABASE_TEST_ANON_KEY;
const testEmail = process.env.SUPABASE_TEST_EMAIL;
const testPassword = process.env.SUPABASE_TEST_PASSWORD;
const configuredValues = [
  testUrl,
  testAnonKey,
  testEmail,
  testPassword,
].filter(Boolean).length;

if (configuredValues > 0 && configuredValues < 4) {
  throw new Error(
    "Set SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY, SUPABASE_TEST_EMAIL, and SUPABASE_TEST_PASSWORD together.",
  );
}

class TestAuthStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

function assertLocalTestConfiguration() {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(testUrl as string);
  } catch (error) {
    throw new Error("SUPABASE_TEST_URL must point to local Supabase.");
  }

  if (
    parsedUrl.protocol !== "http:" ||
    !["127.0.0.1", "localhost"].includes(parsedUrl.hostname) ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    throw new Error(
      "Auth integration tests only run against local Supabase at localhost or 127.0.0.1.",
    );
  }

  if (
    !(testEmail as string).toLowerCase().endsWith("@example.test") ||
    !testPassword
  ) {
    throw new Error(
      "Use a dedicated local auth test account with an @example.test email.",
    );
  }
}

function createTestClient(storageKey: string, storage: TestAuthStorage) {
  return createClient(testUrl as string, testAnonKey as string, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: true,
      storage,
      storageKey,
    },
  });
}

it(
  "revokes another saved device session after global sign-out",
  { skip: configuredValues === 0 },
  async function () {
    assertLocalTestConfiguration();

    const initiatingStorageKey = `task39-initiator-${randomUUID()}`;
    const remoteStorageKey = `task39-remote-${randomUUID()}`;
    const initiatingClient = createTestClient(
      initiatingStorageKey,
      new TestAuthStorage(),
    );
    const remoteStorage = new TestAuthStorage();
    const remoteClient = createTestClient(remoteStorageKey, remoteStorage);

    try {
      const initiatingSignIn = await initiatingClient.auth.signInWithPassword({
        email: testEmail as string,
        password: testPassword as string,
      });
      assert.equal(initiatingSignIn.error, null);
      assert.ok(initiatingSignIn.data.session);

      const remoteSignIn = await remoteClient.auth.signInWithPassword({
        email: testEmail as string,
        password: testPassword as string,
      });
      assert.equal(remoteSignIn.error, null);
      assert.ok(remoteSignIn.data.session);
      assert.equal(
        remoteSignIn.data.session.user.id,
        initiatingSignIn.data.session.user.id,
      );
      assert.notEqual(
        remoteSignIn.data.session.refresh_token,
        initiatingSignIn.data.session.refresh_token,
      );

      const storedRemoteSession = remoteStorage.getItem(remoteStorageKey);
      assert.ok(storedRemoteSession);
      const expiredRemoteSession = JSON.parse(storedRemoteSession);
      expiredRemoteSession.expires_at = Math.floor(Date.now() / 1000) - 60;
      expiredRemoteSession.expires_in = 0;
      remoteStorage.setItem(
        remoteStorageKey,
        JSON.stringify(expiredRemoteSession),
      );

      await signOutEverywhere(initiatingClient);
      const initiatingSession = await initiatingClient.auth.getSession();
      assert.equal(initiatingSession.data.session, null);

      const remoteRestoration = await remoteClient.auth.getSession();
      assert.equal(remoteRestoration.data.session, null);
      assert.ok(remoteRestoration.error);
    } finally {
      await Promise.all([
        initiatingClient.auth.signOut({ scope: "local" }).catch(function () {}),
        remoteClient.auth.signOut({ scope: "local" }).catch(function () {}),
      ]);
    }
  },
);
