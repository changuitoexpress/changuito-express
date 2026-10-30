---
name: Session expiry notice
description: Customer-facing behavior and styling for session-expiry warnings.
---

Make the upcoming-expiry warning quiet and dismissible. Once dismissed for a given session expiry, do not show it again until the session receives a different expiry. Use a neutral background with a thin stripe in the four brand colors instead of a large yellow fill.

**Why:** The user said the repeated yellow warning disrupts the customer experience and asked for the brand colors.

**How to apply:** Preserve real expiry detection, announce the notice politely, persist only the dismissed expiry marker (never auth tokens), and reset the dismissal when a renewed session has a new expiry.
