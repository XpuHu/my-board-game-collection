ALTER TABLE "preorders" ADD COLUMN "parent_id" TEXT REFERENCES "preorders"("id") ON DELETE CASCADE;
ALTER TABLE "preorders" ADD COLUMN "pricing_mode" TEXT NOT NULL DEFAULT 'per_item';
ALTER TABLE "preorders" ADD COLUMN "payment_type" TEXT NOT NULL DEFAULT 'unspecified';
ALTER TABLE "preorders" ADD COLUMN "price_known" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX "preorders_parent_id_idx" ON "preorders"("parent_id");
-- Old atomic item actions record exactly which expansion orders belong together.
UPDATE "preorders" SET "parent_id" = (
  SELECT json_extract(receipt.result, '$.preorderId')
  FROM "command_receipts" AS receipt, json_each(receipt.result, '$.expansionPreorderIds') AS child
  WHERE receipt.kind = 'item-action' AND child.value = "preorders".id
    AND EXISTS (SELECT 1 FROM "preorders" root WHERE root.id = json_extract(receipt.result, '$.preorderId'))
  LIMIT 1
) WHERE id IN (
  SELECT child.value FROM "command_receipts" AS receipt, json_each(receipt.result, '$.expansionPreorderIds') AS child
  WHERE receipt.kind = 'item-action'
);
