import { ApiClientError, type QueryValue } from "@/shared/api/client";

export type QueryContext = {
  signal?: AbortSignal;
};

export interface QueryAdapter<TParams, TData> {
  load(params: TParams, context?: QueryContext): Promise<TData>;
}

type RestQueryAdapterOptions<TParams> = {
  path: string;
  baseUrl?: string;
  toQuery?: (params: TParams) => Record<string, QueryValue>;
};

export function createRestQueryAdapter<TParams, TData>({
  path,
  baseUrl = "",
  toQuery,
}: RestQueryAdapterOptions<TParams>): QueryAdapter<TParams, TData> {
  return {
    async load(params, context) {
      const response = await fetch(
        `${baseUrl}${appendQuery(path, toQuery?.(params))}`,
        { signal: context?.signal },
      );

      if (!response.ok) {
        throw await createAdapterError(response);
      }

      return (await response.json()) as TData;
    },
  };
}

type MockQueryAdapterOptions = {
  delay?: number;
};

export function createMockQueryAdapter<TParams, TData>(
  resolve: TData | ((params: TParams) => TData | Promise<TData>),
  { delay = 0 }: MockQueryAdapterOptions = {},
): QueryAdapter<TParams, TData> {
  return {
    async load(params, context) {
      if (delay > 0) await abortableDelay(delay, context?.signal);
      throwIfAborted(context?.signal);
      return typeof resolve === "function"
        ? await (resolve as (params: TParams) => TData | Promise<TData>)(params)
        : resolve;
    },
  };
}

function appendQuery(path: string, query?: Record<string, QueryValue>) {
  if (!query) return path;
  const searchParams = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value == null || value === "") return;
    if (Array.isArray(value)) {
      value.forEach((entry) => searchParams.append(key, String(entry)));
    } else {
      searchParams.set(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `${path}?${queryString}` : path;
}

async function createAdapterError(response: Response) {
  const fallbackMessage = `API request failed with status ${response.status}`;

  try {
    const payload = (await response.json()) as {
      error?: { code?: string; message?: string; details?: unknown };
    };
    return new ApiClientError({
      status: response.status,
      code: payload.error?.code,
      message: payload.error?.message ?? fallbackMessage,
      details: payload.error?.details,
    });
  } catch {
    return new ApiClientError({
      status: response.status,
      message: fallbackMessage,
    });
  }
}

function abortableDelay(delay: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    throwIfAborted(signal);
    const timeout = globalThis.setTimeout(resolve, delay);
    signal?.addEventListener(
      "abort",
      () => {
        globalThis.clearTimeout(timeout);
        reject(new DOMException("The operation was aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException("The operation was aborted", "AbortError");
  }
}
