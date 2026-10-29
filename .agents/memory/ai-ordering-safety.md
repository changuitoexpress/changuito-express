---
name: AI ordering safety
description: Why conversational order proposals require deterministic validation, confirmation, and low-latency model checks.
---

Treat generated orders as proposals, never as authority to change the cart or place an order.

**Why:** the user reported that the previous keyword bot added the wrong products and wants a conversational assistant that orients customers with real prices.

**How to apply:** resolve product names, prices and availability from the actual catalog; require an explicit customer confirmation; recheck stock and prices before passing a proposal to the existing cart. Do not let generated prose claim a purchase has already happened.

Choose a low-latency model using a live generation check, not a documentation headline or model listing alone.

**Why:** a valid key listed models successfully, but a newer reasoning model timed out and a listed legacy model returned 404 on generation. The available Flash Lite alias completed the small order fixture in about one second.

**How to apply:** use safe metadata diagnostics and a small catalog fixture when changing providers/models. Never log credentials, and do not repeatedly switch to newer/heavier models while assuming they will be faster.
