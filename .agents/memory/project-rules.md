---
name: Project rules
description: Existing user constraints for app edits and publishing.
---

Use inline styles, `function(){}` rather than runtime arrow functions, and preserve
`/* DO NOT TRANSLATE */` headers.

**Why:** These are standing project rules retained from the earlier project context.

**How to apply:** Follow these constraints when editing app code; do not translate
the existing Spanish UI as part of setup or unrelated changes.

The user wants Replit Agent to handle project changes through GitHub and Vercel, and Supabase SQL once that connection is available.

**Why:** The user asked to connect these services so the agent can make the necessary changes directly.

**How to apply:** Prefer the connected GitHub and Vercel APIs for the project's code and deployments. Keep Supabase access scoped to this project and review SQL before applying it.
