import { beforeEach, describe, expect, it, vi } from "vitest";

const hookHarness = vi.hoisted(() => ({
  cleanup: undefined as void | (() => void),
  setters: [] as ReturnType<typeof vi.fn>[],
}));

vi.mock("react", () => ({
  useCallback: <T extends (...args: never[]) => unknown>(callback: T) => callback,
  useEffect: (effect: () => void | (() => void)) => {
    hookHarness.cleanup = effect();
  },
  useState: <T>(initial: T) => {
    const setter = vi.fn();
    hookHarness.setters.push(setter);
    return [initial, setter] as const;
  },
}));

import type { QueryAdapter } from "@/shared/api/query-adapter";

import { useAdapterQuery } from "./use-adapter-query";

describe("useAdapterQuery", () => {
  beforeEach(() => {
    hookHarness.cleanup = undefined;
    hookHarness.setters = [];
  });

  it("aborts on cleanup and ignores a stale result", async () => {
    let resolve!: (value: string) => void;
    const pending = new Promise<string>((done) => {
      resolve = done;
    });
    const load = vi.fn((_params: { page: number }, options?: { signal?: AbortSignal }) => {
      expect(options?.signal?.aborted).toBe(false);
      return pending;
    });
    const adapter: QueryAdapter<{ page: number }, string> = { load };

    useAdapterQuery(adapter, { page: 1 });
    const dataSetter = hookHarness.setters[0];
    hookHarness.cleanup?.();
    expect(load.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);

    resolve("stale");
    await pending;
    await Promise.resolve();
    expect(dataSetter).not.toHaveBeenCalled();
  });

  it("maps errors and exposes retry through reload", async () => {
    const adapter: QueryAdapter<void, string> = {
      load: vi.fn().mockRejectedValue(new Error("offline")),
    };

    const query = useAdapterQuery(adapter, undefined);
    await Promise.resolve();
    await Promise.resolve();

    expect(hookHarness.setters[1]).toHaveBeenCalledWith("offline");
    expect(hookHarness.setters[2]).toHaveBeenCalledWith(false);
    query.reload();
    expect(hookHarness.setters[3]).toHaveBeenCalledWith(expect.any(Function));
  });

  it("does not load while disabled", async () => {
    const adapter: QueryAdapter<void, string> = {
      load: vi.fn().mockResolvedValue("unused"),
    };

    useAdapterQuery(adapter, undefined, { enabled: false });
    await Promise.resolve();

    expect(adapter.load).not.toHaveBeenCalled();
    expect(hookHarness.setters[2]).toHaveBeenCalledWith(false);
  });
});
