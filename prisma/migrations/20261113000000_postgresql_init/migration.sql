-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "item_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" TEXT NOT NULL,
    "type_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "original_title" TEXT,
    "description" TEXT,
    "year" INTEGER,
    "min_players" INTEGER,
    "max_players" INTEGER,
    "min_play_time" INTEGER,
    "max_play_time" INTEGER,
    "min_age" INTEGER,
    "complexity" DECIMAL(65,30),
    "rating" DECIMAL(65,30),
    "source_mode" TEXT NOT NULL DEFAULT 'manual',
    "categories" JSONB,
    "mechanics" JSONB,
    "designers" JSONB,
    "artists" JSONB,
    "publishers" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_items" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "owned" BOOLEAN NOT NULL DEFAULT false,
    "wishlist" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'wishlist',
    "owned_at" TIMESTAMP(3),
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "personal_rating" INTEGER,
    "notes" TEXT,
    "interest_level" INTEGER,
    "decision_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_references" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "url" TEXT,
    "last_sync" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "play_sessions" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "played_at" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "players_count" INTEGER,
    "duration_minutes" INTEGER,
    "result" TEXT,
    "score" TEXT,
    "scenario" TEXT,
    "player_names" JSONB,
    "used_item_ids" JSONB,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "bgg_play_id" TEXT,
    "locally_modified_at" TIMESTAMP(3),
    "imported_at" TIMESTAMP(3),
    "personal_rating" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "play_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mechanics" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mechanics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_mechanics" (
    "item_id" TEXT NOT NULL,
    "mechanic_id" TEXT NOT NULL,

    CONSTRAINT "item_mechanics_pkey" PRIMARY KEY ("item_id","mechanic_id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_categories" (
    "item_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,

    CONSTRAINT "item_categories_pkey" PRIMARY KEY ("item_id","category_id")
);

-- CreateTable
CREATE TABLE "designers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "designers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_designers" (
    "item_id" TEXT NOT NULL,
    "designer_id" TEXT NOT NULL,

    CONSTRAINT "item_designers_pkey" PRIMARY KEY ("item_id","designer_id")
);

-- CreateTable
CREATE TABLE "artists" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_artists" (
    "item_id" TEXT NOT NULL,
    "artist_id" TEXT NOT NULL,

    CONSTRAINT "item_artists_pkey" PRIMARY KEY ("item_id","artist_id")
);

