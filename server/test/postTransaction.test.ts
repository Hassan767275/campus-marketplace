import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../src/db.js";
import { LedgerValidationError, postTransaction, type LedgerEntryInput } from "../src/ledger/postTransaction.js";
import { transition } from "../src/orders/stateMachine.js";
import { cleanup, createTestUser, prisma } from "./helpers/api.js";

// Runs against the real database (DATABASE_URL). ledger_entries is
// append-only, so no test may commit entries: everything that writes runs in
// inRolledBackTx(), which fires the deferred balance check before rolling back.

class Rollback extends Error {}

async function inRolledBackTx(fn: (tx: Db) => Promise<void>) {
  await expect(
    prisma.$transaction(async (tx) => {
      await fn(tx);
      throw new Rollback();
    }),
  ).rejects.toBeInstanceOf(Rollback);
}

// $50 sale with $5 fee (from CLAUDE.md).
const authorize: LedgerEntryInput[] = [
  { account: "escrow_held", amountCents: 5000 },
  { account: "buyer_funds", amountCents: -5000 },
];
const capture: LedgerEntryInput[] = [
  { account: "escrow_held", amountCents: -5000 },
  { account: "seller_payable", amountCents: 4500 },
  { account: "platform_fees", amountCents: 500 },
];

let orderId: string;

beforeAll(async () => {
  const buyer = await createTestUser("ledger-buyer");
  const seller = await createTestUser("ledger-seller");
  const listing = await prisma.listing.create({
    data: { sellerId: seller.id, title: "ledger test", description: "test", category: "OTHER", priceCents: 5000 },
  });
  const order = await prisma.order.create({
    data: { listingId: listing.id, buyerId: buyer.id, sellerId: seller.id, amountCents: 5000, platformFeeCents: 500 },
  });
  orderId = order.id;
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("postTransaction()", () => {
  it("writes balanced entries under one transaction id that the database accepts", async () => {
    await inRolledBackTx(async (tx) => {
      const posted = await postTransaction(tx, capture, { kind: "CAPTURE", orderId, paypalRef: "CAP-123" });
      expect(posted.entryCount).toBe(3);

      // Same check COMMIT would run; throws if Postgres sees it as unbalanced.
      await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;

      const rows = await tx.ledgerEntry.findMany({ where: { transactionId: posted.transactionId } });
      expect(rows).toHaveLength(3);
      expect(rows.reduce((s, r) => s + r.amountCents, 0)).toBe(0);
      for (const r of rows) expect(r).toMatchObject({ kind: "CAPTURE", orderId, paypalRef: "CAP-123" });
      expect(rows.map((r) => [r.account, r.amountCents]).sort()).toEqual(
        capture.map((e) => [e.account, e.amountCents]).sort(),
      );
    });
  });

  it("gives each call its own transaction id", async () => {
    await inRolledBackTx(async (tx) => {
      const a = await postTransaction(tx, authorize, { kind: "AUTHORIZE", orderId });
      const b = await postTransaction(tx, capture, { kind: "CAPTURE", orderId });
      expect(a.transactionId).not.toBe(b.transactionId);
      await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
    });
  });

  const refused: Array<[string, unknown]> = [
    ["an unbalanced transaction", [{ account: "escrow_held", amountCents: 5000 }, { account: "buyer_funds", amountCents: -4999 }]],
    ["fractional cents", [{ account: "escrow_held", amountCents: 50.5 }, { account: "buyer_funds", amountCents: -50.5 }]],
    ["amounts given as strings", [{ account: "escrow_held", amountCents: "5000" }, { account: "buyer_funds", amountCents: "-5000" }]],
    ["NaN", [{ account: "escrow_held", amountCents: NaN }, { account: "buyer_funds", amountCents: NaN }]],
    ["a zero entry", [{ account: "escrow_held", amountCents: 0 }, { account: "buyer_funds", amountCents: 0 }]],
    ["a single entry", [{ account: "escrow_held", amountCents: 0 }]],
    ["no entries", []],
    ["an unknown account", [{ account: "petty_cash", amountCents: 100 }, { account: "buyer_funds", amountCents: -100 }]],
    ["amounts beyond int4", [{ account: "escrow_held", amountCents: 3_000_000_000 }, { account: "buyer_funds", amountCents: -3_000_000_000 }]],
  ];

  it.each(refused)("refuses %s without writing anything", async (_label, entries) => {
    const kind = `TEST-${randomUUID()}`;
    await expect(postTransaction(prisma, entries as LedgerEntryInput[], { kind })).rejects.toBeInstanceOf(
      LedgerValidationError,
    );
    expect(await prisma.ledgerEntry.count({ where: { kind } })).toBe(0);
  });

  it("refuses a missing kind or malformed order id", async () => {
    await expect(postTransaction(prisma, authorize, { kind: "" })).rejects.toBeInstanceOf(LedgerValidationError);
    await expect(postTransaction(prisma, authorize, { kind: "AUTHORIZE", orderId: "nope" })).rejects.toBeInstanceOf(
      LedgerValidationError,
    );
  });

  it("rolls back together with the order's state change", async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await transition(tx, orderId, "CREATED", "AUTHORIZED", 0);
        await postTransaction(tx, authorize, { kind: "AUTHORIZE", orderId });
        throw new Error("outbox write failed");
      }),
    ).rejects.toThrow("outbox write failed");

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: { state: true, version: true } });
    expect(order).toEqual({ state: "CREATED", version: 0 });
    expect(await prisma.ledgerEntry.count({ where: { orderId } })).toBe(0);
  });
});
