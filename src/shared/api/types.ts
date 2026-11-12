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

export const userItemLifecycleStatuses = [
  "active",
  "for_sale",
  "sold",
  "archived",
] as const;

export const itemStatuses = userItemLifecycleStatuses;

export type UserItemLifecycleStatus =
  (typeof userItemLifecycleStatuses)[number];

export type StoredUserItemStatus =
  UserItemLifecycleStatus | "owned" | "wishlist" | "preordered" | "played";

/** @deprecated Use UserItemLifecycleStatus. */
export type ItemStatus = UserItemLifecycleStatus;

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

export const expectedDatePrecisions = [
  "day",
  "month",
  "quarter",
  "unknown",
] as const;

export type ExpectedDatePrecision = (typeof expectedDatePrecisions)[number];

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

export type MoneyDto = MoneyAmountDto;

export type ItemTypeDto = {
  id: string;
  code: ItemTypeCode;
  name: string;
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
  type: "reference" | "user";
  provider?: ProviderCode | null;
  url?: string | null;
  path?: string | null;
  caption?: string | null;
  sortOrder: number;
};

export type ImageCompactDto = {
  id: string;
  url?: string | null;
  path?: string | null;
  alt: string;
};

export type ItemCompactDto = {
  id: string;
  title: string;
  originalTitle?: string | null;
  type: ItemTypeDto;
  year?: number | null;
  cover?: ImageCompactDto | null;
  minPlayers?: number | null;
  maxPlayers?: number | null;
  minPlayTime?: number | null;
  maxPlayTime?: number | null;
  communityRating?: number | null;
};

export type ExternalReferenceDto = {
  id: string;
  provider: ProviderCode;
  externalId: string;
  url?: string | null;
  lastSync?: string | null;
};

export type LinkDto = {
  id: string;
  type: LinkType;
  url: string;
  title?: string | null;
};

