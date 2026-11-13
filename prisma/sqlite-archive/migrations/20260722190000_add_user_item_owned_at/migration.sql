-- Add the stable collection-entry timestamp and backfill existing owned rows.
ALTER TABLE "user_items" ADD COLUMN "owned_at" DATETIME;

UPDATE "user_items"
SET "owned_at" = "created_at"
WHERE "owned" = true AND "owned_at" IS NULL;

CREATE INDEX "user_items_owned_owned_at_idx"
ON "user_items"("owned", "owned_at");
