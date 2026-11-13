import "dotenv/config";
import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { Client } from "pg";
import { assertExpectedTarget, requireDirectUrl } from "./lib/connection.mjs";
import {
  snapshotSqlite,
  snapshotPostgres,
  writeSnapshot,
  readSnapshot,
  transferSnapshot,
  verifySnapshot,
} from "./lib/snapshot.mjs";

let client;
try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      source: { type: "string" },
      input: { type: "string" },
      out: { type: "string" },
      target: { type: "string" },
      encrypted: { type: "boolean" },
      "allow-production": { type: "boolean" },
    },
  });
  const command = positionals[0];
  if (
    !["snapshot", "transfer", "verify", "backup"].includes(command) ||
    positionals.length !== 1
  )
    throw new Error(
      "Usage: npm run db:snapshot -- --source COPY.db --out private-backups/backup.json; db:transfer|db:verify -- --input BACKUP --target host:port/database; db:backup -- --out BACKUP --target host:port/database [--encrypted]",
    );
  const key = process.env.BACKUP_ENCRYPTION_KEY;
  if (values.encrypted && !key)
    throw new Error("Set BACKUP_ENCRYPTION_KEY before requesting encryption.");
  if (command === "snapshot") {
    if (!values.source || !values.out)
      throw new Error("--source and --out are required.");
    const snapshot = snapshotSqlite(resolve(values.source));
    await writeSnapshot(
      resolve(values.out),
      snapshot,
      values.encrypted ? key : undefined,
    );
    console.log(
      JSON.stringify(
        {
          created: resolve(values.out),
          source: "sqlite",
          dataSha256: snapshot.dataSha256,
          counts: Object.fromEntries(
            snapshot.tables.map((table) => [table.name, table.rows.length]),
          ),
        },
        null,
        2,
      ),
    );
  } else {
    const direct = requireDirectUrl(process.env.DATABASE_URL_UNPOOLED);
    const target = assertExpectedTarget(direct, values.target);
    if (
      command === "transfer" &&
      process.env.VERCEL_ENV === "production" &&
      !values["allow-production"]
    )
      throw new Error(
        "Production transfer requires an explicit --allow-production flag and must never run during a build.",
      );
    if (command === "backup" && !values.out)
      throw new Error("--out is required.");
    if (command !== "backup" && !values.input)
      throw new Error("--input is required.");
    // Validate the backup before opening a database connection.
    const input =
      command === "backup"
        ? undefined
        : await readSnapshot(resolve(values.input), key);
    client = new Client({
      connectionString: direct,
      connectionTimeoutMillis: 15_000,
    });
    await client.connect();
    if (command === "backup") {
      const snapshot = await snapshotPostgres(client);
      await writeSnapshot(
        resolve(values.out),
        snapshot,
        values.encrypted ? key : undefined,
      );
      console.log(
        JSON.stringify(
          {
            created: resolve(values.out),
            target,
            dataSha256: snapshot.dataSha256,
          },
          null,
          2,
        ),
      );
    } else {
      const result =
        command === "transfer"
          ? await transferSnapshot(client, input)
          : await verifySnapshot(client, input);
      console.log(JSON.stringify({ target, ...result }, null, 2));
    }
  }
} catch (error) {
  // PostgreSQL errors can include personal data in detail/query fields.
  console.error(
    error.code
      ? `Database operation failed (${error.code}); no successful transfer was reported.`
      : error.message,
  );
  process.exitCode = 1;
} finally {
  if (client) await client.end();
}
