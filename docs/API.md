# API.md

# Board Game Collection API

**Версия:** 2.1  
**Статус:** Draft

---

# 1. Цель документа

API описывает контракт frontend и backend для коллекции, wishlist, предзаказов, партий и синхронизации с внешними источниками.

API проектируется вокруг `Item` и `UserItem`.

`Item` содержит локальный кэш справочных данных из внешних источников.

`UserItem` содержит пользовательское состояние: коллекция, wishlist, личная оценка, место хранения, заметки и теги.

---

# 2. Общие правила

Базовый путь:

```text
/api
```

Формат:

```text
application/json
```

Исключение: загрузка пользовательских фотографий использует `multipart/form-data`.

Все идентификаторы имеют тип `string` и содержат UUID, если не указано иное.

Даты передаются в ISO 8601.

---

# 3. Ошибки

```ts
type ApiError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};
```

Стандартные коды:

* `400 VALIDATION_ERROR`;
* `404 ITEM_NOT_FOUND`;
* `404 PLAY_SESSION_NOT_FOUND`;
* `404 PREORDER_NOT_FOUND`;
* `409 IMPORT_CONFLICT`;
* `409 EXTERNAL_REFERENCE_ALREADY_IMPORTED`;
* `409 BGG_PLAY_ALREADY_IMPORTED`;
* `502 PROVIDER_ERROR`.

---

# 4. Общие DTO

```ts
type ProviderCode =
  | "boardgamegeek"
  | "tesera"
  | "nastolio"
  | "manual";

type ItemTypeCode =
  | "base_game"
  | "expansion"
  | "promo"
  | "accessory"
  | "organizer"
  | "component"
  | "miniature"
  | "playmat"
  | "sleeves"
  | "dice"
  | "other";

type ItemStatus =
  | "owned"
  | "wishlist"
  | "preordered"
  | "played"
  | "for_sale"
  | "sold"
  | "archived";

type ItemTypeDto = {
  id: string;
  code: ItemTypeCode;
  name: string;
  isSystem: boolean;
};
```

---

# 5. Supporting DTO

```ts
type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

type ProviderWarningDto = {
  provider: ProviderCode;
  code: string;
  message: string;
};

type MoneyAmountDto = {
  amount: number;
  currency: string;
};

type TagDto = {
  id: string;
  name: string;
  color?: string | null;
};

type ImageDto = {
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

type ExternalReferenceDto = {
  id: string;
  itemId: string;
  provider: ProviderCode;
  externalId: string;
  url?: string | null;
  lastSync?: string | null;
};

type LinkDto = {
  id: string;
  itemId: string;
  type:
    | "official"
    | "rules"
    | "kickstarter"
    | "gamefound"
    | "youtube"
    | "review"
    | "publisher"
    | "shop"
    | "other";
  url: string;
  title?: string | null;
};

type PurchaseDto = {
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

type CreatePurchaseRequest = {
  shop: string;
  price: number;
  currency: string;
  deliveryCost?: number | null;
  discount?: number | null;
  totalPrice?: number | null;
  purchaseDate?: string | null;
  comment?: string | null;
};

type NoteDto = {
  id: string;
  itemId: string;
  title?: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
};

type ItemRelationDto = {
  id: string;
  parentItemId: string;
  childItemId: string;
  relationType: string;
  comment?: string | null;
  createdAt: string;
  updatedAt: string;
};
```

---

# 6. Item DTO

```ts
type ItemDto = {
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

type UserItemDto = {
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

type ItemListDto = {
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

type ItemDetailsDto = {
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
```

---

# 7. Collection API

## Получить компактную коллекцию

```http
GET /api/collection
```

Query:

| Параметр | Описание |
| -------- | -------- |
| q | поиск |
| type | тип `Item` |
| rating | личная оценка |
| location | место хранения |
| playedFrom | партия после даты |
| playedTo | партия до даты |
| hasActivePreorder | активный предзаказ |
| tag | тег |
| page | страница |
| pageSize | размер страницы |

Ответ:

```ts
PaginatedResponse<ItemListDto>
```

Endpoint возвращает только `owned = true`.

---

## Получить компактную карточку коллекции

```http
GET /api/collection/{itemId}
```

Ответ:

```ts
type CollectionItemDetailsDto = ItemDetailsDto & {
  recentPlays: PlaySessionDto[];
  primaryAction: "add_play";
};
```

