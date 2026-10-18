import { Router } from "express";
import { prisma } from "../db.js";

export const listingsRouter = Router();

// GET /api/listings — active listings, newest first.
// Filters (category, price range) and pagination come in task 1.2.
listingsRouter.get("/", async (_req, res) => {
  const listings = await prisma.listing.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      priceCents: true,
      currency: true,
      photoUrls: true,
      status: true,
      createdAt: true,
      // Only public seller fields; never expose email or PayPal email.
      seller: { select: { id: true, displayName: true } },
    },
  });
  res.json({ listings });
});
