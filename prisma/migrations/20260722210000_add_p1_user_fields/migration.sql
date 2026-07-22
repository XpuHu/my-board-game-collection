-- Persist user-controlled favourites and the semantic precision of preorder dates.
ALTER TABLE "user_items" ADD COLUMN "favorite" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "user_items_favorite_idx"
ON "user_items"("favorite");

ALTER TABLE "preorders"
ADD COLUMN "expected_date_precision" TEXT NOT NULL DEFAULT 'day';

UPDATE "preorders"
SET "expected_date_precision" = 'unknown'
WHERE "expected_date" IS NULL;
