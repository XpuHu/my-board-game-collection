import {
  createMockQueryAdapter,
  createRestQueryAdapter,
} from "@/shared/api/query-adapter";
import type {
  PaginatedResponse,
  PreorderListItemDto,
  PreorderQueryDto,
  UpdatePreorderRequest,
  UpdatePreorderExpectedDateRequest,
  UpdatePreorderExpectedDateResponse,
} from "@/shared/api/types";
import { apiRequest } from "@/shared/api/client";

export type PreordersListQuery = PreorderQueryDto & {
  page?: number;
  pageSize?: number;
};
export type PreordersListResult = PaginatedResponse<PreorderListItemDto>;

export const preordersRestAdapter = createRestQueryAdapter<
  PreordersListQuery,
  PreordersListResult
>({
  path: "/api/preorders",
  toQuery: (params) => ({ view: "compact", ...params }),
});

export const createPreordersMockAdapter = (
  resolve:
    | PreordersListResult
    | ((
        params: PreordersListQuery,
      ) => PreordersListResult | Promise<PreordersListResult>),
  delay = 0,
) =>
  createMockQueryAdapter<PreordersListQuery, PreordersListResult>(resolve, {
    delay,
  });

export function updatePreorderExpectedDate(
  preorderId: string,
  input: UpdatePreorderExpectedDateRequest,
) {
  return apiRequest<UpdatePreorderExpectedDateResponse>(
    `/api/preorders/${encodeURIComponent(preorderId)}/expected-date`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export function updatePreorderStatus(
  preorderId: string,
  status: "received" | "cancelled",
  receivedDate?: string,
) {
  return apiRequest<unknown>(
    `/api/preorders/${encodeURIComponent(preorderId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status,
        ...(status === "received" && receivedDate ? { receivedDate } : {}),
      }),
    },
  );
}

export function reactivatePreorder(preorderId: string) {
  return apiRequest<unknown>(
    `/api/preorders/${encodeURIComponent(preorderId)}/reactivate`,
    { method: "POST" },
  );
}

export function deletePreorder(preorderId: string) {
  return apiRequest<void>(`/api/preorders/${encodeURIComponent(preorderId)}`, {
    method: "DELETE",
  });
}

export function updatePreorder(
  preorderId: string,
  input: UpdatePreorderRequest,
) {
  return apiRequest<unknown>(
    `/api/preorders/${encodeURIComponent(preorderId)}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}
