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

describe("ownedAt migration", () => {
  it("backfills owned rows and leaves non-owned rows null", () => {
    const database = new Database(":memory:");
    database.exec(`
      CREATE TABLE "user_items" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "owned" BOOLEAN NOT NULL DEFAULT false,
        "created_at" DATETIME NOT NULL
      );
      INSERT INTO "user_items" ("id", "owned", "created_at") VALUES
        ('owned', true, '2026-01-02T03:04:05.000Z'),
        ('wishlist', false, '2026-02-03T04:05:06.000Z');
    `);

    const migration = readFileSync(
      resolve(
        process.cwd(),
        "prisma/migrations/20260722190000_add_user_item_owned_at/migration.sql",
      ),
      "utf8",
    );
    database.exec(migration);

    const rows = database
      .prepare(
        'SELECT "id", "created_at" AS createdAt, "owned_at" AS ownedAt FROM "user_items" ORDER BY "id"',
      )
      .all() as { id: string; createdAt: string; ownedAt: string | null }[];

    expect(rows).toEqual([
      {
        id: "owned",
        createdAt: "2026-01-02T03:04:05.000Z",
        ownedAt: "2026-01-02T03:04:05.000Z",
      },
      {
        id: "wishlist",
        createdAt: "2026-02-03T04:05:06.000Z",
        ownedAt: null,
      },
    ]);
    database.close();
  });
});
