---
name: Supabase count pagination fixtures
description: Preserve exact-count response headers in browser fixtures that mock paginated Supabase queries.
---

When a browser test mocks a Supabase query using `count: 'exact'`, include a valid `content-range` response header and expose it with `access-control-expose-headers: content-range`.

**Why:** Cross-origin browser code cannot read `content-range` unless the fixture exposes it, so Supabase JS returns a null count even when the mocked response includes the header.

**How to apply:** For browser tests that exercise `.range()` with an exact count, have the fixture report the requested row interval and total count, and expose the header through CORS.
