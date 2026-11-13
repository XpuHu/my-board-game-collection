import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { requirePostgresUrl } from "../../../scripts/lib/connection.mjs";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: requirePostgresUrl(
      process.env.DATABASE_URL,
      "DATABASE_URL",
    ),
    max: process.env.NODE_ENV === "test" ? 1 : 3,
    connectionTimeoutMillis: 15_000,
    idleTimeoutMillis: 10_000,
  });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

// Next.js imports route modules while building. Defer validation and client
// creation until a route actually uses the database; never invent credentials.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = (globalForPrisma.prisma ??= createPrismaClient());
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
