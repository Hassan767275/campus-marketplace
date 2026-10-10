-- CreateEnum
CREATE TYPE "ListingCategory" AS ENUM ('TEXTBOOKS', 'ELECTRONICS', 'FURNITURE', 'CLOTHING', 'KITCHEN', 'SPORTS', 'TICKETS', 'OTHER');

-- AlterTable
-- Temporary default so this applies even if listings already has rows;
-- the default is dropped right after to match schema.prisma (category required).
ALTER TABLE "listings" ADD COLUMN "category" "ListingCategory" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "listings" ALTER COLUMN "category" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "listings_category_status_idx" ON "listings"("category", "status");