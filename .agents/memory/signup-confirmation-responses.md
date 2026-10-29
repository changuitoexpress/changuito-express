---
name: Signup confirmation responses
description: Validate Supabase signup responses by user identity, not object truthiness.
---

Treat signup as confirmed only when the returned user has a non-empty ID. Supabase auth-js may normalize a response with `user: null` into a truthy response-shaped `user` value.

**Why:** A UI-level signup test using the actual client SDK showed that checking only whether `data.user` exists could report success when no account user was returned.

**How to apply:** When deciding whether signup succeeded, validate the user ID before saving a profile or showing confirmation; exercise null-user responses through the browser client as well as helper tests.
