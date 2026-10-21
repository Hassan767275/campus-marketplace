import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Api, cleanup, createTestUser, login, prisma, startApi } from "./helpers/api.js";

// The database also holds seed and real listings, so filter tests use a price
// band no seeded listing uses and check every result, not just the count.
const BAND_MIN = 487_100;
const BAND_MAX = 487_199;

let api: Api;
let sellerToken: string;
let otherToken: string;
const ids: Record<string, string> = {};

async function createListing(token: string, data: { title: string; category: string; priceCents: number }) {
  const res = await api.call("POST", "/listings", { token, json: { description: "API test listing", ...data } });
  expect(res.status).toBe(201);
  return res.body.listing.id as string;
}

beforeAll(async () => {
  api = await startApi();
  const seller = await createTestUser("seller");
  const other = await createTestUser("other");
  sellerToken = await login(api, seller.email);
  otherToken = await login(api, other.email);

  ids.book = await createListing(sellerToken, { title: "apitest textbook", category: "TEXTBOOKS", priceCents: BAND_MIN + 10 });
  ids.cheapBook = await createListing(sellerToken, { title: "apitest cheap textbook", category: "TEXTBOOKS", priceCents: BAND_MIN });
  ids.lamp = await createListing(sellerToken, { title: "apitest lamp", category: "FURNITURE", priceCents: BAND_MIN + 50 });
  ids.laptop = await createListing(sellerToken, { title: "apitest laptop", category: "ELECTRONICS", priceCents: BAND_MAX });
  ids.sold = await createListing(sellerToken, { title: "apitest sold book", category: "TEXTBOOKS", priceCents: BAND_MIN + 20 });
  expect((await api.call("POST", `/listings/${ids.sold}/sold`, { token: sellerToken })).status).toBe(200);
});

afterAll(async () => {
  await cleanup();
  await api.close();
  await prisma.$disconnect();
});

async function browse(query: string) {
  const res = await api.call("GET", `/listings?${query}`);
  expect(res.status).toBe(200);
  return res.body.listings as Array<{ id: string; category: string; priceCents: number; status: string }>;
}

describe("GET /api/listings filters", () => {
  it("filters by price range, inclusive at both ends", async () => {
    const listings = await browse(`minPriceCents=${BAND_MIN}&maxPriceCents=${BAND_MAX}&limit=50`);
    expect(listings.map((l) => l.id).sort()).toEqual([ids.book, ids.cheapBook, ids.lamp, ids.laptop].sort());
  });

  it("filters by category and price together", async () => {
    const listings = await browse(`category=TEXTBOOKS&minPriceCents=${BAND_MIN + 1}&maxPriceCents=${BAND_MAX}`);
    expect(listings.map((l) => l.id)).toEqual([ids.book]);
  });

  it("accepts several categories, in any case", async () => {
    const listings = await browse(`category=furniture,Electronics&minPriceCents=${BAND_MIN}&maxPriceCents=${BAND_MAX}`);
    expect(listings.map((l) => l.id).sort()).toEqual([ids.lamp, ids.laptop].sort());
  });

  it("only returns listings matching a category filter on its own", async () => {
    const listings = await browse("category=TEXTBOOKS&limit=50");
    expect(listings.length).toBeGreaterThan(0);
    expect(listings.every((l) => l.category === "TEXTBOOKS" && l.status === "ACTIVE")).toBe(true);
    expect(listings.map((l) => l.id)).not.toContain(ids.sold);
  });

  it("leaves sold listings out of browse", async () => {
    const listings = await browse(`minPriceCents=${BAND_MIN}&maxPriceCents=${BAND_MAX}&limit=50`);
    expect(listings.map((l) => l.id)).not.toContain(ids.sold);
  });

  it("pages with a cursor without repeating or skipping", async () => {
    const q = `minPriceCents=${BAND_MIN}&maxPriceCents=${BAND_MAX}&limit=3`;
    const page1 = await api.call("GET", `/listings?${q}`);
    expect(page1.body.listings).toHaveLength(3);
    expect(page1.body.nextCursor).toEqual(expect.any(String));

    const page2 = await api.call("GET", `/listings?${q}&cursor=${page1.body.nextCursor}`);
    expect(page2.body.listings).toHaveLength(1);
    expect(page2.body.nextCursor).toBeNull();

    const all = [...page1.body.listings, ...page2.body.listings].map((l: { id: string }) => l.id).sort();
    expect(all).toEqual([ids.book, ids.cheapBook, ids.lamp, ids.laptop].sort());
  });

  it.each([
    "category=CARS",
    "minPriceCents=500&maxPriceCents=100",
    "minPriceCents=12.50",
    "maxPriceCents=-1",
    "limit=0",
    "limit=51",
    "cursor=not-a-uuid",
  ])("rejects bad filter %s with 400", async (query) => {
    const res = await api.call("GET", `/listings?${query}`);
    expect(res.status).toBe(400);
  });

  it("never exposes the seller's email", async () => {
    const res = await api.call("GET", `/listings/${ids.book}`);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.listing.seller).sort()).toEqual(["displayName", "id"]);
  });
});

