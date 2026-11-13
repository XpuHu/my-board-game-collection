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

describe("P1 user fields migration", () => {
  it("defaults favorites and backfills preorder date precision", () => {
    const database = new Database(":memory:");
    database.exec(`
      CREATE TABLE "user_items" (
        "id" TEXT NOT NULL PRIMARY KEY
      );
      INSERT INTO "user_items" ("id") VALUES ('owned'), ('wishlist');

      CREATE TABLE "preorders" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "expected_date" DATETIME
      );
      INSERT INTO "preorders" ("id", "expected_date") VALUES
        ('dated', '2026-10-15T00:00:00.000Z'),
        ('unknown', NULL);
    `);

    const migration = readFileSync(
      resolve(
        process.cwd(),
        "prisma/sqlite-archive/migrations/20260722210000_add_p1_user_fields/migration.sql",
      ),
      "utf8",
    );
    database.exec(migration);

    expect(
      database
        .prepare('SELECT "id", "favorite" FROM "user_items" ORDER BY "id"')
        .all(),
    ).toEqual([
      { id: "owned", favorite: 0 },
      { id: "wishlist", favorite: 0 },
    ]);
    expect(
      database
        .prepare(
          'SELECT "id", "expected_date_precision" AS precision FROM "preorders" ORDER BY "id"',
        )
        .all(),
    ).toEqual([
      { id: "dated", precision: "day" },
      { id: "unknown", precision: "unknown" },
    ]);
    database.close();
  });
});
