import "dotenv/config";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// These run against the real database (DATABASE_URL) because the invariants
// live in Postgres triggers. ledger_entries is append-only, so no test may
// leave rows behind: every transaction either fails or is rolled back.

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

beforeAll(async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
});

afterAll(async () => {
  await pool.end();
});

type Entry = { account: string; amountCents: number };

async function insertEntries(client: pg.PoolClient, txId: string, entries: Entry[]) {
  for (const e of entries) {
    await client.query(
      `INSERT INTO ledger_entries (transaction_id, account, amount_cents, kind)
       VALUES ($1, $2, $3, 'TEST')`,
      [txId, e.account, e.amountCents],
    );
  }
}

// Runs fn inside BEGIN ... ROLLBACK so nothing persists.
async function inRolledBackTx<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    return await fn(client);
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    client.release();
  }
}

// $50 sale with $5 fee, capture step (from CLAUDE.md).
const balancedCapture: Entry[] = [
  { account: "escrow_held", amountCents: -5000 },
  { account: "seller_payable", amountCents: 4500 },
  { account: "platform_fees", amountCents: 500 },
];

async function countEntries(txId: string): Promise<number> {
  const { rows } = await pool.query(
    "SELECT count(*)::int AS n FROM ledger_entries WHERE transaction_id = $1",
    [txId],
  );
  return rows[0].n;
}

describe("ledger_entries: transactions must sum to zero", () => {
  it("rejects an unbalanced transaction at COMMIT, not at INSERT", async () => {
    const txId = randomUUID();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Each INSERT succeeds: the check is deferred until commit.
      await insertEntries(client, txId, [
        { account: "escrow_held", amountCents: 5000 },
        { account: "buyer_funds", amountCents: -4999 },
      ]);
      await expect(client.query("COMMIT")).rejects.toThrow(/unbalanced/);
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
    expect(await countEntries(txId)).toBe(0);
  });

  it("accepts a balanced transaction when the deferred check runs", async () => {
    const txId = randomUUID();
    await inRolledBackTx(async (client) => {
      await insertEntries(client, txId, balancedCapture);
      // Fire the deferred constraint now; this is the same check COMMIT runs.
      // We roll back afterwards because committed rows could never be removed.
      await expect(client.query("SET CONSTRAINTS ALL IMMEDIATE")).resolves.toBeDefined();
      const { rows } = await client.query(
        "SELECT sum(amount_cents)::int AS total, count(*)::int AS n FROM ledger_entries WHERE transaction_id = $1",
        [txId],
      );
      expect(rows[0]).toEqual({ total: 0, n: 3 });
    });
  });
});

describe("ledger_entries: append-only", () => {
  async function withBalancedRow(fn: (client: pg.PoolClient, txId: string) => Promise<void>) {
    const txId = randomUUID();
    await inRolledBackTx(async (client) => {
      await insertEntries(client, txId, balancedCapture);
      await client.query("SET CONSTRAINTS ALL IMMEDIATE");
      await fn(client, txId);
    });
  }

  it("rejects UPDATE", async () => {
    await withBalancedRow(async (client, txId) => {
      await expect(
        client.query("UPDATE ledger_entries SET amount_cents = 0 WHERE transaction_id = $1", [txId]),
      ).rejects.toThrow(/append-only \(UPDATE not allowed\)/);
    });
  });

  it("rejects DELETE", async () => {
    await withBalancedRow(async (client, txId) => {
      await expect(
        client.query("DELETE FROM ledger_entries WHERE transaction_id = $1", [txId]),
      ).rejects.toThrow(/append-only \(DELETE not allowed\)/);
    });
  });
});
