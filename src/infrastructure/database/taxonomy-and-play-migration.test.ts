import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): { all(): unknown[] };
  close(): void;
};

const Database = createRequire(import.meta.url)("better-sqlite3") as new (
  filename: string,
) => SqliteDatabase;

describe("taxonomy and play fields migration", () => {
  it("backfills normalized relations and adds nullable play fields", () => {
    const database = new Database(":memory:");
    database.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE "items" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "mechanics" JSON,
        "categories" JSON,
        "designers" JSON,
        "artists" JSON,
        "publishers" JSON
      );
      INSERT INTO "items" VALUES
        ('item-1', '["Deck Building", " deck building "]', '["Strategy"]', '["Jane Doe"]', '[]', '["Studio"]');
      CREATE TABLE "play_sessions" (
        "id" TEXT NOT NULL PRIMARY KEY
      );
      INSERT INTO "play_sessions" ("id") VALUES ('play-1');
    `);

    const migration = readFileSync(
      resolve(
        process.cwd(),
        "prisma/migrations/20260723120000_normalize_taxonomy_and_play_fields/migration.sql",
      ),
      "utf8",
    );
    database.exec(migration);

    expect(
      database
        .prepare(
          'SELECT "normalized_name" AS normalizedName FROM "mechanics"',
        )
        .all(),
    ).toEqual([
      { normalizedName: "deck building" },
    ]);
    expect(
      database.prepare('SELECT * FROM "item_mechanics"').all(),
    ).toHaveLength(1);
    expect(
      database
        .prepare(
          'SELECT "started_at" AS startedAt, "personal_rating" AS personalRating FROM "play_sessions"',
        )
        .all(),
    ).toEqual([{ startedAt: null, personalRating: null }]);

    database.close();
  });
});
