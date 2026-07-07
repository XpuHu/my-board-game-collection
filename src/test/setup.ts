import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";

process.env.DATABASE_URL = "file:./.test/test.db";

const globalForTest = globalThis as typeof globalThis & {
  __boardGameCollectionTestDbReady?: boolean;
};

if (!globalForTest.__boardGameCollectionTestDbReady) {
  const databasePath = resolve(process.cwd(), ".test", "test.db");
  mkdirSync(dirname(databasePath), { recursive: true });

  if (existsSync(databasePath)) {
    rmSync(databasePath);
  }

  const { prisma } = await import("../infrastructure/database/prisma");

  const migrationSql = readFileSync(
    resolve(
      process.cwd(),
      "prisma",
      "migrations",
      "20260706190500_init",
      "migration.sql",
    ),
    "utf8",
  );

  for (const statement of migrationSql
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)) {
    await prisma.$executeRawUnsafe(statement);
  }

  await prisma.itemType.createMany({
    data: [
      { code: "base_game", name: "Base game", isSystem: true },
      { code: "expansion", name: "Expansion", isSystem: true },
      { code: "promo", name: "Promo", isSystem: true },
      { code: "accessory", name: "Accessory", isSystem: true },
      { code: "organizer", name: "Organizer", isSystem: true },
      { code: "component", name: "Component", isSystem: true },
      { code: "miniature", name: "Miniature", isSystem: true },
      { code: "playmat", name: "Playmat", isSystem: true },
      { code: "sleeves", name: "Sleeves", isSystem: true },
      { code: "dice", name: "Dice", isSystem: true },
      { code: "other", name: "Other", isSystem: true },
    ],
  });

  globalForTest.__boardGameCollectionTestDbReady = true;
}
