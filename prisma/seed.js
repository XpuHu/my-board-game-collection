require("dotenv/config");

const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

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
  const { requirePostgresUrl } = await import("../scripts/lib/connection.mjs");
  const adapter = new PrismaPg({
    connectionString: requirePostgresUrl(
      process.env.DATABASE_URL,
      "DATABASE_URL",
    ),
    max: 1,
  });
  const prisma = new PrismaClient({ adapter, log: ["error"] });
  try {
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
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
