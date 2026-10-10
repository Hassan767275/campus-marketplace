// Dev seed: 5 verified test users and 20 listings across several categories.
// Run: npm run seed -w server 

import { prisma } from "../src/db.js";
import type { ListingCategory } from "../src/generated/prisma/client.js";

const SCHOOL_DOMAIN = "mcmaster.ca";

const seedId = (n: number) => `00000000-0000-4000-a000-${String(n).padStart(12, "0")}`;

type SeedUser = { id: string; email: string; displayName: string };

const users: SeedUser[] = [
  { id: seedId(101), email: `seed.alex.chen@${SCHOOL_DOMAIN}`, displayName: "Alex Chen" },
  { id: seedId(102), email: `seed.priya.patel@${SCHOOL_DOMAIN}`, displayName: "Priya Patel" },
  { id: seedId(103), email: `seed.jordan.smith@${SCHOOL_DOMAIN}`, displayName: "Jordan Smith" },
  { id: seedId(104), email: `seed.fatima.ali@${SCHOOL_DOMAIN}`, displayName: "Fatima Ali" },
  { id: seedId(105), email: `seed.marcus.lee@${SCHOOL_DOMAIN}`, displayName: "Marcus Lee" },
];

type SeedListing = {
  title: string;
  description: string;
  category: ListingCategory;
  priceCents: number;
  seller: number; 
};

const listings: SeedListing[] = [
  // TEXTBOOKS
  { seller: 0, category: "TEXTBOOKS", priceCents: 4500, title: "Calculus: Early Transcendentals (Stewart, 9th ed.)", description: "Used for MATH 1ZA3/1ZB3. Some highlighting in the first few chapters, otherwise clean." },
  { seller: 1, category: "TEXTBOOKS", priceCents: 3000, title: "Campbell Biology, 12th edition", description: "Good condition, no writing inside. Cover has a small crease." },
  { seller: 2, category: "TEXTBOOKS", priceCents: 2500, title: "Intro to Algorithms (CLRS), 4th ed.", description: "Hardcover. Bought for a data structures course and barely opened it." },
  { seller: 3, category: "TEXTBOOKS", priceCents: 1800, title: "Organic Chemistry study guide + solutions manual", description: "Klein, 4th ed. Solutions manual is the full one, not the abridged version." },
  // ELECTRONICS
  { seller: 4, category: "ELECTRONICS", priceCents: 9000, title: "TI-84 Plus CE graphing calculator", description: "Works perfectly, comes with charging cable. Approved for most exams." },
  { seller: 0, category: "ELECTRONICS", priceCents: 12000, title: "Sony WH-CH720N noise-cancelling headphones", description: "About a year old, battery still lasts all day. Includes case." },
  { seller: 1, category: "ELECTRONICS", priceCents: 14000, title: '24" 1080p monitor (Dell)', description: "No dead pixels. HDMI cable included. Pickup near campus." },
  { seller: 2, category: "ELECTRONICS", priceCents: 3500, title: "Logitech mechanical keyboard", description: "Tactile switches, full size. A couple of keycaps are slightly shiny from use." },
  // FURNITURE
  { seller: 3, category: "FURNITURE", priceCents: 4000, title: "IKEA desk chair (Markus)", description: "Moving out at the end of term. Adjustable height, mesh back." },
  { seller: 4, category: "FURNITURE", priceCents: 2500, title: "Small bookshelf, 3 shelves", description: "White, about 1 m tall. Easy to carry, fits in a car back seat." },
  { seller: 0, category: "FURNITURE", priceCents: 1500, title: "LED desk lamp with USB port", description: "Three brightness levels. Works great for late-night studying." },
  // CLOTHING
  { seller: 1, category: "CLOTHING", priceCents: 3500, title: "McMaster hoodie, size M", description: "Maroon, worn a handful of times. No stains or pilling." },
  { seller: 2, category: "CLOTHING", priceCents: 6000, title: "Winter parka, men's L", description: "Warm enough for Hamilton winters. Zipper and hood in good shape." },
  { seller: 3, category: "CLOTHING", priceCents: 4000, title: "Running shoes, women's size 8", description: "Lightly used, switched brands. Plenty of tread left." },
  // KITCHEN
  { seller: 4, category: "KITCHEN", priceCents: 2000, title: "Mini rice cooker (3-cup)", description: "Perfect for a dorm or a small apartment. Inner pot is non-stick." },
  { seller: 0, category: "KITCHEN", priceCents: 1200, title: "Electric kettle", description: "1.7 L, auto shut-off. Descaled recently." },
  { seller: 1, category: "KITCHEN", priceCents: 2500, title: "Pots and pans starter set", description: "Two pots, one frying pan, lids included. Some wear on the pan." },
  // SPORTS
  { seller: 2, category: "SPORTS", priceCents: 2500, title: "Adjustable dumbbells, pair (up to 10 kg)", description: "Spin-lock style. All plates included." },
  { seller: 3, category: "SPORTS", priceCents: 18000, title: "Road bike, 54 cm frame", description: "Recently tuned up. Comes with a lock. Some scratches on the frame." },
  // OTHER
  { seller: 4, category: "OTHER", priceCents: 1000, title: "Mini fridge thermometer + storage bins bundle", description: "Leftover dorm stuff: 4 stackable bins and a fridge thermometer." },
];

async function main() {
  const now = new Date();

  for (const u of users) {
    const data = { email: u.email, displayName: u.displayName, emailVerifiedAt: now };
    await prisma.user.upsert({ where: { id: u.id }, create: { id: u.id, ...data }, update: data });
  }

  for (const [i, l] of listings.entries()) {
    const id = seedId(201 + i);
    const data = {
      sellerId: users[l.seller].id,
      title: l.title,
      description: l.description,
      category: l.category,
      priceCents: l.priceCents,
      photoUrls: [] as string[], 
      status: "ACTIVE" as const,
    };
    await prisma.listing.upsert({ where: { id }, create: { id, ...data }, update: data });
  }

  console.log(`Seeded ${users.length} users and ${listings.length} listings.`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());