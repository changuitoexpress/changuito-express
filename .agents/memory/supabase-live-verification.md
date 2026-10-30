---
name: Supabase live verification
description: Verify project access, deployed schema, and actual row counts rather than trusting connection status or metadata estimates.
---

Treat connector readiness as connection availability, not proof of access to the intended Supabase project. Test an actual read-only operation against the user-confirmed project before claiming access.

**Why:** An attached connection reported healthy while project-specific operations were denied; renewed authorization was needed.

**How to apply:** Follow the integration reauthorization flow after a permission failure, then retry once. Do not request credentials or infer access from a ready status.

Do not interpret the `rows` value from the MCP table listing as an exact count.

**Why:** The listing reported empty tables that contained live catalog and order records when counted directly.

**How to apply:** Use a read-only aggregate count when the number of records affects a decision. Never seed, replace, or delete data based on the listing's estimate.

Verify deployed policies, constraints, and functions independently of checked-in SQL and static tests.

**Why:** The live database contained only parts of the repository's SQL setup, despite local checks passing.

**How to apply:** Inspect database catalogs before preparing repairs. Keep existing records and balances intact; do not assume an entire setup script was applied.
