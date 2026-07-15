import type {
  ItemDto,
  ItemStatus,
  ItemTypeDto,
  LinkType,
  PlayResult,
  PlaySummaryDto,
  PreorderStatus,
  ProviderCode,
  TagDto,
} from "../types";

export type LegacyImageDto = {
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

export type LegacyExternalReferenceDto = {
  id: string;
  itemId: string;
  provider: ProviderCode;
  externalId: string;
  url?: string | null;
  lastSync?: string | null;
};

export type LegacyLinkDto = {
  id: string;
  itemId: string;
  type: LinkType;
  url: string;
  title?: string | null;
};

export type LegacyPurchaseDto = {
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

export type LegacyNoteDto = {
  id: string;
  itemId: string;
  title?: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type LegacyItemRelationDto = {
  id: string;
  parentItemId: string;
  childItemId: string;
  relationType: string;
  comment?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LegacyUserItemDto = {
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

export type LegacyItemListDto = {
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
  mainImage?: LegacyImageDto | null;
  playsCount: number;
  lastPlayedAt?: string | null;
  activePreordersCount: number;
  purchasesCount: number;
  updatedAt: string;
};

export type LegacyPlaySessionDto = {
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

export type LegacyPreorderEventDto = {
  id: string;
  preorderId: string;
  type: "expected_date_changed" | string;
  oldValue?: string | null;
  newValue?: string | null;
  reason?: string | null;
  comment?: string | null;
  createdAt: string;
};

export type LegacyPreorderDto = {
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
  events: LegacyPreorderEventDto[];
  createdAt: string;
  updatedAt: string;
};

export type LegacyItemDetailsDto = {
  item: ItemDto;
  userItem: LegacyUserItemDto;
  externalReferences: LegacyExternalReferenceDto[];
  images: LegacyImageDto[];
  links: LegacyLinkDto[];
  purchases: LegacyPurchaseDto[];
  preorders: LegacyPreorderDto[];
  playSummary: PlaySummaryDto;
  notes: LegacyNoteDto[];
  relations: LegacyItemRelationDto[];
};

export type LegacyCollectionItemDetailsDto = LegacyItemDetailsDto & {
  recentPlays: LegacyPlaySessionDto[];
  primaryAction: "add_play";
};

export type LegacyWishlistItemDetailsDto = LegacyItemDetailsDto & {
  similarItems: LegacyItemListDto[];
  videos: LegacyLinkDto[];
  shopLinks: LegacyLinkDto[];
  primaryActions: ("add_to_collection" | "create_preorder")[];
};
