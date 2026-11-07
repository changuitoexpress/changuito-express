---
name: Browser service worker fixtures
description: Prevent PWA service workers from bypassing Playwright network interception.
---

Use `serviceWorkers: "block"` for browser contexts that mock same-origin API endpoints in this PWA.

**Why:** The PWA service worker can originate requests outside `page.route` interception. A fixture session then reaches the real backend, which correctly rejects it; this can look like an application authentication failure instead of a test-isolation failure.

**How to apply:** Keep all external-service calls intercepted, block service workers in fixture contexts, and use real-backend tests separately. Never weaken backend authentication to make a mocked session work.
