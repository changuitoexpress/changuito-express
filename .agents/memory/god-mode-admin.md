---
name: God Mode admin scope
description: Decisions about the admin panel, per-business orders and the additive SQL upgrade file.
---
God Mode is split into modules under src/admin/ (resumen, productos, negocios, otros, gestión). Database changes for it go in supabase_admin_upgrade.sql, a separate additive file; supabase_setup.sql stays untouched.

**Why:** the user asked for full control from God Mode and per-business orders, but earlier required that the existing RLS and auth files not be rewritten.

**How to apply:** multi-business carts create one pedidos row per business (shipping on the first row) via crear_pedidos_multinegocio, with a direct-insert fallback when the function is not installed. Cashback is a per-business percentage (merchants.cashback_pct; NULL keeps the legacy 5% rule). Orders store no line items, so per-product cashback is not possible without a new items table.
