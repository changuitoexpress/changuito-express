---
name: Isolated auth recovery
description: Keep profile recovery sign-in separate from the app's active auth session.
---

Use a non-persistent Supabase client with its own storage key when a recovery flow
must verify credentials and write data without logging the user into the main app
before that write succeeds.

**Why:** The app's auth listener responds to a successful sign-in immediately;
using its client can navigate away from recovery while the profile operation is
still running. A second client without a distinct storage key also caused a
multiple-client warning in the browser.

**How to apply:** For future credential-based recovery actions, authenticate and
perform the protected write through an isolated client, then sign it out without
altering the app's session state.
