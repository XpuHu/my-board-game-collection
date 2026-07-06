export const providerCodes = [
  "boardgamegeek",
  "tesera",
  "nastolio",
  "manual",
] as const;

export type ProviderCode = (typeof providerCodes)[number];

export const itemTypeCodes = [
  "base_game",
  "expansion",
  "promo",
  "accessory",
  "organizer",
  "component",
  "miniature",
  "playmat",
  "sleeves",
  "dice",
  "other",
] as const;

export type ItemTypeCode = (typeof itemTypeCodes)[number];

export const itemStatuses = [
  "owned",
  "wishlist",
  "preordered",
  "played",
  "for_sale",
  "sold",
  "archived",
] as const;

export type ItemStatus = (typeof itemStatuses)[number];

export const playResults = ["win", "loss", "score", "unknown"] as const;

export type PlayResult = (typeof playResults)[number];

export const preorderStatuses = [
  "planned",
  "ordered",
  "paid",
  "shipped",
  "received",
  "cancelled",
] as const;

export type PreorderStatus = (typeof preorderStatuses)[number];

export const linkTypes = [
  "official",
  "rules",
  "kickstarter",
  "gamefound",
  "youtube",
  "review",
  "publisher",
  "shop",
  "other",
] as const;

export type LinkType = (typeof linkTypes)[number];

export type ApiError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type ProviderWarningDto = {
  provider: ProviderCode;
  code: string;
  message: string;
};

export type MoneyAmountDto = {
  amount: number;
  currency: string;
};

export type ItemTypeDto = {
  id: string;
  code: ItemTypeCode;
  name: string;
  isSystem: boolean;
};

export type TagDto = {
  id: string;
  name: string;
  color?: string | null;
};

export type CreateTagRequest = {
  name: string;
  color?: string | null;
};

export type ImageDto = {
  id: string;
  itemId: string;
  type: "reference" | "user";
  provider?: ProviderCode | null;
  url?: string | null;
  path?: string | null;
  caption?: string | null;
  sortOrder: number;
  createdAt: string;
};

export type ExternalReferenceDto = {
  id: string;
  itemId: string;
  provider: ProviderCode;
  externalId: string;
  url?: string | null;
  lastSync?: string | null;
};

export type LinkDto = {
  id: string;
  itemId: string;
  type: LinkType;
  url: string;
  title?: string | null;
};

