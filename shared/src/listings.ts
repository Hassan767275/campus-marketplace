// Listing rules shared by the API (validation) and the client (forms, filters).
// Values match the Prisma `ListingCategory` and `ListingStatus` enums.

export const LISTING_CATEGORIES = [
  "TEXTBOOKS",
  "ELECTRONICS",
  "FURNITURE",
  "CLOTHING",
  "KITCHEN",
  "SPORTS",
  "TICKETS",
  "OTHER",
] as const;

export type ListingCategory = (typeof LISTING_CATEGORIES)[number];

export const LISTING_STATUSES = ["ACTIVE", "RESERVED", "SOLD", "REMOVED"] as const;

export type ListingStatus = (typeof LISTING_STATUSES)[number];

export function isListingCategory(value: unknown): value is ListingCategory {
  return typeof value === "string" && (LISTING_CATEGORIES as readonly string[]).includes(value);
}

export const LISTING_LIMITS = {
  titleMax: 100,
  descriptionMax: 2000,
  /** $1.00 */
  priceMinCents: 100,
  /** $5,000.00 */
  priceMaxCents: 500_000,
  photosMax: 6,
  photoMaxBytes: 5 * 1024 * 1024,
  photoTypes: ["image/jpeg", "image/png", "image/webp"],
} as const;
