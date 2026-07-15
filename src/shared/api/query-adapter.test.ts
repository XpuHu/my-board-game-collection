import { describe, expect, it, vi } from "vitest";

import {
  createMockQueryAdapter,
  createRestQueryAdapter,
} from "@/shared/api/query-adapter";
import { collectionFixtures } from "@/shared/api/fixtures";
import {
  collectionRestAdapter,
  createCollectionMockAdapter,
} from "@/features/collection/api";

describe("query adapters", () => {
  it("keeps mock and REST adapters on the same contract", async () => {
    const mock = createMockQueryAdapter<{ page: number }, { value: number }>(
      ({ page }) => ({ value: page }),
    );
    expect(await mock.load({ page: 3 })).toEqual({ value: 3 });

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ value: 4 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const rest = createRestQueryAdapter<{ page: number }, { value: number }>({
      path: "/api/example",
      toQuery: ({ page }) => ({ page }),
    });

    expect(await rest.load({ page: 4 })).toEqual({ value: 4 });
    expect(fetchMock).toHaveBeenCalledWith("/api/example?page=4", {
      signal: undefined,
    });
    fetchMock.mockRestore();
  });

  it("cancels delayed mock queries", async () => {
    const controller = new AbortController();
    const mock = createMockQueryAdapter<void, string>("done", { delay: 50 });
    const result = mock.load(undefined, { signal: controller.signal });
    controller.abort();

    await expect(result).rejects.toMatchObject({ name: "AbortError" });
  });

  it("ignores an async mock result after cancellation", async () => {
    const controller = new AbortController();
    let resolve!: (value: string) => void;
    const pending = new Promise<string>((done) => {
      resolve = done;
    });
    const mock = createMockQueryAdapter<void, string>(() => pending);
    const result = mock.load(undefined, { signal: controller.signal });
    controller.abort();
    resolve("stale");
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
  });

  it.each([
    ["empty", 0, 0],
    ["single", 1, 1],
    ["regular", 6, 6],
    ["large", 101, 24],
  ] as const)("provides a %s collection contract fixture", async (name, total, visible) => {
    const fixture = collectionFixtures[name];
    const adapter = createCollectionMockAdapter(fixture);
    const result = await adapter.load({ page: 1, pageSize: 24 });
    expect(result.pagination.total).toBe(total);
    expect(result.data).toHaveLength(visible);
    result.data.forEach((card) => {
      expect(card.userItem.states).toContain("owned");
      expect(card.plays).toHaveProperty("count");
    });
  });

  it("keeps collection REST and mock adapters on the same target contract", async () => {
    const fixture = collectionFixtures.regular;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(fixture), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const params = { page: 1 as const, pageSize: 24 as const };
    const mockResult = await createCollectionMockAdapter(fixture).load(params);
    const restResult = await collectionRestAdapter.load(params);
    expect(restResult).toEqual(mockResult);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/collection?view=compact&page=1&pageSize=24",
      { signal: undefined },
    );
    fetchMock.mockRestore();
  });
});
