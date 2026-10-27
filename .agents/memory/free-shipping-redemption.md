---
name: Free-shipping redemption
description: Keep wallet reward eligibility and checkout redemption consistent and single-use.
---

Determine free-shipping availability from `floor(delivered orders / 10) - redeemed rewards`, not only the current order-count cycle. Apply the delivery discount in checkout and record the order plus reward use atomically through a protected database function.

**Why:** Customer RLS permits reading their wallet but prevents direct wallet updates. A client-side update after order creation could fail, and separate calls could let parallel checkouts spend the same reward.

**How to apply:** Keep wallet displays and checkout on the shared eligibility calculation. Any future reward redemption or order-creation flow must preserve the database-side eligibility check and transaction.
