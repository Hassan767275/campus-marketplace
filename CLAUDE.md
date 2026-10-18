# Campus Marketplace

Student-to-student marketplace with PayPal escrow, QR handoff, and an AI risk engine + dispute agent. Built for the PayPal AI Hackathon (Devpost). **Submission deadline: Nov 12, 2026 (aim for Nov 11).**

Team: Hassan and Abubakr. Tasks aren't assigned to either person; whoever picks up a task owns it.

## Stack
- Web: React (Vite) + TypeScript, AG Grid for the admin dashboard
- API: Express + TypeScript
- Worker: pg-boss (job queue inside Postgres, no Redis)
- DB: Postgres (Supabase or Neon) with Prisma or Drizzle — the schema file is the source of truth
- Hosting: API on Render/Railway, web on Vercel
- Monorepo: `web/`, `api/`, `worker/`, shared types package

## Core principle
PayPal is the source of truth for money. Our database is the source of truth for intent. Most of the hard work is keeping those two in agreement when requests fail, retry, or arrive out of order.

## Payment model
Authorize, then capture (`intent: AUTHORIZE`). Buyer funds are held, not taken.
- QR scan at handoff → capture
- No handoff within 72 hours → void (buyer never charged)
- After capture → seller payout via Payouts, platform fee kept back
- Authorizations have a 3-day honor period and expire after 29 days (details below). Worker reauthorizes or voids near expiry.

## PayPal limits (from PayPal docs, checked Oct 17, 2026)
**Authorizations (Orders v2, `intent: AUTHORIZE`)**
- Honor period: **3 days** after authorizing. PayPal recommends capturing inside it; a capture after it can fail if the buyer's funds are no longer available.
- Authorization is valid for **29 days**. After the honor period you can reauthorize (several times, within the 29 days).
- Each reauthorization returns a **new authorization ID** and restarts the 3-day honor period. Save the new ID to `orders.paypal_authorization_id` and capture against it. Reauthorizing late shortens the honor period (e.g. day 27 → only 2 days left).
- PayPal voids the authorization itself when it expires and sends `PAYMENT.AUTHORIZATION.VOIDED`.
- Our 72-hour handoff deadline equals the honor period, so the normal flow never needs a reauthorization. Orders that outlive it (e.g. sitting in IN_DISPUTE) must be reauthorized before capture and resolved before day 29.
- Capture can exceed the authorized amount (up to 115% or +$75 USD, whichever is less). We never capture more than the authorized amount.

**Payouts**
- `sender_batch_id` must be unique for 30 days; a repeat is rejected and PayPal pays only once. Derive it from the order ID (e.g. `payout-<orderId>`) so retries are safe. After a 5xx, retry with the same `sender_batch_id`.
- One item per batch for us (limit is 15,000).
- Item statuses: PENDING, SUCCESS, UNCLAIMED, ON_HOLD, FAILED, BLOCKED, DENIED, RETURNED, REFUNDED. Our mapping: only SUCCESS → PAID_OUT; FAILED, BLOCKED, DENIED, RETURNED → PAYOUT_RETRY.
- UNCLAIMED (receiver has no PayPal account yet) is returned to us after **30 days**. An UNCLAIMED item can be cancelled (e.g. wrong receiver email), then re-sent.

**Webhooks**
- Respond with any 2xx quickly (store the event first, process later). Any other response is retried up to **25 times over 3 days**, so duplicates and out-of-order delivery are normal.
- Verify every event with `POST /v1/notifications/verify-webhook-signature`, sending `auth_algo`, `cert_url`, `transmission_id`, `transmission_sig`, `transmission_time` (from the `PAYPAL-*` request headers), our `webhook_id`, and the raw `webhook_event`. Accept only `verification_status: "SUCCESS"`.
- Events we use:
  - Authorizations: `PAYMENT.AUTHORIZATION.CREATED`, `PAYMENT.AUTHORIZATION.VOIDED`
  - Captures: `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.PENDING`, `PAYMENT.CAPTURE.DECLINED`, `PAYMENT.CAPTURE.REFUNDED`, `PAYMENT.CAPTURE.REVERSED`
  - Orders: `CHECKOUT.ORDER.APPROVED`
  - Payout items: `PAYMENT.PAYOUTS-ITEM.SUCCEEDED`, `.FAILED`, `.BLOCKED`, `.HELD`, `.UNCLAIMED`, `.RETURNED`, `.REFUNDED`, `.CANCELED`
  - Disputes: `CUSTOMER.DISPUTE.CREATED`, `CUSTOMER.DISPUTE.UPDATED`, `CUSTOMER.DISPUTE.RESOLVED`

