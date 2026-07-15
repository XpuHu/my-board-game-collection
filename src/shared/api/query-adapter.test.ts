import { describe, expect, it, vi } from "vitest";

import {
  createMockQueryAdapter,
  createRestQueryAdapter,
} from "@/shared/api/query-adapter";

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
});
