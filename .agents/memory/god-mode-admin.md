---
name: God Mode admin scope
description: Decisions about the admin panel, per-business orders and the additive SQL upgrade file.
---
God Mode is split into modules under src/admin/ (resumen, productos, negocios, otros, gestión). Database changes for it go in supabase_admin_upgrade.sql, a separate additive file; supabase_setup.sql stays untouched.

**Why:** the user asked for full control from God Mode and per-business orders, but earlier required that the existing RLS and auth files not be rewritten.

**How to apply:** multi-business carts create one pedidos row per business (shipping on the first row) via crear_pedidos_multinegocio, with a direct-insert fallback when the function is not installed. Cashback is a per-business percentage (merchants.cashback_pct; NULL keeps the legacy 5% rule). Orders store no line items, so per-product cashback is not possible without a new items table.

**Mandaditos and restaurant catalog:** Mandaditos are businesses whose orders are written requests, not product catalogs. God Mode should keep them in a Mandaditos section and let the admin move one to Restaurants by choosing an existing restaurant category. The Restaurants section is where non-Mandaditos businesses and their editable products belong.

**Why:** the user clarified that Mandaditos do not have products and that the earlier admin sections were reversed.

**How to apply:** do not show Mandaditos businesses in the product catalog selector; route them to Restaurants only when the admin changes their category from `mandaditos` to a storefront restaurant category.
