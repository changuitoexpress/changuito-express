---
name: Payment processing
description: Changuito Express payment country and payout model.
---

Changuito Express is legally registered in Mexico. Mercado Pago is the selected online payment gateway. Customer payments go to one central account; business settlements happen separately.

**Why:** The user confirmed the company's country is Mexico, chose a central payout account rather than automatic per-business splits, and approved Mercado Pago for in-app checkout.

**How to apply:** Route customer checkout to the central Mercado Pago account. Do not implement automatic marketplace split payouts unless the user changes this decision.
