import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("target and legacy API boundary", () => {
  it("keeps legacy exports out of the canonical API barrel and target DTO file", () => {
    const barrel = source("src/shared/api/index.ts");
    const client = source("src/shared/api/client.ts");
    const targetTypes = source("src/shared/api/types.ts");

    expect(barrel).not.toContain("legacy");
    expect(client).not.toContain("legacy");
    expect(targetTypes).not.toMatch(/\bLegacy[A-Z]\w*/);
  });

  it.each([
    "src/features/collection/api/index.ts",
    "src/features/dashboard/api/index.ts",
    "src/features/plays/api/index.ts",
    "src/features/preorders/api/index.ts",
    "src/features/wishlist/api/index.ts",
  ])("keeps target feature adapter %s independent from legacy", (path) => {
    expect(source(path)).not.toContain("/legacy");
  });

  it("keeps dashboard target-only", () => {
    const route = source("src/app/api/dashboard/route.ts");
    expect(route).not.toContain("parseResponseView");
    expect(route).not.toContain("legacy");
  });
});

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}
