import type {
  ExternalSearchResultDto,
  ItemTypeCode,
  ProviderCode,
} from "@/shared/api";

export type ItemProviderFilters = {
  type?: string;
};

export type ProviderItem = {
  provider: ProviderCode;
  externalId: string;
  title: string;
  originalTitle?: string | null;
  itemTypeCode?: ItemTypeCode | null;
  description?: string | null;
  year?: number | null;
  minPlayers?: number | null;
  maxPlayers?: number | null;
  minPlayTime?: number | null;
  maxPlayTime?: number | null;
  minAge?: number | null;
  complexity?: number | null;
  rating?: number | null;
  categories: string[];
  mechanics: string[];
  designers: string[];
  artists: string[];
  publishers: string[];
  imageUrl?: string | null;
  url?: string | null;
};

export interface ItemProvider {
  readonly code: ProviderCode;
  searchItems(
    query: string,
    filters?: ItemProviderFilters,
  ): Promise<ExternalSearchResultDto[]>;
  getItem(externalId: string): Promise<ProviderItem>;
  getRelatedItems(externalId: string): Promise<ExternalSearchResultDto[]>;
  synchronizeItem(externalId: string): Promise<ProviderItem>;
}
