-- Scan log for the QR handoff: one row per scan attempt, accepted or not.

-- CreateEnum
CREATE TYPE "QrScanResult" AS ENUM ('ACCEPTED', 'REJECTED', 'FAILED');

-- CreateTable
CREATE TABLE "qr_scans" (
    "id" UUID NOT NULL,
    "order_id" UUID,
    "qr_token_id" UUID,
    "scanner_id" UUID NOT NULL,
    "result" "QrScanResult" NOT NULL,
    "reason" TEXT NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qr_scans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "qr_scans_order_id_created_at_idx" ON "qr_scans"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "qr_scans_qr_token_id_idx" ON "qr_scans"("qr_token_id");

-- CreateIndex
CREATE INDEX "qr_scans_scanner_id_idx" ON "qr_scans"("scanner_id");

-- AddForeignKey
ALTER TABLE "qr_scans" ADD CONSTRAINT "qr_scans_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_scans" ADD CONSTRAINT "qr_scans_qr_token_id_fkey" FOREIGN KEY ("qr_token_id") REFERENCES "qr_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_scans" ADD CONSTRAINT "qr_scans_scanner_id_fkey" FOREIGN KEY ("scanner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Block Supabase's Data API (see the enable_row_level_security migration).
ALTER TABLE "qr_scans" ENABLE ROW LEVEL SECURITY;
