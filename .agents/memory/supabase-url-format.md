---
name: Supabase URL format
description: VITE_SUPABASE_URL was saved with a /rest/v1/ path; the app normalizes it to the origin.
---

The `VITE_SUPABASE_URL` secret was stored as `https://<project>.supabase.co/rest/v1/`. Supabase clients need only the origin, otherwise auth calls fail with "Invalid path specified in request URL" (PostgREST PGRST125).

**Why:** this caused the guest-login error and the earlier failed read-only query.

**How to apply:** build clients with the project origin; if a Supabase "invalid path" error appears again, check the URL shape before changing SQL or auth logic. The user has now enabled Anonymous Sign-Ins and confirmed guest access works.
