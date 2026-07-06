import { z } from "zod";

export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  const text = await request.text();
  const json = text.length > 0 ? JSON.parse(text) : {};

  return schema.parse(json);
}

export function getSearchParam(searchParams: URLSearchParams, key: string) {
  const value = searchParams.get(key);

  return value?.trim() || undefined;
}

export function getBooleanSearchParam(
  searchParams: URLSearchParams,
  key: string,
) {
  const value = getSearchParam(searchParams, key);

  if (value === undefined) {
    return undefined;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return undefined;
}

export function getNumberSearchParam(
  searchParams: URLSearchParams,
  key: string,
) {
  const value = getSearchParam(searchParams, key);

  if (value === undefined) {
    return undefined;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : undefined;
}
