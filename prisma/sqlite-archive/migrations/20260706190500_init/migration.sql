-- CreateTable
CREATE TABLE "item_types" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "items" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "complexity" DECIMAL,
    "rating" DECIMAL,
    "source_mode" TEXT NOT NULL DEFAULT 'manual',
    "categories" JSONB,
    "mechanics" JSONB,
    "designers" JSONB,
    "artists" JSONB,
    "publishers" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    CONSTRAINT "items_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "item_types" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "item_id" TEXT NOT NULL,
    "owned" BOOLEAN NOT NULL DEFAULT false,
    "wishlist" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'wishlist',
    "location" TEXT,
    "personal_rating" INTEGER,
    "notes" TEXT,
    "interest_level" INTEGER,
    "decision_notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "user_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "external_references" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "item_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "url" TEXT,
    "last_sync" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "external_references_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "play_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "item_id" TEXT NOT NULL,
    "played_at" DATETIME NOT NULL,
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
    "locally_modified_at" DATETIME,
    "imported_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "play_sessions_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "item_id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "price" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL,
    "delivery_cost" DECIMAL,
    "discount" DECIMAL,
    "total_price" DECIMAL NOT NULL,
    "purchase_date" DATETIME,
    "comment" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "purchases_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "preorders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "item_id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "price" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL,
    "order_date" DATETIME,
    "expected_date" DATETIME,
    "received_date" DATETIME,
    "tracking_number" TEXT,
    "status" TEXT NOT NULL,
    "comment" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "preorders_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "preorder_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "preorder_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "reason" TEXT,
    "comment" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "preorder_events_preorder_id_fkey" FOREIGN KEY ("preorder_id") REFERENCES "preorders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "images" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "item_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT,
    "url" TEXT,
    "path" TEXT,
    "caption" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "images_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "item_id" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "notes_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "item_relations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parent_item_id" TEXT NOT NULL,
    "child_item_id" TEXT NOT NULL,
    "relation_type" TEXT NOT NULL,
    "comment" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "item_relations_parent_item_id_fkey" FOREIGN KEY ("parent_item_id") REFERENCES "items" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "item_relations_child_item_id_fkey" FOREIGN KEY ("child_item_id") REFERENCES "items" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "item_relations_not_self_check" CHECK ("parent_item_id" <> "child_item_id")
);

-- CreateTable
CREATE TABLE "links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "item_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "links_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "_ItemTags" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ItemTags_A_fkey" FOREIGN KEY ("A") REFERENCES "items" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ItemTags_B_fkey" FOREIGN KEY ("B") REFERENCES "tags" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
CREATE INDEX "purchases_item_id_idx" ON "purchases"("item_id");

-- CreateIndex
CREATE INDEX "preorders_item_id_idx" ON "preorders"("item_id");

-- CreateIndex
CREATE INDEX "preorders_status_idx" ON "preorders"("status");

-- CreateIndex
CREATE INDEX "preorders_expected_date_idx" ON "preorders"("expected_date");

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
CREATE UNIQUE INDEX "_ItemTags_AB_unique" ON "_ItemTags"("A", "B");

-- CreateIndex
CREATE INDEX "_ItemTags_B_index" ON "_ItemTags"("B");
