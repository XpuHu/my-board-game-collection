ALTER TABLE "preorders" ADD COLUMN "order_url" TEXT;
ALTER TABLE "preorders" ADD COLUMN "payment_schedule" JSONB, ADD COLUMN "payment_version" INTEGER NOT NULL DEFAULT 0;
