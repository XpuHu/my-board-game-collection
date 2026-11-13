import { test } from "node:test";
import assert from "node:assert/strict";
import {
  requirePostgresUrl,
  requireDirectUrl,
  databaseIdentity,
  assertExpectedTarget,
  assertTestTarget,
} from "./connection.mjs";

test("missing/SQLite credentials fail without silently selecting a database", () => {
  for (const value of [
    undefined,
    "file:./dev.db",
    "https://example.com",
    "postgresql://localhost/",
  ])
    assert.throws(() => requirePostgresUrl(value));
  assert.equal(
    requirePostgresUrl("postgresql://localhost/collection"),
    "postgresql://localhost/collection",
  );
});

test("target confirmation does not expose credentials and rejects a different destination", () => {
  const url =
    "postgresql://owner:SECRET@db.example.com/collection?sslmode=require";
  assert.equal(databaseIdentity(url), "db.example.com:5432/collection");
  assert.throws(
    () => assertExpectedTarget(url, "other:5432/collection"),
    (error) => !error.message.includes("SECRET"),
  );
  assert.equal(
    assertExpectedTarget(url, "db.example.com:5432/collection"),
    "db.example.com:5432/collection",
  );
});

test("tests cannot reset a known non-test destination, including its pooled alias", () => {
  const url = "postgresql://user@db.example.com/test";
  assert.throws(() => assertTestTarget(url, undefined));
  assert.throws(() => assertTestTarget(url, "db.example.com:5432/test", [url]));
  assert.throws(() =>
    assertTestTarget(url, "db.example.com:5432/test", [
      "postgresql://user@db-pooler.example.com/test",
    ]),
  );
  assert.equal(
    assertTestTarget(url, "db.example.com:5432/test", [
      "postgresql://user@db.example.com/production",
    ]),
    "db.example.com:5432/test",
  );
});

test("migration and backup commands reject a Neon transaction pooler", () => {
  assert.throws(() =>
    requireDirectUrl("postgresql://user@ep-pooler.region.neon.tech/neondb"),
  );
  assert.throws(() =>
    requireDirectUrl("postgresql://localhost/test?pgbouncer=true"),
  );
});