export type PurchaseDto = {
  id: string;
  shop: string;
  price: MoneyDto;
  deliveryCost?: MoneyDto | null;
  discount?: MoneyDto | null;
  totalPrice: MoneyDto;
  purchaseDate?: string | null;
  comment?: string | null;
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

export type UpdatePurchaseRequest = Partial<CreatePurchaseRequest>;

export type UpdateItemRequest = {
  typeId?: string;
  title?: string;
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
  categories?: string[];
  mechanics?: string[];
  designers?: string[];
  artists?: string[];
  publishers?: string[];
};

export type CreateExternalReferenceRequest = {
  provider: ProviderCode;
  externalId: string;
  url?: string | null;
};

export type UpdateExternalReferenceRequest =
  Partial<CreateExternalReferenceRequest>;

export type CreateImageRequest = {
  type?: "reference" | "user";
  provider?: ProviderCode | null;
  url?: string | null;
  path?: string | null;
  caption?: string | null;
  sortOrder?: number;
};

export type UpdateImageRequest = Partial<CreateImageRequest>;

export type CreateLinkRequest = {
  type: LinkType;
  url: string;
  title?: string | null;
};

export type UpdateLinkRequest = Partial<CreateLinkRequest>;

export type NoteDto = {
  id: string;
  title?: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type ItemRelationDto = {
  id: string;
  direction: "parent" | "child";
  relationType:
    | "requires"
    | "expands"
    | "compatible_with"
    | "contains"
    | "part_of"
    | "localized_version_of"
    | "alternative_to"
    | "related";
  relatedItem: ItemCompactDto;
  comment?: string | null;
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
  favorite: boolean;
  location?: string | null;
  personalRating?: number | null;
  notes?: string | null;
  interestLevel?: number | null;
  decisionNotes?: string | null;
  tags: TagDto[];
};

export type UserItemState =
  | "owned"
  | "wishlist"
  | "preordered"
  | "played"
  | "for_sale"
  | "sold"
  | "archived";

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

export type CollectionCardDto = {
  item: ItemCompactDto;
  userItem: {
    states: UserItemState[];
    ownedAt: string;
    favorite: boolean;
    personalRating?: number | null;
    location?: string | null;
    tags: TagDto[];
  };
  plays: {
    count: number;
    lastPlayedAt?: string | null;
    lastResult?: PlayResult | null;
  };
  expansionsCount: number;
  imagesCount: number;
  activePreorder?: PreorderSummaryDto | null;
  purchaseTotal?: MoneyAmountDto | null;
};

export type WishlistCardDto = {
  item: ItemCompactDto & {
    minAge?: number | null;
    complexity?: number | null;
  };
  userItem: {
    states: UserItemState[];
    interestLevel?: number | null;
    decisionNotes?: string | null;
    tags: TagDto[];
  };
  mechanics: string[];
  categories: string[];
  priceSignal?: MoneyAmountDto | null;
  activePreorder?: PreorderSummaryDto | null;
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
  preorders: PreorderListItemDto[];
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

export type ItemReferenceDetailDto = ItemCompactDto & {
  description?: string | null;
  minAge?: number | null;
  complexity?: number | null;
  mechanics: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  designers: { id: string; name: string }[];
  artists: { id: string; name: string }[];
  publishers: { id: string; name: string }[];
  images: ImageDto[];
  externalReferences: ExternalReferenceDto[];
  links: LinkDto[];
  relations: ItemRelationDto[];
};

export type UserItemDetailDto = {
  id: string;
  states: UserItemState[];
  lifecycleStatus: UserItemLifecycleStatus;
  owned: boolean;
  wishlist: boolean;
  ownedAt?: string | null;
  favorite: boolean;
  location?: string | null;
  personalRating?: number | null;
  notes?: string | null;
  interestLevel?: number | null;
  decisionNotes?: string | null;
  tags: TagDto[];
};

export type ItemDetailDto = {
  item: ItemReferenceDetailDto;
  userItem?: UserItemDetailDto | null;
};

export type CollectionItemDetailDto = ItemDetailDto & {
  userItem: UserItemDetailDto;
  playSummary: {
    count: number;
    lastPlayedAt?: string | null;
    totalDurationMinutes: number;
  };
  recentPlays: PlayListItemDto[];
  purchases: PurchaseDto[];
  preorders: PreorderListItemDto[];
  notes: NoteDto[];
  primaryAction: "add_play";
};

export type WishlistItemDetailDto = ItemDetailDto & {
  userItem: UserItemDetailDto;
  shopLinks: LinkDto[];
  videos: LinkDto[];
  similarItems: ItemCompactDto[];
  primaryActions: ("add_to_collection" | "create_preorder")[];
};

export type UpdateUserItemRequest = {
  status?: ItemStatus;
  owned?: boolean;
  wishlist?: boolean;
  favorite?: boolean;
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
  russianTitle?: string | null;
  provider: ProviderCode;
  externalId: string;
  title: string;
  originalTitle?: string | null;
  itemTypeCode?: ItemTypeCode | null;
  year?: number | null;
  minPlayers?: number | null;
  maxPlayers?: number | null;
  minPlayTime?: number | null;
  maxPlayTime?: number | null;
  rating?: number | null;
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
  startedAt?: string | null;
  playersCount?: number | null;
  durationMinutes?: number | null;
  result?: PlayResult | null;
  score?: string | null;
  scenario?: string | null;
  playerNames: string[];
  usedItemIds: string[];
  personalRating?: number | null;
  notes?: string | null;
  source: "manual" | "boardgamegeek";
  bggPlayId?: string | null;
  locallyModifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PlayListItemDto = {
  id: string;
  item: ItemCompactDto;
  playedAt: string;
  startedAt?: string | null;
  playersCount?: number | null;
  durationMinutes?: number | null;
  result?: PlayResult | null;
  score?: string | null;
  scenario?: string | null;
  playerNames: string[];
  usedItems: ItemCompactDto[];
  personalRating?: number | null;
  notes?: string | null;
  source: "manual" | "boardgamegeek";
};

export type CreatePlaySessionRequest = {
  playedAt: string;
  startedAt?: string | null;
  playersCount?: number | null;
  durationMinutes?: number | null;
  result?: PlayResult | null;
  score?: string | null;
  scenario?: string | null;
  playerNames?: string[];
  usedItemIds?: string[];
  personalRating?: number | null;
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

export type PreorderUiStatus = "active" | "delayed" | "received" | "cancelled";

export type ExpectedDateEventValue = {
  expectedDate: string | null;
  expectedDatePrecision: ExpectedDatePrecision;
};

export type PreorderSummaryDto = {
  id: string;
  status: PreorderStatus;
  uiStatus: PreorderUiStatus;
  expectedDate?: string | null;
  expectedDatePrecision: ExpectedDatePrecision;
};

export type PreorderListItemDto = PreorderSummaryDto & {
  item: ItemCompactDto;
  shop: string;
  price: MoneyAmountDto;
  orderDate?: string | null;
  receivedDate?: string | null;
  trackingNumber?: string | null;
  comment?: string | null;
  updatedAt: string;
};

export type PreorderExpectedDateChangedEventDto = {
  id: string;
  type: "expected_date_changed";
  oldValue?: ExpectedDateEventValue | null;
  newValue?: ExpectedDateEventValue | null;
  reason?: string | null;
  comment?: string | null;
  createdAt: string;
  legacyFormat: boolean;
};

export type PreorderStatusChangedEventDto = {
  id: string;
  type: "status_changed";
  oldValue?: PreorderStatus | null;
  newValue?: PreorderStatus | null;
  reason?: string | null;
  comment?: string | null;
  createdAt: string;
};

export type PreorderEventDto =
  PreorderExpectedDateChangedEventDto | PreorderStatusChangedEventDto;

export type UpdatePreorderExpectedDateResponse = {
  preorder: PreorderListItemDto;
  event: PreorderEventDto;
};

export type CreatePreorderRequest = {
  shop: string;
  price: number;
  currency: string;
  orderDate?: string | null;
  expectedDate?: string | null;
  expectedDatePrecision?: ExpectedDatePrecision;
  receivedDate?: string | null;
  trackingNumber?: string | null;
  status: PreorderStatus;
  comment?: string | null;
};

export type UpdatePreorderExpectedDateRequest = {
  expectedDate: string | null;
  expectedDatePrecision?: ExpectedDatePrecision;
  reason?: string | null;
  comment?: string | null;
};

export type SyncItemRequest = {
  provider?: ProviderCode;
  preview?: boolean;
  fields?: SyncItemField[];
};

export const syncItemFields = [
  "type",
  "title",
  "originalTitle",
  "description",
  "year",
  "minPlayers",
  "maxPlayers",
  "minPlayTime",
  "maxPlayTime",
  "minAge",
  "complexity",
  "rating",
  "categories",
  "mechanics",
  "designers",
  "artists",
  "publishers",
  "externalReferences",
  "images",
  "links",
] as const;

export type SyncItemField = (typeof syncItemFields)[number];

export type SyncItemChangeDto = {
  field: SyncItemField;
  currentValue: unknown;
  incomingValue: unknown;
  selectedByDefault: boolean;
};

export type SyncItemResponse = {
  item: ItemDetailsDto;
  preview: boolean;
  syncedAt?: string;
  updatedFields: SyncItemField[];
  changes: SyncItemChangeDto[];
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

export type StatisticsOverviewDto = StatisticsSummaryDto & {
  uniquePlayedItems: number;
  totalPlayHours: number;
  averagePersonalRating?: number | null;
  winRate?: number | null;
  playsByMonth: { month: string; playsCount: number }[];
  playerCountDistribution: { playersCount: number; playsCount: number }[];
  results: { result: PlayResult; playsCount: number }[];
  activityByWeekday: { weekday: number; playsCount: number }[];
  staleItems: CollectionCardDto[];
  expansionUsage: { itemId: string; title: string; playsCount: number }[];
  frequentPlayers: { name: string; playsCount: number }[];
};

export type StatisticsQueryDto = {
  period?: "month" | "quarter" | "year" | "all" | "custom";
  from?: string;
  to?: string;
};

export type DashboardDto = {
  recentPlays: PlayListItemDto[];
  upcomingPreorders: PreorderListItemDto[];
  recentlyAdded: CollectionCardDto[];
  monthSummary: {
    playsCount: number;
    uniqueItemsCount: number;
    totalDurationMinutes: number;
    averagePersonalRating?: number | null;
    winsCount: number;
  };
  favoriteItem?: CollectionCardDto | null;
  activity: { date: string; playsCount: number }[];
};

export type CollectionQueryDto = {
  q?: string;
  type?: ItemTypeCode;
  personalRating?: number;
  playsMin?: number;
  playsMax?: number;
  lastPlayedFrom?: string;
  lastPlayedTo?: string;
  hasExpansions?: boolean;
  hasActivePreorder?: boolean;
  neverPlayed?: boolean;
  notPlayedSince?: string;
  location?: string;
  tag?: string[];
  favorite?: boolean;
  sort?: "added" | "lastPlayed" | "plays" | "rating" | "title";
  direction?: "asc" | "desc";
  page?: number;
  pageSize?: 24;
};

export type WishlistQueryDto = {
  q?: string;
  type?: ItemTypeCode;
  ratingMin?: number;
  players?: number;
  playTimeMax?: number;
  complexityMin?: number;
  complexityMax?: number;
  mechanic?: string[];
  category?: string[];
  hasLocalization?: boolean;
  hasPrice?: boolean;
  interestLevel?: number;
  sort?: "interest" | "rating" | "year" | "title" | "updated";
  direction?: "asc" | "desc";
  page?: number;
  pageSize?: 24;
};

export type PlaysQueryDto = {
  itemId?: string;
  from?: string;
  to?: string;
  result?: PlayResult;
  player?: string;
  /** @deprecated Use player. */
  playerName?: string;
  playersMin?: number;
  playersMax?: number;
  durationMin?: number;
  durationMax?: number;
  usedItemId?: string;
  source?: "manual" | "boardgamegeek";
  sort?: "playedAt" | "duration" | "rating";
  direction?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export type PreorderQueryDto = {
  group?: "all" | "active" | "received" | "cancelled";
  itemId?: string;
  expectedFrom?: string;
  expectedTo?: string;
  page?: number;
  pageSize?: number;
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

export type BackupItemTypeDto = {
  id: string;
  code: ItemTypeCode;
  name: string;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BackupItemDto = {
  id: string;
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
  sourceMode: "imported" | "manual";
  categories: string[];
  mechanics: string[];
  designers: string[];
  artists: string[];
  publishers: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

export type BackupUserItemDto = Omit<UserItemDto, "tags" | "status"> & {
  status: StoredUserItemStatus;
  ownedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BackupPlaySessionDto = Omit<PlaySessionDto, "itemTitle"> & {
  importedAt?: string | null;
};

export type BackupTagDto = TagDto & {
  createdAt: string;
  updatedAt: string;
};

export type BackupItemTagDto = {
  itemId: string;
  tagId: string;
};

export type BackupExternalReferenceDto = ExternalReferenceDto & {
  itemId: string;
};

export type BackupImageDto = ImageDto & {
  itemId: string;
  createdAt: string;
};

export type BackupLinkDto = LinkDto & {
  itemId: string;
};

export type BackupPurchaseDto = {
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

export type BackupPreorderEventDto = {
  id: string;
  preorderId: string;
  type: string;
  oldValue?: string | null;
  newValue?: string | null;
  reason?: string | null;
  comment?: string | null;
  createdAt: string;
};

export type BackupPreorderDto = {
  id: string;
  itemId: string;
  itemTitle: string;
  shop: string;
  price: number;
  currency: string;
  orderDate?: string | null;
  expectedDate?: string | null;
  expectedDatePrecision: ExpectedDatePrecision;
  receivedDate?: string | null;
  trackingNumber?: string | null;
  status: PreorderStatus;
  comment?: string | null;
  events: BackupPreorderEventDto[];
  createdAt: string;
  updatedAt: string;
};

export type BackupNoteDto = NoteDto & {
  itemId: string;
};

export type BackupItemRelationDto = {
  id: string;
  parentItemId: string;
  childItemId: string;
  relationType: string;
  comment?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type JsonBackupDto = {
  schemaVersion: 2;
  exportedAt: string;
  data: {
    itemTypes: BackupItemTypeDto[];
    items: BackupItemDto[];
    userItems: BackupUserItemDto[];
    externalReferences: BackupExternalReferenceDto[];
    images: BackupImageDto[];
    links: BackupLinkDto[];
    purchases: BackupPurchaseDto[];
    preorders: BackupPreorderDto[];
    playSessions: BackupPlaySessionDto[];
    notes: BackupNoteDto[];
    relations: BackupItemRelationDto[];
    tags: BackupTagDto[];
    itemTags: BackupItemTagDto[];
  };
};

export type JsonImportReportDto = {
  importedAt: string;
  created: Record<string, number>;
  updated: Record<string, number>;
  skippedDuplicates: {
    externalReferences: number;
    bggPlayIds: number;
    relations: number;
    itemTags: number;
  };
  skippedMissingReferences: {
    itemTypes: number;
    items: number;
    tags: number;
    preorders: number;
  };
};
