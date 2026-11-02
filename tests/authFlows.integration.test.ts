import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { it } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { signOutEverywhere } from "../src/authFlows";

const testUrl = process.env.SUPABASE_TEST_URL;
const testAnonKey = process.env.SUPABASE_TEST_ANON_KEY;
const testEmail = process.env.SUPABASE_TEST_EMAIL;
const testPassword = process.env.SUPABASE_TEST_PASSWORD;
const otherTestEmail = process.env.SUPABASE_TEST_OTHER_EMAIL;
const otherTestPassword = process.env.SUPABASE_TEST_OTHER_PASSWORD;
const configuredPrimaryValues = [
  testUrl,
  testAnonKey,
  testEmail,
  testPassword,
].filter(Boolean).length;
const configuredOtherAccountValues = [otherTestEmail, otherTestPassword].filter(
  Boolean,
).length;

if (configuredPrimaryValues > 0 && configuredPrimaryValues < 4) {
  throw new Error(
    "Set SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY, SUPABASE_TEST_EMAIL, and SUPABASE_TEST_PASSWORD together.",
  );
}

if (configuredPrimaryValues === 0 && configuredOtherAccountValues > 0) {
  throw new Error(
    "Configure the primary local test account before setting the second account.",
  );
}

if (configuredOtherAccountValues === 1) {
  throw new Error(
    "Set SUPABASE_TEST_OTHER_EMAIL and SUPABASE_TEST_OTHER_PASSWORD together.",
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

function assertLocalTestConfiguration(email: string, password: string) {
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
    !email.toLowerCase().endsWith("@example.test") ||
    !password
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
  { skip: configuredPrimaryValues === 0 },
  async function () {
    assertLocalTestConfiguration(testEmail as string, testPassword as string);

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

it(
  "allows a fresh sign-in after global sign-out",
  { skip: configuredPrimaryValues === 0 },
  async function () {
    assertLocalTestConfiguration(testEmail as string, testPassword as string);

    const initiatingStorageKey = `task77-initiator-${randomUUID()}`;
    const freshStorageKey = `task77-fresh-${randomUUID()}`;
    const initiatingClient = createTestClient(
      initiatingStorageKey,
      new TestAuthStorage(),
    );

    try {
      const initialSignIn = await initiatingClient.auth.signInWithPassword({
        email: testEmail as string,
        password: testPassword as string,
      });
      assert.equal(initialSignIn.error, null);
      assert.ok(initialSignIn.data.session);

      await signOutEverywhere(initiatingClient);
      const signedOutSession = await initiatingClient.auth.getSession();
      assert.equal(signedOutSession.data.session, null);

      const freshClient = createTestClient(
        freshStorageKey,
        new TestAuthStorage(),
      );
      try {
        const freshSignIn = await freshClient.auth.signInWithPassword({
          email: testEmail as string,
          password: testPassword as string,
        });
        assert.equal(freshSignIn.error, null);
        assert.ok(freshSignIn.data.session);
        assert.equal(
          freshSignIn.data.session.user.id,
          initialSignIn.data.session.user.id,
        );

        const restoredSession = await freshClient.auth.getSession();
        assert.equal(restoredSession.error, null);
        assert.equal(
          restoredSession.data.session?.user.id,
          initialSignIn.data.session.user.id,
        );
      } finally {
        await freshClient.auth.signOut({ scope: "local" }).catch(function () {});
      }
    } finally {
      await initiatingClient.auth.signOut({ scope: "local" }).catch(function () {});
    }
  },
);

it(
  "keeps a different account signed in after global sign-out",
  {
    skip:
      configuredPrimaryValues === 0
        ? "Local Supabase test credentials are not configured."
        : configuredOtherAccountValues === 0
          ? "Set SUPABASE_TEST_OTHER_EMAIL and SUPABASE_TEST_OTHER_PASSWORD to run the cross-account check."
          : false,
  },
  async function () {
    assertLocalTestConfiguration(testEmail as string, testPassword as string);
    assertLocalTestConfiguration(
      otherTestEmail as string,
      otherTestPassword as string,
    );
    assert.notEqual(
      (testEmail as string).toLowerCase(),
      (otherTestEmail as string).toLowerCase(),
      "The two test accounts must use different email addresses.",
    );

    const initiatingStorageKey = `task76-initiator-${randomUUID()}`;
    const otherAccountStorageKey = `task76-other-account-${randomUUID()}`;
    const initiatingClient = createTestClient(
      initiatingStorageKey,
      new TestAuthStorage(),
    );
    const otherAccountStorage = new TestAuthStorage();
    const otherAccountClient = createTestClient(
      otherAccountStorageKey,
      otherAccountStorage,
    );

    try {
      const initiatingSignIn = await initiatingClient.auth.signInWithPassword({
        email: testEmail as string,
        password: testPassword as string,
      });
      assert.equal(initiatingSignIn.error, null);
      assert.ok(initiatingSignIn.data.session);

      const otherAccountSignIn =
        await otherAccountClient.auth.signInWithPassword({
          email: otherTestEmail as string,
          password: otherTestPassword as string,
        });
      assert.equal(otherAccountSignIn.error, null);
      assert.ok(otherAccountSignIn.data.session);
      assert.notEqual(
        otherAccountSignIn.data.session.user.id,
        initiatingSignIn.data.session.user.id,
        "The test accounts must belong to different users.",
      );

      await signOutEverywhere(initiatingClient);
      const initiatingSession = await initiatingClient.auth.getSession();
      assert.equal(initiatingSession.data.session, null);

      const refreshedOtherAccount =
        await otherAccountClient.auth.refreshSession();
      assert.equal(refreshedOtherAccount.error, null);
      assert.ok(refreshedOtherAccount.data.session);
      assert.equal(
        refreshedOtherAccount.data.session.user.id,
        otherAccountSignIn.data.session.user.id,
      );

      const restoredOtherAccount =
        await otherAccountClient.auth.getSession();
      assert.equal(restoredOtherAccount.error, null);
      assert.equal(
        restoredOtherAccount.data.session?.user.id,
        otherAccountSignIn.data.session.user.id,
      );
    } finally {
      await Promise.all([
        initiatingClient.auth.signOut({ scope: "local" }).catch(function () {}),
        otherAccountClient.auth.signOut({ scope: "local" }).catch(function () {}),
      ]);
    }
  },
);
