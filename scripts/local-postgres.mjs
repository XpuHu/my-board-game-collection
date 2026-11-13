import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { startLocalPostgres } from "./lib/local-postgres.mjs";
import { databaseIdentity } from "./lib/connection.mjs";

await mkdir(resolve(".test/local-postgres"), { recursive: true });
const local = await startLocalPostgres(resolve(".test/local-postgres"));
console.log(
  "Local PostgreSQL for development (PGlite; no application server is started).",
);
console.log(`DATABASE_URL="${local.url}"`);
console.log(`DATABASE_URL_UNPOOLED="${local.url}"`);
console.log(`Target: ${databaseIdentity(local.url)}`);
console.log(
  "Keep this terminal open. Configure these values in a separate terminal; your .env and SQLite file have not been changed.",
);
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  await local.close();
}
process.once("SIGINT", () => {
  void shutdown();
});
process.once("SIGTERM", () => {
  void shutdown();
});