-- CreateTable
CREATE TABLE "publishers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publishers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_publishers" (
    "item_id" TEXT NOT NULL,
    "publisher_id" TEXT NOT NULL,

    CONSTRAINT "item_publishers_pkey" PRIMARY KEY ("item_id","publisher_id")
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL,
    "delivery_cost" DECIMAL(65,30),
    "discount" DECIMAL(65,30),
    "total_price" DECIMAL(65,30) NOT NULL,
    "purchase_date" TIMESTAMP(3),
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preorders" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "pricing_mode" TEXT NOT NULL DEFAULT 'per_item',
    "payment_type" TEXT NOT NULL DEFAULT 'unspecified',
    "price_known" BOOLEAN NOT NULL DEFAULT true,
    "shop" TEXT NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL,
    "order_date" TIMESTAMP(3),
    "expected_date" TIMESTAMP(3),
    "expected_date_precision" TEXT NOT NULL DEFAULT 'day',
    "received_date" TIMESTAMP(3),
    "tracking_number" TEXT,
    "status" TEXT NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "preorders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preorder_events" (
    "id" TEXT NOT NULL,
    "preorder_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "reason" TEXT,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "preorder_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "images" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT,
    "url" TEXT,
    "path" TEXT,
    "caption" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_relations" (
    "id" TEXT NOT NULL,
    "parent_item_id" TEXT NOT NULL,
    "child_item_id" TEXT NOT NULL,
    "relation_type" TEXT NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "links" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "command_receipts" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "command_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ItemTags" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ItemTags_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "item_types_code_key" ON "item_types"("code");

-- CreateIndex
CREATE INDEX "items_title_idx" ON "items"("title");

-- CreateIndex
CREATE INDEX "items_original_title_idx" ON "items"("original_title");

-- CreateIndex
CREATE INDEX "items_type_id_idx" ON "items"("type_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_items_item_id_key" ON "user_items"("item_id");

-- CreateIndex
CREATE INDEX "user_items_owned_idx" ON "user_items"("owned");

-- CreateIndex
CREATE INDEX "user_items_wishlist_idx" ON "user_items"("wishlist");

-- CreateIndex
CREATE INDEX "user_items_status_idx" ON "user_items"("status");

-- CreateIndex
CREATE INDEX "user_items_favorite_idx" ON "user_items"("favorite");

-- CreateIndex
CREATE INDEX "user_items_owned_owned_at_idx" ON "user_items"("owned", "owned_at");

-- CreateIndex
CREATE INDEX "external_references_item_id_idx" ON "external_references"("item_id");

-- CreateIndex
CREATE INDEX "external_references_provider_idx" ON "external_references"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "external_references_provider_external_id_key" ON "external_references"("provider", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "play_sessions_bgg_play_id_key" ON "play_sessions"("bgg_play_id");

-- CreateIndex
CREATE INDEX "play_sessions_item_id_idx" ON "play_sessions"("item_id");

-- CreateIndex
CREATE INDEX "play_sessions_played_at_idx" ON "play_sessions"("played_at");

-- CreateIndex
CREATE INDEX "play_sessions_bgg_play_id_idx" ON "play_sessions"("bgg_play_id");

-- CreateIndex
CREATE UNIQUE INDEX "mechanics_normalized_name_key" ON "mechanics"("normalized_name");

-- CreateIndex
CREATE INDEX "item_mechanics_mechanic_id_idx" ON "item_mechanics"("mechanic_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_normalized_name_key" ON "categories"("normalized_name");

-- CreateIndex
CREATE INDEX "item_categories_category_id_idx" ON "item_categories"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "designers_normalized_name_key" ON "designers"("normalized_name");

-- CreateIndex
CREATE INDEX "item_designers_designer_id_idx" ON "item_designers"("designer_id");

-- CreateIndex
CREATE UNIQUE INDEX "artists_normalized_name_key" ON "artists"("normalized_name");

-- CreateIndex
CREATE INDEX "item_artists_artist_id_idx" ON "item_artists"("artist_id");

-- CreateIndex
CREATE UNIQUE INDEX "publishers_normalized_name_key" ON "publishers"("normalized_name");

-- CreateIndex
CREATE INDEX "item_publishers_publisher_id_idx" ON "item_publishers"("publisher_id");

-- CreateIndex
CREATE INDEX "purchases_item_id_idx" ON "purchases"("item_id");

-- CreateIndex
CREATE INDEX "preorders_item_id_idx" ON "preorders"("item_id");

-- CreateIndex
CREATE INDEX "preorders_status_idx" ON "preorders"("status");

-- CreateIndex
CREATE INDEX "preorders_expected_date_idx" ON "preorders"("expected_date");

-- CreateIndex
CREATE INDEX "preorders_parent_id_idx" ON "preorders"("parent_id");

-- CreateIndex
CREATE INDEX "preorder_events_preorder_id_idx" ON "preorder_events"("preorder_id");

-- CreateIndex
CREATE INDEX "images_item_id_idx" ON "images"("item_id");

-- CreateIndex
CREATE INDEX "notes_item_id_idx" ON "notes"("item_id");

-- CreateIndex
CREATE INDEX "item_relations_parent_item_id_idx" ON "item_relations"("parent_item_id");

-- CreateIndex
CREATE INDEX "item_relations_child_item_id_idx" ON "item_relations"("child_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "item_relations_parent_item_id_child_item_id_relation_type_key" ON "item_relations"("parent_item_id", "child_item_id", "relation_type");

-- CreateIndex
CREATE INDEX "links_item_id_idx" ON "links"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE INDEX "_ItemTags_B_index" ON "_ItemTags"("B");

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "item_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_items" ADD CONSTRAINT "user_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_references" ADD CONSTRAINT "external_references_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "play_sessions" ADD CONSTRAINT "play_sessions_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_mechanics" ADD CONSTRAINT "item_mechanics_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_mechanics" ADD CONSTRAINT "item_mechanics_mechanic_id_fkey" FOREIGN KEY ("mechanic_id") REFERENCES "mechanics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_categories" ADD CONSTRAINT "item_categories_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_categories" ADD CONSTRAINT "item_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_designers" ADD CONSTRAINT "item_designers_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_designers" ADD CONSTRAINT "item_designers_designer_id_fkey" FOREIGN KEY ("designer_id") REFERENCES "designers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_artists" ADD CONSTRAINT "item_artists_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_artists" ADD CONSTRAINT "item_artists_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_publishers" ADD CONSTRAINT "item_publishers_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_publishers" ADD CONSTRAINT "item_publishers_publisher_id_fkey" FOREIGN KEY ("publisher_id") REFERENCES "publishers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preorders" ADD CONSTRAINT "preorders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "preorders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preorders" ADD CONSTRAINT "preorders_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preorder_events" ADD CONSTRAINT "preorder_events_preorder_id_fkey" FOREIGN KEY ("preorder_id") REFERENCES "preorders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "images" ADD CONSTRAINT "images_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_relations" ADD CONSTRAINT "item_relations_parent_item_id_fkey" FOREIGN KEY ("parent_item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_relations" ADD CONSTRAINT "item_relations_child_item_id_fkey" FOREIGN KEY ("child_item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "links" ADD CONSTRAINT "links_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ItemTags" ADD CONSTRAINT "_ItemTags_A_fkey" FOREIGN KEY ("A") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ItemTags" ADD CONSTRAINT "_ItemTags_B_fkey" FOREIGN KEY ("B") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
