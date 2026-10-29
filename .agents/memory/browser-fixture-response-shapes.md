---
name: Browser fixture response shapes
description: Keep authenticated browser-test API mocks compatible with the screens they render.
---

When a browser test verifies an authenticated destination, mock the API responses that destination consumes with the expected data shapes. A successful sign-in token alone is not enough to establish that the authenticated screen can render.

**Why:** A generic `{}` response for a collection endpoint can make the screen throw during rendering and obscure whether authentication itself succeeded.

**How to apply:** Before asserting a post-login screen, identify its key data requests and return realistic empty arrays or objects for those requests; also assert that the browser recorded no page errors.
