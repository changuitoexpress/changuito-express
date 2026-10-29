---
name: Supabase browser auth tests
description: Simulate another tab signing into a different account in browser tests.
---

When a browser test needs to simulate a sign-in from another tab, update the
stored session and send the Supabase-shaped `SIGNED_IN` notification over its
auth `BroadcastChannel`. Changing `localStorage` alone does not trigger the
application's auth listener in this project.

**Why:** The wallet account-switch fixture stalled when it relied on storage
events; the browser client communicates auth changes between tabs through its
broadcast channel.

**How to apply:** Use a second same-origin page and the Supabase auth channel
when testing account changes that must reach the app's `onAuthStateChange`
listener.

When a browser test simulates sign-out by clearing stored session data and
reloading, guard its `addInitScript` so the initial session is seeded only once
per tab. Playwright reruns initialization scripts on every navigation, including
reloads.

**Why:** An unguarded session seed silently signs the test back in after a
simulated logout.

**How to apply:** Use a session-scoped marker when a browser test reloads after
clearing the session.
