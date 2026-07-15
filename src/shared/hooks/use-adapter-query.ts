"use client";

import { useCallback, useEffect, useState } from "react";

import type { QueryAdapter } from "@/shared/api/query-adapter";

export type AdapterQueryState<TData> = {
  data: TData | null;
  error: string | null;
  isLoading: boolean;
  reload: () => void;
};

export function useAdapterQuery<TParams, TData>(
  adapter: QueryAdapter<TParams, TData>,
  params: TParams,
  options: { enabled?: boolean; key?: string } = {},
): AdapterQueryState<TData> {
  const [data, setData] = useState<TData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(options.enabled !== false);
  const [revision, setRevision] = useState(0);
  const paramsSnapshot = stableSerialize(params);
  const paramsKey = options.key ?? paramsSnapshot;
  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    let active = true;

    if (options.enabled === false) {
      queueMicrotask(() => {
        if (active) setIsLoading(false);
      });
      return () => {
        active = false;
      };
    }

    const controller = new AbortController();
    queueMicrotask(() => {
      if (!active) return;
      setIsLoading(true);
      setError(null);
    });

    adapter
      .load(JSON.parse(paramsSnapshot) as TParams, {
        signal: controller.signal,
      })
      .then((result) => {
        setData(result);
        setIsLoading(false);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          reason instanceof Error
            ? reason.message
            : "Не удалось загрузить данные",
        );
        setIsLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [adapter, options.enabled, paramsKey, paramsSnapshot, revision]);

  return { data, error, isLoading, reload };
}

function stableSerialize(value: unknown): string {
  if (value === undefined) return "null";
  if (!value || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;

  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`)
    .join(",")}}`;
}
