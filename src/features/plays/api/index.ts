import {
  createMockQueryAdapter,
  createRestQueryAdapter,
} from "@/shared/api/query-adapter";
import type {
  CreatePlaySessionRequest,
  PaginatedResponse,
  PlayListItemDto,
  PlaysQueryDto,
} from "@/shared/api/types";
import { apiRequest } from "@/shared/api/client";

export type PlaysListQuery = PlaysQueryDto & {
  page?: number;
  pageSize?: number;
};
export type PlaysListResult = PaginatedResponse<PlayListItemDto>;

export const playsRestAdapter = createRestQueryAdapter<
  PlaysListQuery,
  PlaysListResult
>({
  path: "/api/plays",
  toQuery: (params) => ({ view: "compact", ...params }),
});

export const createPlaysMockAdapter = (
  resolve:
    | PlaysListResult
    | ((params: PlaysListQuery) => PlaysListResult | Promise<PlaysListResult>),
  delay = 0,
) =>
  createMockQueryAdapter<PlaysListQuery, PlaysListResult>(resolve, { delay });

export function createPlay(itemId: string, input: CreatePlaySessionRequest) {
  return apiRequest<unknown>(
    `/api/items/${encodeURIComponent(itemId)}/plays`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function updatePlay(playId: string, input: CreatePlaySessionRequest) {
  return apiRequest<unknown>(`/api/plays/${encodeURIComponent(playId)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deletePlay(playId: string) {
  return apiRequest<void>(`/api/plays/${encodeURIComponent(playId)}`, {
    method: "DELETE",
  });
}
