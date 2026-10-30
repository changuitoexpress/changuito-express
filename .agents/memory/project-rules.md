---
name: Project rules
description: Existing user constraints for app edits and publishing.
---

Use inline styles, `function(){}` rather than runtime arrow functions, and preserve
`/* DO NOT TRANSLATE */` headers.

**Why:** These are standing project rules retained from the earlier project context.

**How to apply:** Follow these constraints when editing app code; do not translate
the existing Spanish UI as part of setup or unrelated changes.

The user wants Replit Agent to manage this project's changes and Vercel deployments, and Supabase SQL once that connection is available.

**Why:** The user asked Replit Agent to handle the connected services directly instead of guiding them through each deployment.

**How to apply:** Prefer the connected GitHub and Vercel APIs for project changes and deployments. Keep Supabase access scoped to this project and review SQL before applying it.
