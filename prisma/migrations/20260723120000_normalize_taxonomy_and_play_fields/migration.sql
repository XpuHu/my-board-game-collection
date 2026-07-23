ALTER TABLE "play_sessions" ADD COLUMN "started_at" DATETIME;
ALTER TABLE "play_sessions" ADD COLUMN "personal_rating" INTEGER;

CREATE TABLE "mechanics" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "normalized_name" TEXT NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "mechanics_normalized_name_key" ON "mechanics"("normalized_name");

CREATE TABLE "categories" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "normalized_name" TEXT NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "categories_normalized_name_key" ON "categories"("normalized_name");

CREATE TABLE "designers" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "normalized_name" TEXT NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "designers_normalized_name_key" ON "designers"("normalized_name");

CREATE TABLE "artists" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "normalized_name" TEXT NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "artists_normalized_name_key" ON "artists"("normalized_name");

CREATE TABLE "publishers" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "normalized_name" TEXT NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "publishers_normalized_name_key" ON "publishers"("normalized_name");

CREATE TABLE "item_mechanics" (
  "item_id" TEXT NOT NULL,
  "mechanic_id" TEXT NOT NULL,
  PRIMARY KEY ("item_id", "mechanic_id"),
  CONSTRAINT "item_mechanics_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "item_mechanics_mechanic_id_fkey" FOREIGN KEY ("mechanic_id") REFERENCES "mechanics" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "item_mechanics_mechanic_id_idx" ON "item_mechanics"("mechanic_id");

CREATE TABLE "item_categories" (
  "item_id" TEXT NOT NULL,
  "category_id" TEXT NOT NULL,
  PRIMARY KEY ("item_id", "category_id"),
  CONSTRAINT "item_categories_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "item_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "item_categories_category_id_idx" ON "item_categories"("category_id");

CREATE TABLE "item_designers" (
  "item_id" TEXT NOT NULL,
  "designer_id" TEXT NOT NULL,
  PRIMARY KEY ("item_id", "designer_id"),
  CONSTRAINT "item_designers_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "item_designers_designer_id_fkey" FOREIGN KEY ("designer_id") REFERENCES "designers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "item_designers_designer_id_idx" ON "item_designers"("designer_id");

CREATE TABLE "item_artists" (
  "item_id" TEXT NOT NULL,
  "artist_id" TEXT NOT NULL,
  PRIMARY KEY ("item_id", "artist_id"),
  CONSTRAINT "item_artists_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "item_artists_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "item_artists_artist_id_idx" ON "item_artists"("artist_id");

CREATE TABLE "item_publishers" (
  "item_id" TEXT NOT NULL,
  "publisher_id" TEXT NOT NULL,
  PRIMARY KEY ("item_id", "publisher_id"),
  CONSTRAINT "item_publishers_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "item_publishers_publisher_id_fkey" FOREIGN KEY ("publisher_id") REFERENCES "publishers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "item_publishers_publisher_id_idx" ON "item_publishers"("publisher_id");

INSERT OR IGNORE INTO "mechanics" ("id", "name", "normalized_name")
SELECT lower(hex(randomblob(16))), trim(j.value), lower(trim(j.value))
FROM "items" i, json_each(CASE WHEN json_valid(i."mechanics") THEN i."mechanics" ELSE '[]' END) j
WHERE typeof(j.value) = 'text' AND trim(j.value) <> ''
GROUP BY lower(trim(j.value));
INSERT OR IGNORE INTO "item_mechanics" ("item_id", "mechanic_id")
SELECT i."id", m."id" FROM "items" i, json_each(CASE WHEN json_valid(i."mechanics") THEN i."mechanics" ELSE '[]' END) j
JOIN "mechanics" m ON m."normalized_name" = lower(trim(j.value))
WHERE typeof(j.value) = 'text' AND trim(j.value) <> '';

INSERT OR IGNORE INTO "categories" ("id", "name", "normalized_name")
SELECT lower(hex(randomblob(16))), trim(j.value), lower(trim(j.value))
FROM "items" i, json_each(CASE WHEN json_valid(i."categories") THEN i."categories" ELSE '[]' END) j
WHERE typeof(j.value) = 'text' AND trim(j.value) <> ''
GROUP BY lower(trim(j.value));
INSERT OR IGNORE INTO "item_categories" ("item_id", "category_id")
SELECT i."id", c."id" FROM "items" i, json_each(CASE WHEN json_valid(i."categories") THEN i."categories" ELSE '[]' END) j
JOIN "categories" c ON c."normalized_name" = lower(trim(j.value))
WHERE typeof(j.value) = 'text' AND trim(j.value) <> '';

INSERT OR IGNORE INTO "designers" ("id", "name", "normalized_name")
SELECT lower(hex(randomblob(16))), trim(j.value), lower(trim(j.value))
FROM "items" i, json_each(CASE WHEN json_valid(i."designers") THEN i."designers" ELSE '[]' END) j
WHERE typeof(j.value) = 'text' AND trim(j.value) <> ''
GROUP BY lower(trim(j.value));
INSERT OR IGNORE INTO "item_designers" ("item_id", "designer_id")
SELECT i."id", d."id" FROM "items" i, json_each(CASE WHEN json_valid(i."designers") THEN i."designers" ELSE '[]' END) j
JOIN "designers" d ON d."normalized_name" = lower(trim(j.value))
WHERE typeof(j.value) = 'text' AND trim(j.value) <> '';

INSERT OR IGNORE INTO "artists" ("id", "name", "normalized_name")
SELECT lower(hex(randomblob(16))), trim(j.value), lower(trim(j.value))
FROM "items" i, json_each(CASE WHEN json_valid(i."artists") THEN i."artists" ELSE '[]' END) j
WHERE typeof(j.value) = 'text' AND trim(j.value) <> ''
GROUP BY lower(trim(j.value));
INSERT OR IGNORE INTO "item_artists" ("item_id", "artist_id")
SELECT i."id", a."id" FROM "items" i, json_each(CASE WHEN json_valid(i."artists") THEN i."artists" ELSE '[]' END) j
JOIN "artists" a ON a."normalized_name" = lower(trim(j.value))
WHERE typeof(j.value) = 'text' AND trim(j.value) <> '';

INSERT OR IGNORE INTO "publishers" ("id", "name", "normalized_name")
SELECT lower(hex(randomblob(16))), trim(j.value), lower(trim(j.value))
FROM "items" i, json_each(CASE WHEN json_valid(i."publishers") THEN i."publishers" ELSE '[]' END) j
WHERE typeof(j.value) = 'text' AND trim(j.value) <> ''
GROUP BY lower(trim(j.value));
INSERT OR IGNORE INTO "item_publishers" ("item_id", "publisher_id")
SELECT i."id", p."id" FROM "items" i, json_each(CASE WHEN json_valid(i."publishers") THEN i."publishers" ELSE '[]' END) j
JOIN "publishers" p ON p."normalized_name" = lower(trim(j.value))
WHERE typeof(j.value) = 'text' AND trim(j.value) <> '';
