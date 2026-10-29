---
name: Project rules
description: Existing user constraints for app edits and publishing.
---

Use inline styles, `function(){}` rather than runtime arrow functions, and preserve
`/* DO NOT TRANSLATE */` headers.

**Why:** These are standing project rules retained from the earlier project context.

**How to apply:** Follow these constraints when editing app code; do not translate
the existing Spanish UI as part of setup or unrelated changes.

The user manually pushes to GitHub for Vercel publishing.

**Why:** The existing project context assigns the publishing push to the user.

**How to apply:** Do not push or replace the existing deployment process as part
of local Replit setup.
