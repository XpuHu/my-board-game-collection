import "dotenv/config";

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.js",
  },
  datasource: {
    // Generation and SQL diff work without credentials. Mutating commands are
    // launched by scripts/database.mjs, which requires an explicit direct URL.
    url: process.env.DATABASE_URL_UNPOOLED,
  },
});
