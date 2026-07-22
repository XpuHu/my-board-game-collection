import { ApiClientError, type QueryValue } from "./http";

export { ApiClientError, type QueryValue };

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const fallback = `API request failed with status ${response.status}`;
    try {
      const payload = (await response.json()) as {
        error?: { code?: string; message?: string; details?: unknown };
      };
      throw new ApiClientError({
        status: response.status,
        code: payload.error?.code,
        message: payload.error?.message ?? fallback,
        details: payload.error?.details,
      });
    } catch (error) {
      if (error instanceof ApiClientError) throw error;
      throw new ApiClientError({ status: response.status, message: fallback });
    }
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
