require("dotenv/config");

const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
const { PrismaClient } = require("@prisma/client");

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});

const prisma = new PrismaClient({ adapter, log: ["error"] });

const itemTypes = [
  { code: "base_game", name: "Base game" },
  { code: "expansion", name: "Expansion" },
  { code: "promo", name: "Promo" },
  { code: "accessory", name: "Accessory" },
  { code: "organizer", name: "Organizer" },
  { code: "component", name: "Component" },
  { code: "miniature", name: "Miniature" },
  { code: "playmat", name: "Playmat" },
  { code: "sleeves", name: "Sleeves" },
  { code: "dice", name: "Dice" },
  { code: "other", name: "Other" },
];

async function main() {
  for (const itemType of itemTypes) {
    await prisma.itemType.upsert({
      where: { code: itemType.code },
      update: {
        name: itemType.name,
        isSystem: true,
      },
      create: {
        ...itemType,
        isSystem: true,
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
