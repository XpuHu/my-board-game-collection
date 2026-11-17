import { apiRequest } from "@/shared/api/client";
import type {
  AddToCollectionRequest,
  CreatePreorderRequest,
  ExternalSearchResponse,
  ImportExternalItemRequest,
  ItemDetailsDto,
  ItemTypeDto,
  ProviderCode,
  UpdateUserItemRequest,
  UserItemDto,
} from "@/shared/api/types";

export type CreateManualItemRequest = {
  typeId: string;
  title: string;
  originalTitle?: string | null;
  description?: string | null;
  year?: number | null;
  minPlayers?: number | null;
  maxPlayers?: number | null;
  minPlayTime?: number | null;
  maxPlayTime?: number | null;
  minAge?: number | null;
  complexity?: number | null;
  rating?: number | null;
  sourceMode?: "imported" | "manual";
  categories?: string[];
  mechanics?: string[];
  designers?: string[];
  artists?: string[];
  publishers?: string[];
  imageUrl?: string | null;
  linkUrl?: string | null;
};

export type ExternalItemSearchQuery = {
  q: string;
  provider?: ProviderCode;
  type?: string;
  fallbackToTesera?: boolean;
};

export function listItemTypes() {
  return apiRequest<ItemTypeDto[]>("/api/item-types");
}

export function searchExternalItems(query: ExternalItemSearchQuery) {
  const params = new URLSearchParams();
  params.set("q", query.q);
  if (query.provider) params.set("provider", query.provider);
  if (query.type) params.set("type", query.type);
  if (query.fallbackToTesera === false) params.set("fallback", "false");
  return apiRequest<ExternalSearchResponse>(`/api/external/search?${params}`);
}

export function importExternalItem(body: ImportExternalItemRequest) {
  return apiRequest<ItemDetailsDto>("/api/external/import", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function createManualItem(body: CreateManualItemRequest) {
  return apiRequest<ItemDetailsDto>("/api/items", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function addItemToCollection(
  itemId: string,
  body: AddToCollectionRequest = {},
) {
  return apiRequest<ItemDetailsDto>(
    `/api/items/${encodeURIComponent(itemId)}/collection`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function addItemToWishlist(itemId: string) {
  return apiRequest<UserItemDto>(
    `/api/items/${encodeURIComponent(itemId)}/wishlist`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export function updateItemUserData(
  itemId: string,
  body: UpdateUserItemRequest,
) {
  return apiRequest<UserItemDto>(
    `/api/items/${encodeURIComponent(itemId)}/user-item`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

export function createItemPreorder(
  itemId: string,
  body: CreatePreorderRequest,
) {
  return apiRequest<unknown>(
    `/api/items/${encodeURIComponent(itemId)}/preorders`,
    { method: "POST", body: JSON.stringify(body) },
  );
}
