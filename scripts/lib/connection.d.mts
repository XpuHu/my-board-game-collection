export function requirePostgresUrl(
  value: string | undefined,
  name?: string,
): string;
export function databaseIdentity(value: string): string;
export function requireDirectUrl(value: string | undefined): string;
export function assertExpectedTarget(
  value: string,
  expected: string | undefined,
): string;
export function assertTestTarget(
  value: string,
  expected: string | undefined,
  blocked?: (string | undefined)[],
): string;
export function quoteIdentifier(value: string): string;
