import { afterAll } from "vitest";
import { Pool } from "pg";
import {
  assertTestTarget,
  quoteIdentifier,
  requireDirectUrl,
} from "../../scripts/lib/connection.mjs";

if (process.env.BGC_TEST_RESET_ALLOWED !== "true") {
  throw new Error(
    "Run tests through npm test. No database is reset without the test launcher.",
  );
}
assertTestTarget(process.env.DATABASE_URL!, process.env.BGC_TEST_DATABASE_ID);
const direct = requireDirectUrl(process.env.DATABASE_URL_UNPOOLED);
assertTestTarget(direct, process.env.BGC_TEST_DATABASE_DIRECT_ID);
const pool = new Pool({ connectionString: direct, max: 1 });
try {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
    );
    if (!existing.rows.some((row) => row.tablename === "_prisma_migrations")) {
      throw new Error(
        "Test database has no applied Prisma history. Use npm test.",
      );
    } else {
      const tables = existing.rows
        .filter((row) => row.tablename !== "_prisma_migrations")
        .map((row) => quoteIdentifier(row.tablename));
      if (tables.length)
        await client.query(`TRUNCATE TABLE ${tables.join(", ")} CASCADE`);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}

const { prisma } = await import("../infrastructure/database/prisma");
await prisma.itemType.createMany({
  data: [
    ["base_game", "Base game"],
    ["expansion", "Expansion"],
    ["promo", "Promo"],
    ["accessory", "Accessory"],
    ["organizer", "Organizer"],
    ["component", "Component"],
    ["miniature", "Miniature"],
    ["playmat", "Playmat"],
    ["sleeves", "Sleeves"],
    ["dice", "Dice"],
    ["other", "Other"],
  ].map(([code, name]) => ({ code, name, isSystem: true })),
});
afterAll(async () => {
  await prisma.$disconnect();
});
