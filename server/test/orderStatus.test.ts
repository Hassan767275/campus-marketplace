import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Api, cleanup, createTestUser, login, prisma, startApi } from "./helpers/api.js";

// Order status endpoints (GET /api/orders, GET /api/orders/:id) against the
// real database. Orders are inserted directly with no ledger entries, so
// cleanup() can delete them.

let api: Api;
let buyerId: string;
let sellerId: string;
let buyerToken: string;
let sellerToken: string;
let otherToken: string;

beforeAll(async () => {
  api = await startApi();
  const buyer = await createTestUser("status-buyer");
  const seller = await createTestUser("status-seller");
  const other = await createTestUser("status-other");
  buyerId = buyer.id;
  sellerId = seller.id;
  buyerToken = await login(api, buyer.email);
  sellerToken = await login(api, seller.email);
  otherToken = await login(api, other.email);
});

afterAll(async () => {
  await cleanup();
  await api.close();
  await prisma.$disconnect();
});

async function createOrder(state: "CREATED" | "AUTHORIZED" = "AUTHORIZED") {
  const listing = await prisma.listing.create({
    data: { sellerId, title: "status test", description: "test", category: "OTHER", priceCents: 5000, status: "RESERVED" },
    select: { id: true },
  });
  const now = Date.now();
  return prisma.order.create({
    data: {
      listingId: listing.id,
      buyerId,
      sellerId,
      state,
      version: state === "CREATED" ? 0 : 1,
      amountCents: 5000,
      platformFeeCents: 500,
      ...(state === "AUTHORIZED" && {
        authorizedAt: new Date(now),
        handoffDeadline: new Date(now + 72 * 60 * 60 * 1000),
      }),
    },
  });
}

describe("GET /api/orders/:id", () => {
  it("shows the order to its buyer and seller, each with their role", async () => {
    const order = await createOrder();

    const asBuyer = await api.call("GET", `/orders/${order.id}`, { token: buyerToken });
    expect(asBuyer.status).toBe(200);
    expect(asBuyer.body.order).toMatchObject({
      id: order.id,
      state: "AUTHORIZED",
      role: "buyer",
      amountCents: 5000,
      listing: { id: order.listingId, title: "status test" },
      seller: { displayName: "Test status-seller" },
      buyer: { displayName: "Test status-buyer" },
    });
    expect(asBuyer.body.order.handoffDeadline).toBe(order.handoffDeadline!.toISOString());

    const asSeller = await api.call("GET", `/orders/${order.id}`, { token: sellerToken });
    expect(asSeller.status).toBe(200);
    expect(asSeller.body.order.role).toBe("seller");
  });

  it("doesn't expose user ids or emails", async () => {
    const order = await createOrder();
    const res = await api.call("GET", `/orders/${order.id}`, { token: buyerToken });
    expect(res.body.order).not.toHaveProperty("buyerId");
    expect(res.body.order).not.toHaveProperty("sellerId");
    expect(JSON.stringify(res.body)).not.toContain("@");
  });

  it("returns 404 to anyone else, for bad ids, and for missing orders", async () => {
    const order = await createOrder();
    expect((await api.call("GET", `/orders/${order.id}`, { token: otherToken })).status).toBe(404);
    expect((await api.call("GET", "/orders/not-a-uuid", { token: buyerToken })).status).toBe(404);
    expect((await api.call("GET", `/orders/${crypto.randomUUID()}`, { token: buyerToken })).status).toBe(404);
  });

  it("requires login", async () => {
    const order = await createOrder();
    expect((await api.call("GET", `/orders/${order.id}`)).status).toBe(401);
  });
});

describe("GET /api/orders", () => {
  it("lists my bought and sold orders, without unpaid CREATED ones", async () => {
    const authorized = await createOrder("AUTHORIZED");
    const unpaid = await createOrder("CREATED");

    const asBuyer = await api.call("GET", "/orders", { token: buyerToken });
    expect(asBuyer.status).toBe(200);
    const buyerIds = asBuyer.body.orders.map((o: { id: string }) => o.id);
    expect(buyerIds).toContain(authorized.id);
    expect(buyerIds).not.toContain(unpaid.id);

    const asSeller = await api.call("GET", "/orders", { token: sellerToken });
    const sold = asSeller.body.orders.find((o: { id: string }) => o.id === authorized.id);
    expect(sold.role).toBe("seller");

    const asOther = await api.call("GET", "/orders", { token: otherToken });
    expect(asOther.body.orders).toEqual([]);
  });
});
