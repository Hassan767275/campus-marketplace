import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  IllegalTransitionError,
  OrderNotFoundError,
  StaleOrderError,
  transition,
} from "../src/orders/stateMachine.js";
import { cleanup, createTestUser, prisma } from "./helpers/api.js";

// Runs against the real database (DATABASE_URL): the guarantee under test is
// the conditional UPDATE, which only Postgres can prove. Orders are created
// for this file's test users and removed by cleanup().

let buyerId: string;
let sellerId: string;
let listingId: string;

beforeAll(async () => {
  const buyer = await createTestUser("sm-buyer");
  const seller = await createTestUser("sm-seller");
  buyerId = buyer.id;
  sellerId = seller.id;
  const listing = await prisma.listing.create({
    data: { sellerId, title: "state machine test", description: "test", category: "OTHER", priceCents: 5000 },
  });
  listingId = listing.id;
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

function createOrder() {
  return prisma.order.create({
    data: { listingId, buyerId, sellerId, amountCents: 5000, platformFeeCents: 500 },
    select: { id: true, state: true, version: true },
  });
}

async function readOrder(id: string) {
  return prisma.order.findUniqueOrThrow({ where: { id }, select: { state: true, version: true } });
}

describe("transition()", () => {
  it("moves a legal transition and bumps the version", async () => {
    const order = await createOrder();
    expect(order).toMatchObject({ state: "CREATED", version: 0 });

    const r1 = await transition(prisma, order.id, "CREATED", "AUTHORIZED", 0);
    expect(r1).toEqual({ orderId: order.id, state: "AUTHORIZED", version: 1 });
    const r2 = await transition(prisma, order.id, "AUTHORIZED", "CAPTURED", 1);
    expect(r2.version).toBe(2);
    expect(await readOrder(order.id)).toEqual({ state: "CAPTURED", version: 2 });
  });

  it("rejects an illegal transition without touching the row", async () => {
    const order = await createOrder();
    await expect(transition(prisma, order.id, "CREATED", "CAPTURED", 0)).rejects.toBeInstanceOf(IllegalTransitionError);
    await expect(transition(prisma, order.id, "CREATED", "CREATED", 0)).rejects.toBeInstanceOf(IllegalTransitionError);
    expect(await readOrder(order.id)).toEqual({ state: "CREATED", version: 0 });
  });

  it("rejects a stale version", async () => {
    const order = await createOrder();
    await transition(prisma, order.id, "CREATED", "AUTHORIZED", 0);
    const err = await transition(prisma, order.id, "AUTHORIZED", "VOIDED", 0).catch((e) => e);
    expect(err).toBeInstanceOf(StaleOrderError);
    expect(err.actual).toEqual({ state: "AUTHORIZED", version: 1 });
    expect(await readOrder(order.id)).toEqual({ state: "AUTHORIZED", version: 1 });
  });

  it("rejects when the order is not in the claimed from-state", async () => {
    const order = await createOrder();
    // Legal move, right version, but the order is CREATED, not AUTHORIZED.
    await expect(transition(prisma, order.id, "AUTHORIZED", "CAPTURED", 0)).rejects.toBeInstanceOf(StaleOrderError);
    expect(await readOrder(order.id)).toEqual({ state: "CREATED", version: 0 });
  });

  it("rejects an unknown order id", async () => {
    await expect(transition(prisma, randomUUID(), "CREATED", "AUTHORIZED", 0)).rejects.toBeInstanceOf(OrderNotFoundError);
    await expect(transition(prisma, "not-a-uuid", "CREATED", "AUTHORIZED", 0)).rejects.toBeInstanceOf(OrderNotFoundError);
  });

  it("lets exactly one of two concurrent updates with the same version win", async () => {
    const order = await createOrder();
    await transition(prisma, order.id, "CREATED", "AUTHORIZED", 0);

    // QR capture vs deadline void, racing on version 1.
    const results = await Promise.allSettled([
      transition(prisma, order.id, "AUTHORIZED", "CAPTURED", 1),
      transition(prisma, order.id, "AUTHORIZED", "VOIDED", 1),
    ]);
    const won = results.filter((r) => r.status === "fulfilled");
    const lost = results.filter((r) => r.status === "rejected");
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);
    expect((lost[0] as PromiseRejectedResult).reason).toBeInstanceOf(StaleOrderError);

    const winner = (won[0] as PromiseFulfilledResult<{ state: string }>).value.state;
    expect(await readOrder(order.id)).toEqual({ state: winner, version: 2 });
  });

  it("writes extra fields in the same update as the state change", async () => {
    const order = await createOrder();
    const authorizedAt = new Date("2026-10-22T12:00:00.000Z");
    const handoffDeadline = new Date("2026-10-25T12:00:00.000Z");

    await transition(prisma, order.id, "CREATED", "AUTHORIZED", 0, { authorizedAt, handoffDeadline });
    const row = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      select: { state: true, version: true, authorizedAt: true, handoffDeadline: true },
    });
    expect(row).toEqual({ state: "AUTHORIZED", version: 1, authorizedAt, handoffDeadline });
  });

  it("does not write extra fields when the transition loses", async () => {
    const order = await createOrder();
    await expect(
      transition(prisma, order.id, "CREATED", "AUTHORIZED", 5, { authorizedAt: new Date() }),
    ).rejects.toBeInstanceOf(StaleOrderError);
    const row = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, select: { authorizedAt: true } });
    expect(row.authorizedAt).toBeNull();
  });

  it("ignores state and version passed in extra fields", async () => {
    const order = await createOrder();
    const sneaky = { state: "PAID_OUT", version: 99 } as any;
    await transition(prisma, order.id, "CREATED", "AUTHORIZED", 0, sneaky);
    expect(await readOrder(order.id)).toEqual({ state: "AUTHORIZED", version: 1 });
  });

  it("rolls back with the caller's transaction", async () => {
    const order = await createOrder();
    await expect(
      prisma.$transaction(async (tx) => {
        await transition(tx, order.id, "CREATED", "AUTHORIZED", 0);
        throw new Error("later write failed");
      }),
    ).rejects.toThrow("later write failed");
    expect(await readOrder(order.id)).toEqual({ state: "CREATED", version: 0 });
  });
});
