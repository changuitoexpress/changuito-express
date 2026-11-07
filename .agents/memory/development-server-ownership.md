---
name: Development server ownership
description: Workflow failures can coexist with a healthy orphaned development server started by a shell.
---

Use one managed workflow as the owner of the development server. Do not leave a separate background shell running the same development command.

**Why:** Repeated port conflicts in this environment came from a shell-owned server surviving while the managed workflow reported failure. Restarting the failed workflow did not release the shell's listener.

**How to apply:** Before restarting after a port conflict, distinguish the listener's process ownership from workflow status. Stop only the verified same-project duplicate; retain the configured port and strict-port behavior rather than silently moving the application.

Prefer a workflow-owned process that closes Vite itself on termination and supervisor loss, rather than relying on an npm/shell child chain to forward signals.

**Why:** Manually removing duplicates fixed the immediate symptom but the orphaned listener repeatedly returned after workflow lifecycle changes.
