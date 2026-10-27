---
name: Supabase cross-tab auth tests
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
