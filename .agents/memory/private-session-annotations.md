---
name: Private session annotations
description: How user-owned labels and other annotations should relate to Supabase Auth sessions.
---

Do not add app-owned user metadata to Supabase's managed `auth.sessions` table. Store annotations in a separate table keyed by both user ID and session ID, revoke direct client access, and expose them through authenticated functions that validate ownership against `auth.uid()`.

**Why:** Supabase owns the session table's schema and lifecycle, while annotations are application data that must remain private and cannot trust user IDs supplied by the client.

**How to apply:** Use this pattern when adding labels or other user-defined details to active auth sessions; also remove annotations when their session is explicitly revoked.
