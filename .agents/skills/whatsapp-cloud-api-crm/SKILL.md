---
name: whatsapp-cloud-api-crm
description: Build and verify a phone-based WhatsApp CRM using Meta Cloud API directly, isolated from existing order chats and restricted to Meta test-number activation.
---

# Direct WhatsApp Cloud API CRM

Use this for a phone-based inbox in an existing authenticated app, not for
`wa.me` links, copying a cellphone's chat history, or registering a live number.

## Establish the boundary

Inspect the existing contact/order schema before creating tables. Model a
contact by normalized international phone and a conversation by business
Phone Number ID + contact. The contact need not be an application user.
Courier assignment belongs to the conversation, not an order. Keep
assignment/archive/reopen events separate from messages.

For a test-only phase, require an explicit test channel and recipient
allowlist. Verify sender metadata before sending. Never call registration or
migration endpoints just to test messaging. Test-number display names,
recipient restrictions and token expiration remain controlled by Meta.

## Receive without losing or duplicating data

Verification GET compares the verify token and echoes `hub.challenge`.
For POST, verify `X-Hub-Signature-256` with the app secret over original raw
bytes. For Vercel Node handlers, disable body parsing:

```js
export const config = { api: { bodyParser: false } };
```

Persist events before acknowledging them. Deduplicate inbound `wamid`s,
claim processing with a database lease, and preserve failures for retry.
Never depend on an unawaited promise continuing after a serverless response.
If no scheduler is configured, expose that limitation and provide explicit
operator retry; do not imply there is an always-running worker.

On archive, preserve history. A genuinely newer incoming message may reopen
the case unassigned; old duplicate events must not reopen it. Status events
can arrive before the outbound response is committed; retain and retry those
instead of discarding them.

## Send with ownership and uncertainty controls

Authenticate the application JWT on the backend, read the database role and
check current conversation ownership. Reserve outbound sends atomically with
a nonce; serialize assignment/archive with in-flight sends. PostgreSQL nullable
assignee comparisons must be deny-by-default:

```sql
IF NOT coalesce((is_admin OR assigned_to = actor_id), false) THEN
  RAISE EXCEPTION 'Access denied';
END IF;
```

Use `/{phone_number_id}/messages` for text/media. Upload photos to
`/{phone_number_id}/media` first. API acceptance is not delivery; update actual
delivery/read/failure state from signed webhooks without allowing late events
to regress `read` to `sent`.

A transport timeout after posting may mean the message arrived. Mark it
unknown, preserve the nonce and never automatically resend. Expired database
send leases should become unknown rather than remaining stuck indefinitely.

Check the current 24-hour service window on the server. Reject free-form
messages outside it unless an approved template flow is explicitly built.

## Private images and tests

Resolve inbound media IDs through Graph with server credentials. Validate
download host, MIME and bounded size; refuse redirects to arbitrary hosts.
Persist images privately and issue short-lived URLs only after checking the
conversation. Previously delivered/downloaded bytes cannot be revoked.

Use mocked Graph requests for logic and failure tests, a transaction rolled
back for actual RLS/RPC tests, and browser fixtures for UI. For PWA apps,
use Playwright `serviceWorkers: "block"` so service-worker requests do not
bypass same-origin route interception. Keep auth validation intact.

Do not call mocked tests a real Meta test. Real end-to-end evidence requires
the test-number credentials, an approved recipient, public HTTPS webhook and
Meta subscription plus actual receipt on the recipient's phone.
