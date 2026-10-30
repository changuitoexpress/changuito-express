---
name: Publishing integrations
description: Connector and binary-transfer constraints when publishing this project through GitHub and Vercel.
---

An installed GitHub connection may support the REST API but not the Git credential bridge. Check the transport error before assuming Git access is available.

**Why:** This project's bridge rejected its legacy REST connection, while authenticated GitHub API operations worked.

**How to apply:** When the bridge is unavailable, create a consolidated commit through the Git Data API using the current remote tree and parent. Preserve unrelated files, verify every changed blob against its local Git hash, and update the branch without force.

Keep binary assets out of large shell-output transfers when uploading them to another service.

**Why:** Large base64 shell results yielded incomplete payloads; valid JSON parsing alone did not establish that every file or byte survived transfer.

**How to apply:** Read asset buffers directly inside the impure file-to-API operation and verify Git blob hashes before updating the remote branch.

Connection readiness does not establish access to the intended Vercel project.

**Why:** The attached Vercel connection listed another project, while the intended application's existing GitHub-to-Vercel deployment link still worked.

**How to apply:** Verify project access explicitly. If using the existing GitHub integration to publish, confirm Vercel's status for that exact commit and check the published application; do not report success from a GitHub update alone.

Committed npm lockfiles for external hosting must not contain Replit-internal package download URLs. Keep package versions and integrity hashes unchanged when normalizing verified equivalent public URLs.

**Why:** A Vercel build failed during dependency installation because an internal registry hostname could not be resolved outside Replit.

**How to apply:** After dependency changes, check all resolved lockfile URLs for external portability and validate equivalent public-registry package integrity before publishing.

Generated Vercel deployment URLs can require Vercel sign-in even when the application's production alias is public.

**Why:** Successful production deployments redirected their generated URLs to Vercel SSO, while the user's public production domain served the updated application.

**How to apply:** Keep deployment protection intact. Confirm the exact commit's production status, then check the user's verified public domain and its application assets; a Vercel login page alone does not indicate an application failure.