---

## Обновить пользовательское состояние

```http
PATCH /api/items/{itemId}/user-item
```

```ts
type UpdateUserItemRequest = {
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
```

Ответ:

```ts
UserItemDto
```

---

# 8. Wishlist API

## Получить wishlist

```http
GET /api/wishlist
```

Query:

| Параметр | Описание |
| -------- | -------- |
| q | поиск |
| minRating | минимальный рейтинг |
| players | количество игроков |
| maxPlayTime | максимальное время партии |
| mechanics | механики |
| categories | категории |
| hasPrice | есть цена |
| page | страница |
| pageSize | размер страницы |

Ответ:

```ts
PaginatedResponse<ItemListDto>
```

Endpoint возвращает `wishlist = true`.

---

## Получить подробную карточку wishlist

```http
GET /api/wishlist/{itemId}
```

Ответ:

```ts
type WishlistItemDetailsDto = ItemDetailsDto & {
  similarItems: ItemListDto[];
  videos: LinkDto[];
  shopLinks: LinkDto[];
  primaryActions: ("add_to_collection" | "create_preorder")[];
};
```

---

## Добавить в wishlist

```http
POST /api/items/{itemId}/wishlist
```

Ответ:

```ts
UserItemDto
```

Backend устанавливает `wishlist = true`.

---

## Добавить в коллекцию

```http
POST /api/items/{itemId}/collection
```

```ts
type AddToCollectionRequest = {
  purchase?: CreatePurchaseRequest;
  location?: string | null;
  personalRating?: number | null;
  notes?: string | null;
};
```

Ответ:

```ts
ItemDetailsDto
```

Backend устанавливает `owned = true` и не создает дубль, если `Item` уже был в wishlist.

---

# 9. External Search API

```http
GET /api/external/search
```

Query:

| Параметр | Описание |
| -------- | -------- |
| q | название или ссылка |
| provider | необязательный источник |
| type | тип элемента |

```ts
type ExternalSearchResultDto = {
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

type ExternalSearchResponse = {
  data: ExternalSearchResultDto[];
  warnings?: ProviderWarningDto[];
};
```

---

## Импорт из внешнего источника

```http
POST /api/external/import
```

```ts
type ImportExternalItemRequest = {
  provider: ProviderCode;
  externalId: string;
  typeId?: string;
  target?: "collection" | "wishlist" | "reference_only";
};
```

Ответ:

```ts
ItemDetailsDto
```

`target` задает пользовательское состояние после импорта.

---

# 10. Play Sessions API

```ts
type PlayResult = "win" | "loss" | "score" | "unknown";

type PlaySessionDto = {
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

type PlaySummaryDto = {
  playsCount: number;
  lastPlayedAt?: string | null;
  totalDurationMinutes: number;
};
```

## Получить партии

```http
GET /api/plays
```

Query:

| Параметр | Описание |
| -------- | -------- |
| itemId | фильтр по игре |
| from | дата от |
| to | дата до |
| source | источник |
| page | страница |
| pageSize | размер страницы |

Ответ:

```ts
PaginatedResponse<PlaySessionDto>
```

---

## Добавить партию

```http
POST /api/items/{itemId}/plays
```

```ts
type CreatePlaySessionRequest = {
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
```

Ответ:

```ts
PlaySessionDto
```

---

## Обновить партию

```http
PATCH /api/plays/{playId}
```

Тело:

```ts
Partial<CreatePlaySessionRequest>
```

Ответ:

```ts
PlaySessionDto
```

---

## Удалить партию

```http
DELETE /api/plays/{playId}
```

---

# 11. BGG Sync API

## Настройки BGG

```http
PATCH /api/settings/bgg
```

```ts
type UpdateBggSettingsRequest = {
  username: string;
};
```

---

## Синхронизировать партии BGG

```http
POST /api/sync/bgg/plays
```

```ts
type SyncBggPlaysRequest = {
  username?: string;
  since?: string | null;
};

type SyncBggPlaysResponse = {
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
```

Синхронизация должна быть идемпотентной по `bggPlayId`.

---

# 12. Preorders API

```ts
type PreorderStatus =
  | "planned"
  | "ordered"
  | "paid"
  | "shipped"
  | "received"
  | "cancelled";

type PreorderDto = {
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

type PreorderEventDto = {
  id: string;
  preorderId: string;
  type: "expected_date_changed" | string;
  oldValue?: string | null;
  newValue?: string | null;
  reason?: string | null;
  comment?: string | null;
  createdAt: string;
};
```

