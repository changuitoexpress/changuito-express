---
name: hosting-integration-audit
description: Audit a Replit Vite app published through GitHub to Vercel, distinguishing local ports, repository sync, connector scope and actual deployment evidence.
---

# Replit / GitHub / Vercel integration audit

Use for this multi-service audit, not for configuring a workflow alone
(`workflows`) or troubleshooting runtime production failures
(`site-reliability-engineer`). Read the current platform-provided
`integrations`, `query-integration-data`, `environment-secrets` and
`deployment` instructions before calling their callbacks.

## 1. Separate the three execution contexts

Inspect `package.json`, `vite.config.*`, `.replit` and `api/`.
Development middleware in `configureServer` does not run under
`vite preview`. A successful preview of `dist` therefore does not establish
that API calls work. On Vercel, verify root `api/` handlers rather than
expecting the Vite listener to run. GitHub has no application listener.

Choose different development and preview ports and align command flags,
Vite config and `.replit` mappings. For Vite, set `strictPort: true` so a
busy listener fails instead of opening a different port unnoticed. Preserve
existing port conventions unless changing them is necessary. Consult the
current workflows skill before configuring a webview.

## 2. Verify identities before inspecting remote configuration

Resolve connected providers using `searchIntegrations`. Read the chosen
connector's skill file. Through its authenticated API, request:

- GitHub: `GET /repos/{owner}/{repo}` to establish repository identity,
  default branch and available permissions.
- GitHub: `GET /repos/{owner}/{repo}/commits/{branch}` for the remote SHA.
- GitHub: `GET /repos/{owner}/{repo}/commits/{sha}/status` for deployment
  contexts; check-runs are a separate API and can be empty.
- Vercel: `GET /v10/projects?limit=30`, with pagination if needed.
  Compare `link.org`, `link.repo` and `link.productionBranch` to the
  intended GitHub repository. If team scope is available, inspect it.

A ready Vercel connector can list a different project from the intended
app. Never modify that unrelated project's environment as a workaround.
Report scope limitations separately from successful GitHub access.

## 3. Compare code and deployment evidence

Compare the remote commit/tree with local tracked code before declaring
sync. `GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1` returns blob
hashes for a file-level comparison without exposing credentials.
State which files or commit were compared; a status of `success` alone
does not prove local changes are deployed.

Where Vercel access permits, inspect that exact project's deployment and
environment-variable metadata. Do not request decrypted values. Use the
secrets skill for Replit existence checks, which are not evidence of
configuration in Vercel.

If the latest GitHub commit has successful Vercel statuses but the Vercel
connector cannot access the project, report both facts. Do not describe a
new deployment or a verified production environment on that evidence.

## 4. Protect verification boundaries

Inspect lockfiles for private registry hosts before external builds.
Run the project's checks, then start/restart its existing workflow after a
configuration batch. Verify the preview and authentication boundaries.
Do not create a production deployment just to test the audit procedure.
Separate local build results, public HTTP availability, authenticated
application behavior and real external-provider delivery in the report.
