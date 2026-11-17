ALTER TABLE "preorders"
ADD COLUMN "delivery_method" TEXT NOT NULL DEFAULT 'unspecified',
ADD COLUMN "delivery_cost" DECIMAL;