export type PurchaseDto = {
  id: string;
  itemId: string;
  shop: string;
  price: number;
  currency: string;
  deliveryCost?: number | null;
  discount?: number | null;
  totalPrice: number;
  purchaseDate?: string | null;
  comment?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreatePurchaseRequest = {
  shop: string;
  price: number;
  currency: string;
  deliveryCost?: number | null;
  discount?: number | null;
  totalPrice?: number | null;
  purchaseDate?: string | null;
  comment?: string | null;
};

export type NoteDto = {
  id: string;
  itemId: string;
  title?: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type ItemRelationDto = {
  id: string;
  parentItemId: string;
  childItemId: string;
  relationType: string;
  comment?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ItemDto = {
  id: string;
  type: ItemTypeDto;
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
  sourceMode: "imported" | "manual";
  categories: string[];
  mechanics: string[];
  designers: string[];
  artists: string[];
  publishers: string[];
  createdAt: string;
  updatedAt: string;
};

export type UserItemDto = {
  id: string;
  itemId: string;
  status: ItemStatus;
  owned: boolean;
  wishlist: boolean;
  location?: string | null;
  personalRating?: number | null;
  notes?: string | null;
  interestLevel?: number | null;
  decisionNotes?: string | null;
  tags: TagDto[];
};

export type ItemListDto = {
  item: {
    id: string;
    type: ItemTypeDto;
    title: string;
    originalTitle?: string | null;
    year?: number | null;
    rating?: number | null;
  };
  userItem: {
    status: ItemStatus;
    owned: boolean;
    wishlist: boolean;
    personalRating?: number | null;
    location?: string | null;
    interestLevel?: number | null;
  };
  mainImage?: ImageDto | null;
  playsCount: number;
  lastPlayedAt?: string | null;
  activePreordersCount: number;
  purchasesCount: number;
  updatedAt: string;
};

export type PlaySummaryDto = {
  playsCount: number;
  lastPlayedAt?: string | null;
  totalDurationMinutes: number;
};

export type ItemDetailsDto = {
  item: ItemDto;
  userItem: UserItemDto;
  externalReferences: ExternalReferenceDto[];
  images: ImageDto[];
  links: LinkDto[];
  purchases: PurchaseDto[];
  preorders: PreorderDto[];
  playSummary: PlaySummaryDto;
  notes: NoteDto[];
  relations: ItemRelationDto[];
};

export type CollectionItemDetailsDto = ItemDetailsDto & {
  recentPlays: PlaySessionDto[];
  primaryAction: "add_play";
};

export type WishlistItemDetailsDto = ItemDetailsDto & {
  similarItems: ItemListDto[];
  videos: LinkDto[];
  shopLinks: LinkDto[];
  primaryActions: ("add_to_collection" | "create_preorder")[];
};

export type UpdateUserItemRequest = {
  status?: ItemStatus;
  owned?: boolean;
  wishlist?: boolean;
  location?: string | null;
  personalRating?: number | null;
  notes?: string | null;
  interestLevel?: number | null;
  decisionNotes?: string | null;
  tagIds?: string[];
};

export type AddToCollectionRequest = {
  purchase?: CreatePurchaseRequest;
  location?: string | null;
  personalRating?: number | null;
  notes?: string | null;
};

export type ExternalSearchResultDto = {
  provider: ProviderCode;
  externalId: string;
  title: string;
  originalTitle?: string | null;
  itemTypeCode?: ItemTypeCode | null;
  year?: number | null;
  imageUrl?: string | null;
  url?: string | null;
  description?: string | null;
};

export type ExternalSearchResponse = {
  data: ExternalSearchResultDto[];
  warnings?: ProviderWarningDto[];
};

export type ImportExternalItemRequest = {
  provider: ProviderCode;
  externalId: string;
  typeId?: string;
  target?: "collection" | "wishlist" | "reference_only";
};

export type PlaySessionDto = {
  id: string;
  itemId: string;
  itemTitle: string;
  playedAt: string;
  playersCount?: number | null;
  durationMinutes?: number | null;
  result?: PlayResult | null;
  score?: string | null;
  scenario?: string | null;
  playerNames: string[];
  usedItemIds: string[];
  notes?: string | null;
  source: "manual" | "boardgamegeek";
  bggPlayId?: string | null;
  locallyModifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreatePlaySessionRequest = {
  playedAt: string;
  playersCount?: number | null;
  durationMinutes?: number | null;
  result?: PlayResult | null;
  score?: string | null;
  scenario?: string | null;
  playerNames?: string[];
  usedItemIds?: string[];
  notes?: string | null;
};

export type UpdateBggSettingsRequest = {
  username: string;
};

export type SyncBggPlaysRequest = {
  username?: string;
  since?: string | null;
};

export type SyncBggPlaysResponse = {
  syncedAt: string;
  imported: number;
  updated: number;
  skippedDuplicates: number;
  unmatched: {
    bggThingId: string;
    title: string;
    playsCount: number;
  }[];
  warnings?: ProviderWarningDto[];
};

export type PreorderDto = {
  id: string;
  itemId: string;
  itemTitle: string;
  shop: string;
  price: number;
  currency: string;
  orderDate?: string | null;
  expectedDate?: string | null;
  receivedDate?: string | null;
  trackingNumber?: string | null;
  status: PreorderStatus;
  comment?: string | null;
  events: PreorderEventDto[];
  createdAt: string;
  updatedAt: string;
};

export type PreorderEventDto = {
  id: string;
  preorderId: string;
  type: "expected_date_changed" | string;
  oldValue?: string | null;
  newValue?: string | null;
  reason?: string | null;
  comment?: string | null;
  createdAt: string;
};

export type CreatePreorderRequest = {
  shop: string;
  price: number;
  currency: string;
  orderDate?: string | null;
  expectedDate?: string | null;
  receivedDate?: string | null;
  trackingNumber?: string | null;
  status: PreorderStatus;
  comment?: string | null;
};

export type UpdatePreorderExpectedDateRequest = {
  expectedDate: string | null;
  reason?: string | null;
  comment?: string | null;
};

export type SyncItemRequest = {
  provider?: ProviderCode;
};

export type SyncItemResponse = {
  item: ItemDetailsDto;
  syncedAt: string;
  updatedFields: string[];
  warnings?: ProviderWarningDto[];
};

export type StatisticsSummaryDto = {
  playsTotal: number;
  playsThisMonth: number;
  favoriteItem?: ItemListDto | null;
  mostPlayedItems: ItemListDto[];
  latestPlays: PlaySessionDto[];
  playCountByYear: { year: number; count: number }[];
  averagePlayDurationMinutes?: number | null;
  itemsTotal: number;
  wishlistTotal: number;
  collectionValue: MoneyAmountDto[];
  preorderValue: MoneyAmountDto[];
};

export type SettingsDto = {
  language: "ru" | "en";
  theme: "light" | "dark" | "system";
  defaultItemTypeId?: string | null;
  defaultProvider?: ProviderCode | null;
  providerPriority: ProviderCode[];
  autoSyncItemReference: boolean;
  bggUsername?: string | null;
  lastBggPlaySync?: string | null;
};
