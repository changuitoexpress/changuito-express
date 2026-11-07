---
name: WhatsApp CRM scope
description: User-defined separation of WhatsApp customer conversations from internal order chats.
---

The WhatsApp CRM must be independent of internal order chat. Most requests arrive through WhatsApp, not app orders. Identify customers by their WhatsApp phone number; a conversation must not require an app account or order. Use a separate conversation-to-courier assignment, never the order assignment as its basis.

**Why:** The user explicitly replaced the earlier draft that extended mandaditos chat with purchase-decision buttons. Their instruction is “Por la app, con control”.

**How to apply:** The administrator sees conversations in the main dashboard, assigns or reassigns couriers, supervises all messages and retains assignment history. Couriers reply and send purchase photos from Changuito; customers receive them on the business WhatsApp number without installing the app. Customer WhatsApp photos must reach the courier in the CRM. Closing a case archives its conversation without deleting history. Preserve the existing order-bound chat for customers who order within the app and their assigned couriers. Before implementing, confirm separate Supabase storage and the official WhatsApp Business webhook and send API flow. Do not reuse the superseded “Sí, cómpralo / Busca otra opción / No lo compres” model.

## Test phase boundary

Use Meta's official Cloud API directly, without an intermediary messaging subscription, and test with Meta's test number only. The real business number remains in the cellphone's WhatsApp Business app: do not register, migrate or otherwise change it during this phase.

**Why:** The user explicitly requested a test-number base while keeping live WhatsApp intake untouched.

**How to apply:** Keep real delivery verification separate from mocked provider/browser tests. A successful local suite is not evidence of a real WhatsApp delivery. Actual testing requires the user's Meta test credentials, approved recipient and a reachable subscribed webhook; never claim those are configured from code alone.