## Order state machine
States: CREATED, BLOCKED, AUTHORIZED, VOIDED, IN_DISPUTE, REFUNDED, PARTIAL_REFUND, RELEASED, ESCALATED, CAPTURED, PAYOUT_PENDING, PAID_OUT, PAYOUT_RETRY

Legal transitions:
- CREATED → BLOCKED (risk high)
- CREATED → AUTHORIZED (buyer approves in PayPal)
- AUTHORIZED → VOIDED (deadline passes)
- AUTHORIZED → IN_DISPUTE (problem reported)
- IN_DISPUTE → REFUNDED | PARTIAL_REFUND | RELEASED | ESCALATED
- AUTHORIZED → CAPTURED (QR scan verified)
- CAPTURED → PAYOUT_PENDING → PAID_OUT
- PAYOUT_PENDING → PAYOUT_RETRY (payout fails)

Rules:
- All transitions go through one `transition(orderId, from, to, expectedVersion)` function. Illegal moves are rejected.
- Optimistic concurrency: `UPDATE orders SET state=$1, version=version+1 WHERE id=$2 AND version=$3`. Zero rows updated = someone else won.
- Stale webhooks (order already past that state) are logged and dropped.

## Ledger (double-entry)
- No balance fields. Every money movement is balanced debit/credit entries via `postTransaction(entries[])`.
- Amounts are **integer cents**. Every transaction's entries must sum to zero (enforced in DB).
- `ledger_entries` is append-only: never UPDATE or DELETE.
- Accounts: `escrow_held`, `buyer_funds`, `seller_payable`, `platform_fees`, `paid_out`
- Example ($50 sale, $5 fee): authorize → escrow_held +5000 / buyer_funds −5000; capture → escrow_held −5000 / seller_payable +4500 / platform_fees +500; payout → seller_payable −4500 / paid_out +4500
- Order state change + ledger entries + outbox row are written in **one DB transaction**.

## Reliability rules
- Every PayPal create/capture/refund/payout call sends a `PayPal-Request-Id` derived from order ID + action.
- PayPal calls happen on the server only.
- Webhooks: verify signature via PayPal's endpoint, dedupe with UNIQUE `event_id` + `ON CONFLICT DO NOTHING`.
- Transactional outbox; worker reads with `FOR UPDATE SKIP LOCKED`, retries with backoff, dead-letters after 5 failures.
- Reconciliation job compares ledger against PayPal and flags mismatches.

## QR handoff
QR holds a signed token (HMAC/JWT) bound to order ID, seller ID, single-use nonce, 5-min expiry. Only the buyer's logged-in session can redeem it. Server checks signature, nonce unused, not expired, then marks used. Scan log is dispute evidence.

## AI
- **The LLM never moves money directly.** It returns structured JSON; a deterministic policy layer decides.
- Risk engine: deterministic features → LLM classifier `{ risk: low|medium|high, reasons, signals }` → policy layer (hard rules are a floor, e.g. "e-transfer" in chat ⇒ at least medium) → normal / longer hold with warning / BLOCKED. Saved to `decisions`.
- Listing text and chat are **untrusted input** (prompt injection). Never let them unlock money.
- Evals: ~40 labeled listings/chats incl. injection cases; script reports precision and recall.
- Dispute agent: read tools (order, chat, photos, QR log, ledger) + action tools (full/partial refund, release, escalate) behind an approval gate above a set amount; refunds capped at amount paid; every decision saved with evidence, reasoning, approver, PayPal txn ID.

## Tables
users, listings, orders, ledger_entries, webhook_events, outbox, decisions, qr_tokens, chat_messages, disputes. Use JSONB for risk reasons, AI inputs/outputs, PayPal payloads.

## Phases
0. Setup (Oct 7–11): repo, schema, PayPal sandbox, deploy skeleton
1. Core marketplace (Oct 12–18): auth (school email only), listings, browse, chat
2. Payments core (Oct 19–25): authorize, QR capture, state machine, ledger
3. Reliability (Oct 26–Nov 1): webhooks, outbox, worker, payouts, dashboard
4. AI (Nov 2–7): risk engine + evals, dispute agent
5. Ship (Nov 8–12): chaos buttons, demo video, Devpost write-up

A phase is done only when its "Done when" check passes on the **deployed** app. Don't start next-phase tasks early. Fallback if behind by Nov 7: cut dispute escalation and reconciliation first.

## Working rules for Claude Code
- **Never run `git commit`, `git push`, or create PRs.** The developer commits themselves. When a task is done, stop and summarize what changed so they can review and commit.
- Work on feature branches; `main` always deploys. PRs reviewed by the other teammate.
- Secrets live in `.env` files only (gitignored). Never hardcode or commit keys, passwords, or tokens.
- Write tests for state transitions, concurrency, and ledger sums when touching that code.
- Keep changes scoped to the task asked; don't refactor unrelated areas.