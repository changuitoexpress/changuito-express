---
name: build shell env (no npm/node on PATH)
description: How to run vite build / node tooling from the agent bash shell in this repl
---

# Building from the agent shell

The agent bash shell here does NOT have `npm`, `node`, or `npx` on PATH (commands fail with `command not found`), and broad `find /nix/store` scans time out.

**Rule:** to compile/verify, run vite directly with an explicit Node 20 bin prepended:

```
PATH="/nix/store/0akvkk9k1a7z5vjp34yz6dr91j776jhv-nodejs-20.11.1/bin:$PATH" node_modules/.bin/vite build
```

**Why:** lets you type-check/build (`vite build`) without a workflow. `npm run build` sometimes works, sometimes errors `npm: command not found` — unreliable.

**How to apply:** when no workflow is configured (this project had "No workflows found" at one point) or restart_workflow errors `RUN_COMMAND_NOT_FOUND`, fall back to the explicit-PATH vite build above to confirm code compiles. The nix store hash may change after env rebuilds — re-list `/nix/store | grep nodejs` to refresh it.
