export function requirePostgresUrl(value, name = "DATABASE_URL") {
  if (!value)
    throw new Error(
      `${name} is required. Configure a PostgreSQL connection; SQLite is kept only as an archive.`,
    );
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid PostgreSQL URL.`);
  }
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    !parsed.hostname ||
    !parsed.pathname.slice(1)
  ) {
    throw new Error(
      `${name} must specify a PostgreSQL host and database. SQLite file URLs are not supported by this application version.`,
    );
  }
  return value;
}

// This identifier intentionally contains no username, password or query string.
export function databaseIdentity(value) {
  const url = new URL(requirePostgresUrl(value));
  return `${url.hostname.toLowerCase()}:${url.port || "5432"}/${decodeURIComponent(url.pathname.slice(1))}`;
}

export function requireDirectUrl(value) {
  const valid = requirePostgresUrl(value, "DATABASE_URL_UNPOOLED");
  const url = new URL(valid);
  if (
    url.hostname.includes("-pooler.") ||
    url.searchParams.get("pgbouncer") === "true"
  ) {
    throw new Error(
      "DATABASE_URL_UNPOOLED must use the direct endpoint, not a transaction pooler.",
    );
  }
  return valid;
}

export function assertExpectedTarget(value, expected) {
  const actual = databaseIdentity(value);
  if (!expected || actual !== expected)
    throw new Error(`Target confirmation is required: --target ${actual}`);
  return actual;
}

export function assertTestTarget(value, expected, blocked = []) {
  const actual = databaseIdentity(value);
  if (!expected || expected !== actual)
    throw new Error(
      "Test database identity does not match the explicitly allowed test target.",
    );
  for (const candidate of blocked.filter(Boolean)) {
    if (
      /^postgres(?:ql)?:/.test(candidate) &&
      databaseIdentity(candidate).replace("-pooler.", ".") ===
        actual.replace("-pooler.", ".")
    ) {
      throw new Error(
        "Refusing to reset a database configured for development or production.",
      );
    }
  }
  return actual;
}

export function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}