## Получить предзаказы

```http
GET /api/preorders
```

---

## Создать предзаказ

```http
POST /api/items/{itemId}/preorders
```

```ts
type CreatePreorderRequest = {
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
```

---

## Быстро изменить дату доставки

```http
PATCH /api/preorders/{preorderId}/expected-date
```

```ts
type UpdatePreorderExpectedDateRequest = {
  expectedDate: string | null;
  reason?: string | null;
  comment?: string | null;
};
```

Ответ:

```ts
PreorderDto
```

Backend создает `PreorderEvent` типа `expected_date_changed`.

---

# 13. Purchases, Images, Notes, Links, Tags, Relations

Для связанных сущностей используются стандартные CRUD endpoints:

* `POST /api/items/{itemId}/purchases`;
* `PATCH /api/purchases/{purchaseId}`;
* `DELETE /api/purchases/{purchaseId}`;
* `POST /api/items/{itemId}/images`;
* `PATCH /api/images/{imageId}`;
* `DELETE /api/images/{imageId}`;
* `POST /api/items/{itemId}/notes`;
* `PATCH /api/notes/{noteId}`;
* `DELETE /api/notes/{noteId}`;
* `POST /api/items/{itemId}/links`;
* `DELETE /api/links/{linkId}`;
* `GET /api/tags`;
* `POST /api/tags`;
* `POST /api/items/{itemId}/relations`;
* `DELETE /api/relations/{relationId}`.

Эти endpoints не должны изменять справочные поля `Item`, если только endpoint явно не отвечает за справочную синхронизацию.

---

# 14. Синхронизация справочных данных

```http
POST /api/items/{itemId}/sync
```

```ts
type SyncItemRequest = {
  provider?: ProviderCode;
};

type SyncItemResponse = {
  item: ItemDetailsDto;
  syncedAt: string;
  updatedFields: string[];
  warnings?: ProviderWarningDto[];
};
```

Обновляются только справочные поля `Item`, справочные изображения, внешние ссылки и справочные связи.

---

# 15. Statistics API

```http
GET /api/statistics/summary
```

```ts
type StatisticsSummaryDto = {
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
```

---

# 16. Import / Export API

```http
GET /api/export/json
POST /api/import/json
```

Экспорт включает:

* `Item`;
* `ItemType`;
* `UserItem`;
* wishlist-состояние;
* покупки;
* предзаказы;
* события предзаказов;
* партии;
* внешние идентификаторы;
* изображения;
* ссылки;
* связи;
* теги.

Импорт не должен создавать дубли `ExternalReference` и `bggPlayId`.

---

# 17. Settings API

```ts
type SettingsDto = {
  language: "ru" | "en";
  theme: "light" | "dark" | "system";
  defaultItemTypeId?: string | null;
  defaultProvider?: ProviderCode | null;
  providerPriority: ProviderCode[];
  autoSyncItemReference: boolean;
  bggUsername?: string | null;
  lastBggPlaySync?: string | null;
};
```

```http
GET /api/settings
PATCH /api/settings
```

---

# 18. Сценарии MVP и endpoints

| Сценарий | Endpoints |
| -------- | --------- |
| Главная | `GET /api/statistics/summary`, `GET /api/preorders`, `GET /api/plays` |
| Коллекция | `GET /api/collection`, `GET /api/collection/{itemId}` |
| Wishlist | `GET /api/wishlist`, `GET /api/wishlist/{itemId}` |
| Поиск | `GET /api/external/search` |
| Добавить в коллекцию | `POST /api/external/import`, `POST /api/items/{itemId}/collection` |
| Добавить в wishlist | `POST /api/external/import`, `POST /api/items/{itemId}/wishlist` |
| Добавить партию | `POST /api/items/{itemId}/plays` |
| История партий | `GET /api/plays`, `PATCH /api/plays/{playId}` |
| BGG sync | `POST /api/sync/bgg/plays` |
| Изменить предзаказ | `PATCH /api/preorders/{preorderId}/expected-date` |
| Справочная синхронизация | `POST /api/items/{itemId}/sync` |
| Статистика | `GET /api/statistics/summary` |
| Backup | `GET /api/export/json`, `POST /api/import/json` |
