import Database from "better-sqlite3";
import { Prisma } from "@prisma/client";
import {
  createHash,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { quoteIdentifier as q } from "./connection.mjs";

const FORMAT = "boardgamecollection-full-backup";
const hash = (value) => createHash("sha256").update(value).digest("hex");

function kind(type) {
  const name = type.toLowerCase();
  if (
    ["decimal", "numeric", "real", "double precision", "float4", "float8"].some(
      (part) => name.startsWith(part),
    )
  )
    return "numeric";
  if (name.includes("json")) return "json";
  if (["datetime", "timestamp", "date"].some((part) => name.startsWith(part)))
    return "date";
  if (["boolean", "bool"].includes(name)) return "boolean";
  if (["integer", "int4", "int8", "bigint", "smallint"].includes(name))
    return "integer";
  if (["text", "varchar", "character varying"].includes(name)) return "text";
  throw new Error(`Unsupported backup column type: ${type}`);
}

function orderedJson(value) {
  if (Array.isArray(value)) return value.map(orderedJson);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, orderedJson(value[key])]),
    );
  return value;
}

function normalize(value, column) {
  if (value === null) return null;
  switch (column.kind) {
    case "numeric":
      return new Prisma.Decimal(String(value)).toFixed();
    case "integer":
      return BigInt(value).toString();
    case "boolean": {
      if ([true, 1, 1n, "1", "true", "t"].includes(value)) return true;
      if ([false, 0, 0n, "0", "false", "f"].includes(value)) return false;
      throw new Error(`Invalid boolean in column ${column.name}`);
    }
    case "json":
      return JSON.stringify(orderedJson(JSON.parse(value)));
    case "date": {
      let input = String(value);
      if (/^-?\d+$/.test(input)) return new Date(Number(input)).toISOString();
      input = input.replace(" ", "T");
      if (/^\d{4}-\d\d-\d\d$/.test(input)) input += "T00:00:00.000";
      if (!/(?:Z|[+-]\d\d(?::?\d\d)?)$/i.test(input.slice(10))) input += "Z";
      return new Date(input).toISOString();
    }
    default:
      return String(value);
  }
}

