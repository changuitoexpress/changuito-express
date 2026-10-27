---
name: Supabase individual session management
description: Constraints for listing and revoking device sessions through Supabase Auth.
---

Supabase's client API does not currently expose user-level methods to list sessions
or revoke one selected session. Avoid guessed Auth endpoints and never persist or
display auth tokens. Device-management RPCs must derive the user and current
session from verified JWT claims and scope every operation to `auth.uid()`.

Deleting an auth session prevents that session from refreshing, but an already
issued access token may remain usable until it expires.

**Why:** Supabase Auth's session administration is not available through a
supported per-session client method, and client-supplied user IDs or token storage
would weaken the isolation boundary.

**How to apply:** Check for a supported Supabase API before changing this flow;
keep revocation user-scoped and explain the access-token expiry delay when users
revoke another device.
