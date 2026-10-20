// Creates the public Supabase Storage bucket for listing photos.
// Run once per Supabase project: npm run storage:setup -w server
// Never prints the service role key.

import "dotenv/config";
import { LISTING_LIMITS } from "@campus/shared";
import { ensureBucket, getStorageConfig } from "../src/storage.js";

const config = getStorageConfig();
if (!config) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env first (see .env.example).");
  process.exit(1);
}

try {
  const result = await ensureBucket(config, {
    fileSizeLimit: LISTING_LIMITS.photoMaxBytes,
    allowedMimeTypes: LISTING_LIMITS.photoTypes,
  });
  console.log(result === "created" ? `Created public bucket "${config.bucket}".` : `Bucket "${config.bucket}" already exists.`);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