describe("GET /api/listings/mine", () => {
  it("requires login", async () => {
    expect((await api.call("GET", "/listings/mine")).status).toBe(401);
  });

  it("returns the seller's own listings, including sold ones", async () => {
    const res = await api.call("GET", "/listings/mine", { token: sellerToken });
    expect(res.status).toBe(200);
    expect(res.body.listings.map((l: { id: string }) => l.id).sort()).toEqual(Object.values(ids).sort());
  });

  it("doesn't return anyone else's listings", async () => {
    const res = await api.call("GET", "/listings/mine", { token: otherToken });
    expect(res.status).toBe(200);
    expect(res.body.listings).toEqual([]);
  });
});

describe("only the seller can change a listing", () => {
  it("rejects an edit by another user and leaves the listing unchanged", async () => {
    const res = await api.call("PATCH", `/listings/${ids.lamp}`, { token: otherToken, json: { priceCents: 100, title: "hijacked" } });
    expect(res.status).toBe(403);

    const listing = await prisma.listing.findUniqueOrThrow({ where: { id: ids.lamp } });
    expect(listing.priceCents).toBe(BAND_MIN + 50);
    expect(listing.title).toBe("apitest lamp");
  });

  it("rejects mark-sold by another user", async () => {
    const res = await api.call("POST", `/listings/${ids.lamp}/sold`, { token: otherToken });
    expect(res.status).toBe(403);
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: ids.lamp } })).status).toBe("ACTIVE");
  });

  it("rejects photo changes by another user", async () => {
    const res = await api.call("DELETE", `/listings/${ids.lamp}/photos/x.jpg`, { token: otherToken });
    expect(res.status).toBe(403);
  });

  it("lets the seller edit, and ignores fields that aren't editable", async () => {
    const res = await api.call("PATCH", `/listings/${ids.laptop}`, {
      token: sellerToken,
      json: { priceCents: BAND_MAX - 1, status: "SOLD", sellerId: "00000000-0000-0000-0000-000000000000" },
    });
    expect(res.status).toBe(200);
    expect(res.body.listing).toMatchObject({ priceCents: BAND_MAX - 1, status: "ACTIVE" });
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: ids.laptop } })).sellerId).not.toBe(
      "00000000-0000-0000-0000-000000000000",
    );
  });

  it("refuses edits to a sold listing, even by the seller", async () => {
    const res = await api.call("PATCH", `/listings/${ids.sold}`, { token: sellerToken, json: { title: "too late" } });
    expect(res.status).toBe(409);
  });

  it("rejects prices that aren't whole cents in range", async () => {
    for (const priceCents of [12.5, 0, -100, 500_001, "1500"]) {
      const res = await api.call("PATCH", `/listings/${ids.book}`, { token: sellerToken, json: { priceCents } });
      expect(res.status, `priceCents=${JSON.stringify(priceCents)}`).toBe(400);
    }
  });
});