function schemaShape(tables) {
  return tables
    .map(({ name, columns, foreignKeys }) => ({ name, columns, foreignKeys }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function dataDigest(tables) {
  const normalized = [...tables]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((table) => ({
      name: table.name,
      columns: table.columns,
      rows: table.rows.map((row) => JSON.stringify(row)).sort(),
    }));
  return hash(JSON.stringify(normalized));
}

function makeSnapshot(source, tables, migrationHistory = []) {
  const body = {
    format: FORMAT,
    version: 1,
    createdAt: new Date().toISOString(),
    source,
    schema: schemaShape(tables),
    migrationHistory,
    tables,
    dataSha256: dataDigest(tables),
  };
  return { ...body, checksum: hash(JSON.stringify(body)) };
}

export function validateSnapshot(snapshot) {
  if (
    !snapshot ||
    snapshot.format !== FORMAT ||
    snapshot.version !== 1 ||
    !Array.isArray(snapshot.tables)
  )
    throw new Error(
      "Not a supported full collection backup (ordinary UI JSON exports are different).",
    );
  const { checksum, ...body } = snapshot;
  if (
    hash(JSON.stringify(body)) !== checksum ||
    dataDigest(snapshot.tables) !== snapshot.dataSha256
  )
    throw new Error("Backup checksum mismatch; no data has been written.");
  if (
    !snapshot.tables.length ||
    new Set(snapshot.tables.map((table) => table.name)).size !==
      snapshot.tables.length
  )
    throw new Error("Invalid or duplicate backup tables.");
  for (const table of snapshot.tables) {
    if (
      !table.columns.length ||
      new Set(table.columns.map((column) => column.name)).size !==
        table.columns.length ||
      table.rows.some((row) => row.length !== table.columns.length)
    )
      throw new Error(`Invalid backup table ${table.name}`);
  }
  return snapshot;
}

export function snapshotSqlite(source) {
  const db = new Database(source, { readonly: true, fileMustExist: true });
  try {
    return db.transaction(() => {
      if (
        db
          .pragma("integrity_check")
          .some((row) => row.integrity_check !== "ok") ||
        db.pragma("foreign_key_check").length
      )
        throw new Error("SQLite integrity or foreign key verification failed.");
      const names = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> '_prisma_migrations' ORDER BY name",
        )
        .all();
      const tables = names.map(({ name }) => {
        const columns = db
          .pragma(`table_info(${q(name)})`)
          .map((column) => ({ name: column.name, kind: kind(column.type) }))
          .sort((a, b) => a.name.localeCompare(b.name));
        const foreignKeys = db
          .pragma(`foreign_key_list(${q(name)})`)
          .map((fk) => ({ column: fk.from, table: fk.table, target: fk.to }))
          .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
        const expressions = columns.map((column) =>
          column.kind === "json"
            ? `json(${q(column.name)}) AS ${q(column.name)}`
            : column.kind === "numeric"
              ? `CAST(${q(column.name)} AS TEXT) AS ${q(column.name)}`
              : q(column.name),
        );
        const rows = db
          .prepare(`SELECT ${expressions.join(", ")} FROM ${q(name)}`)
          .safeIntegers()
          .all()
          .map((row) =>
            columns.map((column) => normalize(row[column.name], column)),
          );
        return { name, columns, foreignKeys, rows };
      });
      return makeSnapshot("sqlite", tables);
    })();
  } finally {
    db.close();
  }
}

async function pgTables(client) {
  const columns = await client.query(
    "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name <> '_prisma_migrations' ORDER BY table_name, column_name",
  );
  const keys =
    await client.query(`SELECT tc.table_name, kcu.column_name, ccu.table_name AS referenced_table, ccu.column_name AS referenced_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.constraint_schema = kcu.constraint_schema
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name AND tc.constraint_schema = ccu.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'`);
  const names = [...new Set(columns.rows.map((row) => row.table_name))].sort(
    (a, b) => a.localeCompare(b),
  );
  return names.map((name) => ({
    name,
    columns: columns.rows
      .filter((row) => row.table_name === name)
      .map((row) => ({ name: row.column_name, kind: kind(row.data_type) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    foreignKeys: keys.rows
      .filter((row) => row.table_name === name)
      .map((row) => ({
        column: row.column_name,
        table: row.referenced_table,
        target: row.referenced_column,
      }))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  }));
}

async function readPgTables(client, metadata) {
  const tables = [];
  for (const table of metadata) {
    const columns = table.columns.map(
      (column) => `${q(column.name)}::text AS ${q(column.name)}`,
    );
    const result = await client.query(
      `SELECT ${columns.join(", ")} FROM ${q(table.name)}`,
    );
    tables.push({
      ...table,
      rows: result.rows.map((row) =>
        table.columns.map((column) => normalize(row[column.name], column)),
      ),
    });
  }
  return tables;
}

export async function snapshotPostgres(client) {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    const tables = await readPgTables(client, await pgTables(client));
    const historyExists = await client.query(
      "SELECT to_regclass('public.\"_prisma_migrations\"') AS name",
    );
    const history = historyExists.rows[0].name
      ? (
          await client.query(
            'SELECT migration_name, checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name',
          )
        ).rows
      : [];
    await client.query("COMMIT");
    return makeSnapshot("postgresql", tables, history);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

function orderTables(tables) {
  const remaining = [...tables];
  const ordered = [];
  while (remaining.length) {
    const index = remaining.findIndex((table) =>
      table.foreignKeys.every(
        (fk) =>
          fk.table === table.name ||
          ordered.some((done) => done.name === fk.table),
      ),
    );
    if (index < 0)
      throw new Error("Unsupported cyclic table dependencies in backup.");
    ordered.push(...remaining.splice(index, 1));
  }
  return ordered;
}

function orderRows(table) {
  const selfKeys = table.foreignKeys.filter((fk) => fk.table === table.name);
  if (!selfKeys.length) return table.rows;
  const remaining = [...table.rows];
  const ordered = [];
  while (remaining.length) {
    const index = remaining.findIndex((row) =>
      selfKeys.every((fk) => {
        const from = table.columns.findIndex(
          (column) => column.name === fk.column,
        );
        const to = table.columns.findIndex(
          (column) => column.name === fk.target,
        );
        return (
          row[from] === null ||
          row[from] === row[to] ||
          ordered.some((done) => done[to] === row[from])
        );
      }),
    );
    if (index < 0) throw new Error(`Cyclic or missing parent in ${table.name}`);
    ordered.push(...remaining.splice(index, 1));
  }
  return ordered;
}

export async function transferSnapshot(client, input) {
  const snapshot = validateSnapshot(input);
  await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
  try {
    const metadata = await pgTables(client);
    if (
      JSON.stringify(schemaShape(metadata)) !== JSON.stringify(snapshot.schema)
    )
      throw new Error(
        "Target schema differs from the backup. Apply the matching PostgreSQL migrations first.",
      );
    await client.query(
      `LOCK TABLE ${metadata.map((table) => q(table.name)).join(", ")} IN ACCESS EXCLUSIVE MODE`,
    );
    for (const table of metadata) {
      const count = await client.query(
        `SELECT count(*)::text AS total FROM ${q(table.name)}`,
      );
      if (count.rows[0].total !== "0")
        throw new Error(
          `Refusing to overwrite non-empty table ${table.name}. Use a new empty target database.`,
        );
    }
    for (const table of orderTables(snapshot.tables)) {
      const rows = orderRows(table);
      // Single-row inserts preserve self-referential parent ordering.
      const placeholders = table.columns
        .map((_column, index) => `$${index + 1}`)
        .join(", ");
      const sql = `INSERT INTO ${q(table.name)} (${table.columns.map((column) => q(column.name)).join(", ")}) VALUES (${placeholders})`;
      for (const row of rows) await client.query(sql, row);
    }
    const actual = await readPgTables(client, metadata);
    if (dataDigest(actual) !== snapshot.dataSha256)
      throw new Error(
        "Full data verification failed; the transaction has been rolled back.",
      );
    await client.query("COMMIT");
    return {
      verified: true,
      dataSha256: snapshot.dataSha256,
      counts: Object.fromEntries(
        actual.map((table) => [table.name, table.rows.length]),
      ),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

export async function verifySnapshot(client, snapshot) {
  validateSnapshot(snapshot);
  const actual = await snapshotPostgres(client);
  if (
    JSON.stringify(actual.schema) !== JSON.stringify(snapshot.schema) ||
    actual.dataSha256 !== snapshot.dataSha256
  )
    throw new Error("Database differs from the supplied backup.");
  return {
    verified: true,
    dataSha256: actual.dataSha256,
    counts: Object.fromEntries(
      actual.tables.map((table) => [table.name, table.rows.length]),
    ),
  };
}

function encryptionKey(key) {
  const bytes = Buffer.from(key ?? "", "base64");
  if (bytes.length !== 32)
    throw new Error(
      "BACKUP_ENCRYPTION_KEY must be a base64-encoded 32-byte key.",
    );
  return bytes;
}

export async function writeSnapshot(file, snapshot, key) {
  validateSnapshot(snapshot);
  let contents = JSON.stringify(snapshot);
  if (key) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", encryptionKey(key), iv);
    const encrypted = Buffer.concat([
      cipher.update(contents, "utf8"),
      cipher.final(),
    ]);
    contents = JSON.stringify({
      format: "boardgamecollection-encrypted",
      version: 1,
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      payload: encrypted.toString("base64"),
    });
  }
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, contents, { flag: "wx", mode: 0o600 });
}

export async function readSnapshot(file, key) {
  let contents = JSON.parse(await readFile(file, "utf8"));
  if (contents.format === "boardgamecollection-encrypted") {
    if (contents.version !== 1)
      throw new Error("Unsupported encrypted backup version.");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(key),
      Buffer.from(contents.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(contents.tag, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(contents.payload, "base64")),
      decipher.final(),
    ]);
    contents = JSON.parse(decrypted.toString("utf8"));
  }
  return validateSnapshot(contents);
}
