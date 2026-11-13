import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomBytes, createHash } from "node:crypto";
import Database from "better-sqlite3";
import { Client } from "pg";
import { startLocalPostgres } from "./local-postgres.mjs";
import {
  snapshotSqlite,
  transferSnapshot,
  snapshotPostgres,
  verifySnapshot,
  writeSnapshot,
  readSnapshot,
  dataDigest,
} from "./snapshot.mjs";

let directory, source, first, second, client, restored;
before(async () => {
  await mkdir(resolve(".test"), { recursive: true });
  directory = await mkdtemp(resolve(".test/transfer-tests-"));
  const sqlitePath = join(directory, "synthetic.db");
  const db = new Database(sqlitePath);
  try {
    const archive = resolve("prisma/sqlite-archive/migrations");
    for (const name of (await readdir(archive)).sort())
      await db.exec(
        await readFile(join(archive, name, "migration.sql"), "utf8"),
      );
    db.exec(`INSERT INTO item_types (id,code,name,is_system,updated_at) VALUES ('type','base_game','Base game',1,'2026-11-13T00:00:00.000Z');
      INSERT INTO items (id,type_id,title,updated_at,complexity,categories) VALUES ('item','type','Тестовая игра','2026-11-13T00:00:00.000Z',3.25,'["Тест"]');
      INSERT INTO user_items (id,item_id,owned,updated_at) VALUES ('owner','item',1,'2026-11-13T00:00:00.000Z');
      INSERT INTO preorders (id,item_id,shop,price,currency,status,updated_at) VALUES ('root','item','Shop',800.55,'RUB','ordered','2026-11-13T00:00:00.000Z');
      INSERT INTO preorders (id,item_id,parent_id,shop,price,currency,status,updated_at) VALUES ('child','item','root','Shop',0,'RUB','ordered','2026-11-13T00:00:00.000Z');
      INSERT INTO command_receipts(id,kind,fingerprint,result) VALUES ('operation','item-action','fingerprint','{"preorderId":"root","expansionPreorderIds":["child"]}');`);
  } finally {
    db.close();
  }
  source = snapshotSqlite(sqlitePath);
  first = await startLocalPostgres();
  second = await startLocalPostgres();
  const sql = await readFile(
    resolve("prisma/migrations/20261113000000_postgresql_init/migration.sql"),
    "utf8",
  );
  await first.db.exec(sql);
  await second.db.exec(sql);
  client = new Client({ connectionString: first.url });
  restored = new Client({ connectionString: second.url });
  await client.connect();
  await restored.connect();
});
after(async () => {
  if (client) await client.end();
  if (restored) await restored.end();
  if (first) await first.close();
  if (second) await second.close();
});

test("SQLite transfer preserves all tables, parent links, money, Unicode, JSON and command receipts", async () => {
  const report = await transferSnapshot(client, source);
  assert.equal(report.verified, true);
  assert.equal(report.counts.command_receipts, 1);
  assert.equal(report.counts.preorders, 2);
  assert.equal(
    (await client.query("SELECT parent_id FROM preorders WHERE id='child'"))
      .rows[0].parent_id,
    "root",
  );
  assert.equal((await verifySnapshot(client, source)).verified, true);
});

test("a retry refuses a non-empty target without changing existing data", async () => {
  await assert.rejects(transferSnapshot(client, source), /non-empty/);
  await verifySnapshot(client, source);
});

test("checksum corruption is rejected before any write", async () => {
  const modified = structuredClone(source);
  modified.tables.find((table) => table.name === "items").rows[0][0] =
    "tampered";
  await assert.rejects(transferSnapshot(restored, modified), /checksum/);
  assert.equal(
    (await restored.query("SELECT count(*)::int AS count FROM items")).rows[0]
      .count,
    0,
  );
});

test("a foreign key failure rolls back earlier inserts from the same transfer", async () => {
  const invalid = structuredClone(source);
  const items = invalid.tables.find((table) => table.name === "items");
  items.rows[0][
    items.columns.findIndex((column) => column.name === "type_id")
  ] = "missing-parent";
  invalid.dataSha256 = dataDigest(invalid.tables);
  delete invalid.checksum;
  invalid.checksum = createHash("sha256")
    .update(JSON.stringify(invalid))
    .digest("hex");
  await assert.rejects(
    transferSnapshot(restored, invalid),
    (error) => error.code === "23503",
  );
  assert.equal(
    (await restored.query("SELECT count(*)::int AS count FROM item_types"))
      .rows[0].count,
    0,
  );
});

test("encrypted PostgreSQL backup restores full decimal precision and receipts to a fresh target", async () => {
  await client.query("UPDATE preorders SET price = $1 WHERE id = 'root'", [
    "12345678901234567890.123456789012345678901234567890",
  ]);
  const snapshot = await snapshotPostgres(client);
  const key = randomBytes(32).toString("base64");
  const file = join(directory, "full.json.enc");
  await writeSnapshot(file, snapshot, key);
  assert.ok(!(await readFile(file, "utf8")).includes("Тестовая игра"));
  await assert.rejects(readSnapshot(file, randomBytes(32).toString("base64")));
  await assert.rejects(writeSnapshot(file, snapshot, key), /EEXIST/);
  const decoded = await readSnapshot(file, key);
  await transferSnapshot(restored, decoded);
  await verifySnapshot(restored, snapshot);
});
