import "dotenv/config";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { startLocalPostgres } from "./lib/local-postgres.mjs";
import {
  databaseIdentity,
  assertTestTarget,
  requireDirectUrl,
} from "./lib/connection.mjs";

let local;
let exitCode = 1;
try {
  const external = Boolean(
    process.env.TEST_DATABASE_URL || process.env.TEST_DATABASE_URL_UNPOOLED,
  );
  let url;
  let direct;
  if (external) {
    url = process.env.TEST_DATABASE_URL;
    direct = requireDirectUrl(process.env.TEST_DATABASE_URL_UNPOOLED);
    const blocked = [
      process.env.DATABASE_URL,
      process.env.DATABASE_URL_UNPOOLED,
      process.env.PRODUCTION_DATABASE_URL,
    ];
    assertTestTarget(url, process.env.TEST_DATABASE_EXPECTED_ID, blocked);
    assertTestTarget(direct, databaseIdentity(direct), blocked);
    const unpooled = new URL(direct);
    const pooled = new URL(url);
    if (
      unpooled.hostname.replace("-pooler.", ".") !==
        pooled.hostname.replace("-pooler.", ".") ||
      unpooled.pathname !== pooled.pathname ||
      (unpooled.port || "5432") !== (pooled.port || "5432")
    ) {
      throw new Error(
        "Pooled and direct test URLs must identify the same database.",
      );
    }
  } else {
    local = await startLocalPostgres();
    url = direct = local.url;
  }
  const env = {
    ...process.env,
    DATABASE_URL: url,
    DATABASE_URL_UNPOOLED: direct,
    BGC_TEST_DATABASE_ID: databaseIdentity(url),
    BGC_TEST_DATABASE_DIRECT_ID: databaseIdentity(direct),
    BGC_TEST_RESET_ALLOWED: "true",
  };
  // Apply real Prisma history before any test cleanup, including when an
  // explicitly configured external test database already has an older schema.
  const prismaCli = fileURLToPath(
    new URL("../node_modules/prisma/build/index.js", import.meta.url),
  );
  const migration = spawn(process.execPath, [prismaCli, "migrate", "deploy"], {
    env,
    stdio: "inherit",
  });
  const migrationCode = await new Promise((resolve, reject) => {
    migration.once("error", reject);
    migration.once("exit", (status) => resolve(status ?? 1));
  });
  if (migrationCode !== 0)
    throw new Error(
      "Test database migration failed; no cleanup or tests were started.",
    );
  const cli = fileURLToPath(
    new URL("../node_modules/vitest/vitest.mjs", import.meta.url),
  );
  const child = spawn(
    process.execPath,
    [cli, "run", ...process.argv.slice(2)],
    { env, stdio: "inherit" },
  );
  const code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (status) => resolve(status ?? 1));
  });
  exitCode = code;
} catch (error) {
  console.error(error.message);
} finally {
  if (local) await local.close();
}
// PGlite's WASM shutdown can change process.exitCode. Preserve the test result.
process.exitCode = exitCode;
