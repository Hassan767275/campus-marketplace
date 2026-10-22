import { randomUUID } from "node:crypto";
import type { Db } from "../db.js";
import { LedgerAccount } from "../generated/prisma/enums.js";
import { isUuid } from "../ids.js";

// Double-entry ledger (see CLAUDE.md "Ledger"). This is the only writer of
// ledger_entries, and it only ever inserts. Postgres backs it up: a deferred
// trigger rejects any unbalanced transaction at COMMIT, and other triggers
// reject UPDATE, DELETE and TRUNCATE.
//
// Sign convention: + debit, - credit. Callers pass a Prisma transaction
// client so the entries commit together with the order's state change and
// outbox row.

// amount_cents is a Postgres integer (int4).
const INT4_MAX = 2_147_483_647;
const KIND_MAX = 64;

export type LedgerEntryInput = { account: LedgerAccount; amountCents: number };

/** Shared by every entry in the transaction. */
export type LedgerTransactionMeta = {
  kind: string; // AUTHORIZE, CAPTURE, VOID, REFUND, PAYOUT, ...
  orderId?: string | null;
  paypalRef?: string | null; // PayPal authorization/capture/payout id
};

export type PostedTransaction = { transactionId: string; entryCount: number };

/** The entries were refused before anything was written. */
export class LedgerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LedgerValidationError";
  }
}

function isLedgerAccount(value: unknown): value is LedgerAccount {
  return typeof value === "string" && Object.hasOwn(LedgerAccount, value);
}

function validate(entries: readonly LedgerEntryInput[], meta: LedgerTransactionMeta) {
  if (!Array.isArray(entries) || entries.length < 2) {
    throw new LedgerValidationError("A ledger transaction needs at least two entries");
  }
  let sum = 0;
  for (const [i, e] of entries.entries()) {
    if (!isLedgerAccount(e?.account)) {
      throw new LedgerValidationError(`Entry ${i}: unknown account ${String(e?.account)}`);
    }
    const cents = e.amountCents;
    if (typeof cents !== "number" || !Number.isInteger(cents)) {
      throw new LedgerValidationError(`Entry ${i}: amountCents must be integer cents, got ${String(cents)}`);
    }
    if (cents === 0) throw new LedgerValidationError(`Entry ${i}: amountCents must not be zero`);
    if (Math.abs(cents) > INT4_MAX) throw new LedgerValidationError(`Entry ${i}: amountCents out of range`);
    sum += cents; // exact: at most a few int4 values, far below 2^53
  }
  if (sum !== 0) throw new LedgerValidationError(`Ledger transaction is unbalanced (sum = ${sum})`);

  if (typeof meta?.kind !== "string" || !meta.kind.trim() || meta.kind.length > KIND_MAX) {
    throw new LedgerValidationError(`kind must be 1-${KIND_MAX} characters`);
  }
  if (meta.orderId != null && !isUuid(meta.orderId)) {
    throw new LedgerValidationError("orderId must be a UUID");
  }
  if (meta.paypalRef != null && typeof meta.paypalRef !== "string") {
    throw new LedgerValidationError("paypalRef must be a string");
  }
}

/**
 * Appends one balanced ledger transaction: every entry shares a new
 * transactionId and the amounts sum to zero. Refuses anything unbalanced,
 * non-integer, or zero before writing.
 */
export async function postTransaction(
  db: Db,
  entries: readonly LedgerEntryInput[],
  meta: LedgerTransactionMeta,
): Promise<PostedTransaction> {
  validate(entries, meta);

  const transactionId = randomUUID();
  const { count } = await db.ledgerEntry.createMany({
    data: entries.map((e) => ({
      transactionId,
      account: e.account,
      amountCents: e.amountCents,
      kind: meta.kind,
      orderId: meta.orderId ?? null,
      paypalRef: meta.paypalRef ?? null,
    })),
  });
  return { transactionId, entryCount: count };
}
