---
name: ChanguitoAI integration contract
description: How ChanguiBot is wired into the app and the exact cart-item shape it must emit
---

# ChanguiBot (ChanguitoAI.tsx) integration

**Controlled, not self-managed.** ChanguitoAI is opened/closed by Dashboard via props `abierto` + `onCerrar`. Dashboard has MULTIPLE triggers calling `setChanguiAbierto(true)` (search-bar 🐒, a section button, and the "🚗 Traslados" quick-access button).

**Why:** pasted "PROMPT MAESTRO" templates keep trying to replace this with a self-managed `abierto` useState + its own floating button and drop the `abierto`/`onCerrar` props. Doing that compiles in isolation but BREAKS every existing trigger and Dashboard's `<ChanguitoAI .../>` props. Keep the controlled Props: `{session, theme, carritoGlobal, onAddToCart, abierto, onCerrar}`.

**How to apply:** when asked to rewrite ChanguitoAI, preserve those exact props and the panel-renders-when-`props.abierto` pattern. Do not introduce a self-opening floating button.

## Cart item shape (critical)
Any item passed to `props.onAddToCart` MUST match Dashboard's exported `CartItem`:
`{ id, nombre, precio, cantidad, negocio, negocio_id, phone_number, tipo: 'producto'|'mandadito', emoji? }`.

**Why:** checkout reads `items[0].negocio` (e.g. `.negocio.toUpperCase()` and DB `negocio_nombre`). Emitting `merchant_name`/`merchant_id` instead of `negocio`/`negocio_id`/`phone_number` causes `undefined.toUpperCase()` crashes at order confirmation. Build `negocio` from the merchant row's `name`, `phone_number` from merchant `phone_number ?? PHONE_OPERATIVO ("522223339999")`.
