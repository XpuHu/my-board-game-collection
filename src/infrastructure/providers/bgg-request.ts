const LEGACY_BGG_TOKEN_ENV = "BGG_APPLICATION_TOKEN";

export function getBggToken() {
  return (
    process.env.BGG_TOKEN?.trim() ||
    process.env[LEGACY_BGG_TOKEN_ENV]?.trim() ||
    null
  );
}

export function getBggRequestHeaders() {
  const token = getBggToken();

  return {
    accept: "application/xml,text/xml",
    "user-agent": "BoardGameCollection/1.0",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
