import { z } from "zod";

import type { PaginatedResponse } from "@/shared/api";

export type PaginationInput = {
  page: number;
  pageSize: number;
};

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export function parsePagination(
  searchParams: URLSearchParams,
): PaginationInput {
  return paginationSchema.parse({
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
  });
}

export function paginate<T>(
  items: T[],
  pagination: PaginationInput,
): PaginatedResponse<T> {
  const { page, pageSize } = pagination;
  const total = items.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;

  return {
    data: items.slice(start, start + pageSize),
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
    },
  };
}
