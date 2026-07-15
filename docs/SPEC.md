# SPEC.md

# Board Game Collection — продуктовые и API-контракты

**Версия:** 3.0
**Статус:** Approved for implementation
**Дата фиксации:** 2026-07-15
**Связанный план:** [UI_IMPLEMENTATION_PLAN.md](UI_IMPLEMENTATION_PLAN.md), этап 0

---

# 1. Назначение и границы

Board Game Collection — однопользовательское веб-приложение для управления
настольными играми, wishlist, партиями, покупками и предзаказами.

Документ фиксирует продуктовые правила и целевые контракты API до изменения
Prisma-схемы и UI. Persistence-модель описана в [DATABASE.md](DATABASE.md).
Текущая реализация может временно отличаться от целевого контракта; такие
отличия устраняются этапами 1–8 плана внедрения.

Основные сценарии первой версии:

1. Добавить партию.
2. Изменить предзаказ, прежде всего ожидаемую дату.
3. Добавить Item в коллекцию.
4. Добавить Item в wishlist.

В первую версию не входят многопользовательский режим, полноценное сравнение
цен, уведомления, календарь релизов и сложная рекомендательная система.

---

# 2. Доменная модель

## 2.1 Item

`Item` — единственная основная сущность для справочного объекта. Ею может быть
базовая игра, дополнение, промо, аксессуар, органайзер, компонент или другой
связанный объект. Коллекция и wishlist не создают копии `Item`.

Справочные поля `Item` могут обновляться providers и ручным вводом:

- название, оригинальное название и описание;
- тип, год, параметры игроков, времени и возраста;
- сложность и рейтинг сообщества;
- механики, категории, создатели и издатели;
- справочные изображения, ссылки, внешние идентификаторы и связи.

Системные коды типов:

```text
base_game | expansion | promo | accessory | organizer | component
miniature | playmat | sleeves | dice | other
```

## 2.2 UserItem

`UserItem` — пользовательское состояние одного `Item`. Для локального MVP
существует не более одного `UserItem` на `Item`.

К пользовательским данным относятся:

- принадлежность к коллекции и wishlist;
- дата добавления в коллекцию и признак избранного;
- lifecycle-статус;
- личная оценка, место хранения и заметки;
- уровень интереса и заметки о решении;
- покупки, предзаказы, партии, пользовательские изображения и теги.

Provider sync никогда не изменяет пользовательские данные.

## 2.3 Два каталога

«Моя коллекция» — выборка `UserItem.owned = true`. Она компактна и
ориентирована на действия владельца. Главное действие — «Добавить партию».

Wishlist — выборка `UserItem.wishlist = true AND UserItem.owned = false`. Она
показывает больше справочных данных и помогает принять решение. Главные
действия — добавить в коллекцию и оформить предзаказ.

При переносе из wishlist в коллекцию используется тот же `Item`, выставляется
`owned = true`, сбрасывается `wishlist = false` и устанавливается `ownedAt`,
если его ещё нет. Внешние идентификаторы, история и пользовательские данные
сохраняются.

---

# 3. Сохранённое и вычисляемое состояние UserItem

## 3.1 Lifecycle-статус

`UserItem.status` хранит только жизненный цикл пользовательской записи:

```ts
type UserItemLifecycleStatus =
  | "active"
  | "for_sale"
  | "sold"
  | "archived";
```

Семантика:

- `active` — обычная активная запись; это значение по умолчанию;
- `for_sale` — owned-объект выставлен пользователем на продажу;
- `sold` — объект продан и больше не считается owned;
- `archived` — запись скрыта из основных каталогов, но история сохранена.

Значения `owned`, `wishlist`, `preordered` и `played` не являются
lifecycle-статусами и после миграции не записываются в `UserItem.status`.

## 3.2 Вычисляемые состояния

API возвращает множество состояний:

```ts
type UserItemState =
  | "owned"
  | "wishlist"
  | "preordered"
  | "played"
  | "for_sale"
  | "sold"
  | "archived";
```

Правила resolver-а:

- `owned` добавляется при `UserItem.owned = true`;
- `wishlist` добавляется при `UserItem.wishlist = true`;
- `preordered` добавляется при наличии предзаказа со статусом `planned`,
  `ordered`, `paid` или `shipped`;
- `played` добавляется при наличии хотя бы одной `PlaySession`;
- `for_sale`, `sold`, `archived` проецируются из `UserItem.status`;
- `active` не добавляется в `states`, потому что означает отсутствие
  специального lifecycle-badge.

`states` вычисляется на сервере. UI не собирает его самостоятельно и не пишет
вычисляемые состояния обратно в базу.

## 3.3 Инварианты и переходы

- `owned` и `wishlist` не могут одновременно быть `true` после успешной
  команды изменения каталога.
- `for_sale` допустим только при `owned = true`.
- переход в `sold` устанавливает `owned = false` и `wishlist = false`;
- переход в `archived` исключает запись из коллекции и wishlist без удаления
  связанной истории;
- добавление в коллекцию переводит `sold`/`archived` обратно в `active`;
- активный предзаказ или история партий могут существовать при `owned = false`;
- удаление из wishlist не удаляет `Item`, если у него есть история, предзаказ,
  покупка или иная пользовательская связь.

Все переходы выполняются application services. Generic update пользовательских
полей обязан валидировать итоговую комбинацию, а команды добавления/удаления из
каталогов применяют инварианты атомарно.

## 3.4 Совместимость legacy-статусов

До миграции встречаются `owned`, `wishlist`, `preordered` и `played` в поле
`status`. Они читаются как `active`; соответствующие состояния определяются
только флагами и связями. `for_sale`, `sold`, `archived` сохраняют смысл.

Backfill:

```text
owned | wishlist | preordered | played → active
for_sale | sold | archived             → без изменения
неизвестное значение                   → active + migration warning
```

---

# 4. Новые пользовательские поля

## 4.1 Дата добавления в коллекцию

`UserItem.ownedAt: ISODateTime | null` — момент первого актуального перехода
`owned: false → true`.

- обычное редактирование не меняет `ownedAt`;
- при снятии `owned` поле сохраняется для истории;
- повторное добавление восстанавливает прежнее значение, если оно существует;
- для существующих owned-записей backfill использует `UserItem.createdAt`;
- recently added и сортировка `added` используют `ownedAt`, не `updatedAt`;
- JSON backup обязан сохранять поле.

## 4.2 Избранное

`UserItem.favorite: boolean` имеет default `false`, изменяется только
пользователем через UserItem service и не затрагивается provider sync.

## 4.3 Дополнительные поля партии

После включения соответствующего этапа `PlaySession` получает:

```ts
startedAt?: ISODateTime | null;
personalRating?: number | null; // целое 1..10
```

`startedAt` — необязательное точное время начала и не заменяет обязательную
дату `playedAt`. BGG sync не перезаписывает локальную `personalRating`.

---

# 5. Предзаказы

## 5.1 Канонические статусы

```ts
type PreorderStatus =
  | "planned"
  | "ordered"
  | "paid"
  | "shipped"
  | "received"
  | "cancelled";
```

Основной поток:

```text
planned → ordered → paid → shipped → received
                                  ↘ cancelled
```

`cancelled` допустим из любого активного статуса. Возврат из `received` или
`cancelled` в активный статус требует явной пользовательской команды и события
`status_changed`.

## 5.2 Точность ожидаемой даты

```ts
type ExpectedDatePrecision = "day" | "month" | "quarter" | "unknown";
```

Пара `expectedDate` + `expectedDatePrecision` является единым значением:

| Precision | Хранимое значение `expectedDate` | Отображение |
|---|---|---|
| `day` | точная дата | день, месяц, год; допустим относительный срок |
| `month` | первый день месяца | месяц и год |
| `quarter` | первый день квартала | квартал и год |
| `unknown` | `null` | «Дата неизвестна» |

Application service нормализует month/quarter до начала периода. Для `day`
время нормализуется к началу календарного дня в принятой сервером временной
зоне. API передаёт дату как ISO 8601 и не выводит precision из формата строки.

## 5.3 UI-статус предзаказа

```ts
type PreorderUiStatus = "active" | "delayed" | "received" | "cancelled";
```

- `received` и `cancelled` определяются каноническим статусом;
- остальные канонические статусы дают `active`, пока срок не прошёл;
- `delayed` вычисляется только для активного предзаказа: для `day` прошёл день,
  для `month` — последний день месяца, для `quarter` — последний день квартала;
- `unknown` не бывает delayed;
- относительный текст «через N дней»/«N дней назад» используется только для
  `day`.

## 5.4 Событие изменения ожидаемой даты

Новая запись `expected_date_changed` сохраняет дату и precision вместе в
`oldValue`/`newValue` как JSON:

```ts
type ExpectedDateEventValue = {
  expectedDate: string | null;
  expectedDatePrecision: ExpectedDatePrecision;
};
```

Пример сериализованного значения:

```json
{"expectedDate":"2026-10-01T00:00:00.000Z","expectedDatePrecision":"month"}
```

Legacy-значение является ISO-строкой без JSON. Reader обязан поддерживать:

1. JSON-объект нового формата;
2. ISO-строку старого формата как `{ expectedDate: value,
   expectedDatePrecision: "day" }`;
3. `null` как `{ expectedDate: null, expectedDatePrecision: "unknown" }`.

Новый writer записывает только JSON-формат. API изменения даты принимает
`expectedDate`, `expectedDatePrecision`, `reason`, `comment` и возвращает
обновлённый предзаказ вместе с созданным событием.

---

# 6. Партии, покупки и синхронизация

`PlaySession` хранит игру, дату, необязательное время начала, игроков,
длительность, результат, счёт, сценарий, использованные Item, заметку, источник
и локальную оценку партии.

- `playerNames` — нормализованный массив непустых имён;
- `usedItemIds` — уникальный массив существующих UUID без основного `itemId`;
- `bggPlayId` уникален, если задан;
- повторный BGG import идемпотентен;
- локально изменённые поля не перезаписываются без явного merge-правила;
- manual- и BGG-партии одинаково участвуют в статистике.

Для одного `Item` допустимо несколько `Purchase` и `Preorder`. Денежные суммы
в API всегда передаются числом вместе с трёхбуквенным кодом валюты; суммы разных
валют не складываются без отдельного правила конвертации.

---

# 7. Общие правила API

- Идентификаторы — UUID strings.
- DateTime — ISO 8601 UTC strings; календарные query-даты — `YYYY-MM-DD`.
- Nullable-поля возвращаются явно как `null`; обязательные массивы — как `[]`.
- Деньги возвращаются как `{ amount: number, currency: string }`.
- Списки используют общий envelope `PaginatedDto<T>`.
- Неизвестный query-параметр игнорируется UI adapter-ом, но API валидирует
  известные параметры и возвращает `400` для неверного значения.
- Отсутствующая запись возвращает `404`, конфликт инвариантов — `409`.

```ts
type PaginatedDto<T> = {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

type MoneyDto = { amount: number; currency: string };

type ItemTypeDto = {
  id: string;
  code: ItemTypeCode;
  name: string;
};

type ImageCompactDto = {
  id: string;
  url?: string | null;
  path?: string | null;
  alt: string;
};
```

---

# 8. Утверждённые DTO

## 8.1 ItemCompactDto

```ts
type ItemCompactDto = {
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
```

Compact DTO не содержит description, полные taxonomy-массивы, все изображения,
покупки, партии или предзаказы.

Общие вложенные DTO detail-контрактов:

```ts
type TagDto = {
  id: string;
  name: string;
  color?: string | null;
};

type ImageDto = {
  id: string;
  type: "reference" | "user";
  provider?: string | null;
  url?: string | null;
  path?: string | null;
  caption?: string | null;
  sortOrder: number;
};

type ExternalReferenceDto = {
  id: string;
  provider: string;
  externalId: string;
  url?: string | null;
  lastSync?: string | null;
};

type LinkDto = {
  id: string;
  type: "official" | "rules" | "kickstarter" | "gamefound" | "youtube" |
    "review" | "publisher" | "shop" | "other";
  url: string;
  title?: string | null;
};

type ItemRelationDto = {
  id: string;
  direction: "parent" | "child";
  relationType: "requires" | "expands" | "compatible_with" | "contains" |
    "part_of" | "localized_version_of" | "alternative_to" | "related";
  relatedItem: ItemCompactDto;
  comment?: string | null;
};

type PurchaseDto = {
  id: string;
  shop: string;
  price: MoneyDto;
  deliveryCost?: MoneyDto | null;
  discount?: MoneyDto | null;
  totalPrice: MoneyDto;
  purchaseDate?: string | null;
  comment?: string | null;
};

type NoteDto = {
  id: string;
  title?: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
};
```

## 8.2 CollectionCardDto

```ts
type CollectionCardDto = {
  item: ItemCompactDto;
  userItem: {
    states: UserItemState[];
    ownedAt: string;
    favorite: boolean;
    personalRating?: number | null;
    location?: string | null;
    tags: { id: string; name: string; color?: string | null }[];
  };
  plays: {
    count: number;
    lastPlayedAt?: string | null;
    lastResult?: "win" | "loss" | "score" | "unknown" | null;
  };
  expansionsCount: number;
  imagesCount: number;
  activePreorder?: PreorderSummaryDto | null;
  purchaseTotal?: MoneyDto | null;
};
```

`ownedAt` обязателен для записи, попавшей в collection response. Во время
переходной миграции mapper использует документированный backfill fallback.

## 8.3 WishlistCardDto

```ts
type WishlistCardDto = {
  item: ItemCompactDto & {
    minAge?: number | null;
    complexity?: number | null;
  };
  userItem: {
    states: UserItemState[];
    interestLevel?: number | null;
    decisionNotes?: string | null;
    tags: { id: string; name: string; color?: string | null }[];
  };
  mechanics: string[];
  categories: string[];
  priceSignal?: MoneyDto | null;
  activePreorder?: PreorderSummaryDto | null;
};
```

Collection и wishlist используют разные DTO; единый перегруженный list DTO не
допускается.

## 8.4 PlayListItemDto

```ts
type PlayListItemDto = {
  id: string;
  item: ItemCompactDto;
  playedAt: string;
  startedAt?: string | null;
  playersCount?: number | null;
  durationMinutes?: number | null;
  result?: "win" | "loss" | "score" | "unknown" | null;
  score?: string | null;
  scenario?: string | null;
  playerNames: string[];
  usedItems: ItemCompactDto[];
  personalRating?: number | null;
  notes?: string | null;
  source: "manual" | "boardgamegeek";
};
```

## 8.5 PreorderListItemDto

```ts
type PreorderSummaryDto = {
  id: string;
  status: PreorderStatus;
  uiStatus: PreorderUiStatus;
  expectedDate?: string | null;
  expectedDatePrecision: ExpectedDatePrecision;
};

type PreorderListItemDto = PreorderSummaryDto & {
  item: ItemCompactDto;
  shop: string;
  price: MoneyDto;
  orderDate?: string | null;
  receivedDate?: string | null;
  trackingNumber?: string | null;
  comment?: string | null;
  updatedAt: string;
};

type PreorderExpectedDateChangedEventDto = {
  id: string;
  type: "expected_date_changed";
  oldValue?: ExpectedDateEventValue | null;
  newValue?: ExpectedDateEventValue | null;
  reason?: string | null;
  comment?: string | null;
  createdAt: string;
  legacyFormat: boolean;
};

type PreorderStatusChangedEventDto = {
  id: string;
  type: "status_changed";
  oldValue?: PreorderStatus | null;
  newValue?: PreorderStatus | null;
  reason?: string | null;
  comment?: string | null;
  createdAt: string;
};

type PreorderEventDto =
  | PreorderExpectedDateChangedEventDto
  | PreorderStatusChangedEventDto;

type UpdatePreorderExpectedDateResponse = {
  preorder: PreorderListItemDto;
  event: PreorderEventDto;
};
```

## 8.6 Detail DTO

```ts
type ItemReferenceDetailDto = ItemCompactDto & {
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

type UserItemDetailDto = {
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

type ItemDetailDto = {
  item: ItemReferenceDetailDto;
  userItem?: UserItemDetailDto | null;
};

type CollectionItemDetailDto = ItemDetailDto & {
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

type WishlistItemDetailDto = ItemDetailDto & {
  userItem: UserItemDetailDto;
  shopLinks: LinkDto[];
  videos: LinkDto[];
  similarItems: ItemCompactDto[];
  primaryActions: ("add_to_collection" | "create_preorder")[];
};
```

`ImageDto`, `ExternalReferenceDto`, `LinkDto`, `ItemRelationDto`, `TagDto`,
`PurchaseDto` и `NoteDto` являются shared DTO и не содержат Prisma-типов.
Collection detail остаётся owner-first; длинная справка находится в
`item` и может загружаться отдельной секцией.

## 8.7 DashboardDto

```ts
type DashboardDto = {
  recentPlays: PlayListItemDto[];             // максимум 4
  upcomingPreorders: PreorderListItemDto[];   // максимум 3
  recentlyAdded: CollectionCardDto[];         // максимум 4
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
```

`GET /api/dashboard` возвращает один `DashboardDto`. Все агрегаты вычисляются
application service; React-компоненты их не достраивают.

---

# 9. Целевые read endpoints

```text
GET /api/dashboard                 → DashboardDto
GET /api/collection                → PaginatedDto<CollectionCardDto>
GET /api/collection/:itemId        → CollectionItemDetailDto
GET /api/wishlist                  → PaginatedDto<WishlistCardDto>
GET /api/wishlist/:itemId          → WishlistItemDetailDto
GET /api/plays                     → PaginatedDto<PlayListItemDto>
GET /api/preorders                 → PaginatedDto<PreorderListItemDto>
```

List endpoints выполняют фильтрацию, сортировку, pagination и агрегаты на
сервере. Они не загружают полные дочерние коллекции для последующей обработки в
браузере.

---

# 10. URL query contracts

## 10.1 Общие правила сериализации

- ключи и enum-значения чувствительны к регистру и записываются lowercase;
- пробелы кодируются стандартным `URLSearchParams`;
- boolean записывается как `true` или `false`;
- даты фильтров записываются как `YYYY-MM-DD`;
- массивы используют повторяемый ключ, например `mechanic=deck-building&mechanic=drafting`;
- пустые значения и значения по умолчанию удаляются из URL;
- изменение любого фильтра или sort сбрасывает `page=1`;
- `page` и `pageSize` — положительные целые;
- browser Back/Forward полностью восстанавливает состояние страницы.

## 10.2 Collection

Путь: `/collection` и `GET /api/collection`.

```ts
type CollectionQuery = {
  q?: string;
  type?: ItemTypeCode;
  personalRating?: number; // 1..10
  playsMin?: number;
  playsMax?: number;
  lastPlayedFrom?: string;
  lastPlayedTo?: string;
  hasExpansions?: boolean;
  hasActivePreorder?: boolean;
  neverPlayed?: boolean;
  notPlayedSince?: string;
  location?: string;
  tag?: string[]; // repeatable tag id
  favorite?: boolean;
  sort?: "added" | "lastPlayed" | "plays" | "rating" | "title";
  direction?: "asc" | "desc";
  page?: number;
  pageSize?: 24;
};
```

Defaults: `sort=added`, `direction=desc`, `page=1`, `pageSize=24`.
`neverPlayed=true` и фильтры последней партии взаимоисключающие; конфликт даёт
`400` в API и снимается последним действием в UI.

## 10.3 Wishlist

Путь: `/wishlist` и `GET /api/wishlist`.

```ts
type WishlistQuery = {
  q?: string;
  type?: ItemTypeCode;
  ratingMin?: number;
  players?: number;
  playTimeMax?: number;
  complexityMin?: number;
  complexityMax?: number;
  mechanic?: string[]; // repeatable id/code
  category?: string[]; // repeatable id/code
  hasLocalization?: boolean;
  hasPrice?: boolean;
  interestLevel?: number; // 1..5
  sort?: "interest" | "rating" | "year" | "title" | "updated";
  direction?: "asc" | "desc";
  page?: number;
  pageSize?: 24;
};
```

Defaults: `sort=interest`, `direction=desc`, `page=1`, `pageSize=24`.

## 10.4 Plays

Путь: `/plays` и `GET /api/plays`.

```ts
type PlaysQuery = {
  itemId?: string;
  from?: string;
  to?: string;
  result?: "win" | "loss" | "score" | "unknown";
  player?: string;
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
```

Defaults: `sort=playedAt`, `direction=desc`, `page=1`, `pageSize=24`;
максимальный `pageSize` — 100. JSON-фильтры допустимо временно применять в
application service только к ограниченной выборке заданного периода.

## 10.5 Preorders

Путь: `/preorders` и `GET /api/preorders`.

```ts
type PreorderQuery = {
  group?: "all" | "active" | "received" | "cancelled";
  itemId?: string;
  expectedFrom?: string;
  expectedTo?: string;
  page?: number;
  pageSize?: number;
};
```

Defaults: `group=all`, `page=1`, `pageSize=24`; максимальный `pageSize` — 100.
`active` включает UI-группы `active` и `delayed`.

## 10.6 Detail tabs и statistics

Collection detail `/collection/:itemId`:

```ts
type CollectionDetailQuery = {
  tab?: "overview" | "expansions" | "plays" | "photos" | "purchases" |
    "notes" | "relations";
};
```

Default `tab=overview`. Wishlist detail использует `tab=overview | photos |
relations | links`; default также `overview`.

Statistics сохраняет период в URL:

```ts
type StatisticsQuery = {
  period?: "month" | "quarter" | "year" | "all" | "custom";
  from?: string;
  to?: string;
};
```

`from` и `to` обязательны только при `period=custom`.

---

# 11. Импорт, экспорт и совместимость

JSON backup включает `Item`, `UserItem`, партии, покупки, предзаказы и события,
изображения, ссылки, связи, заметки, теги и внешние идентификаторы.

Следующая версия backup schema обязана добавить:

- `UserItem.ownedAt` и `UserItem.favorite`;
- lifecycle-семантику `UserItem.status`;
- `Preorder.expectedDatePrecision` и новый event value format;
- `PlaySession.startedAt` и `PlaySession.personalRating` после их миграции.

Importer принимает предыдущую версию и применяет defaults из разделов 3–5.
Обязателен round-trip test `export → import → export`; импорт не создаёт дубли
`ExternalReference`, `bggPlayId` и `ItemRelation`.

---

# 12. Архитектурные требования

Поток данных:

```text
Page / Feature
    ↓
frontend query hook / adapter
    ↓
REST API
    ↓
Application Service
    ↓
Prisma / Provider abstraction
```

UI-компоненты получают готовые props/view models, не импортируют Prisma-типы и
не обращаются к providers. Mock и REST adapters реализуют один интерфейс.

Справочные обновления не изменяют `UserItem`. Синхронизация BGG остаётся
идемпотентной. Collection и wishlist всегда используют один `Item`.

---

# 13. Критерии готовности этапа 0

- Новые поля и их backfill-семантика зафиксированы.
- `UserItem.status` отделён от вычисляемых `states`.
- Точность ожидаемой даты и legacy event reader утверждены.
- Compact, detail и dashboard DTO имеют однозначные формы.
- URL-фильтры, вкладки, sort и pagination имеют стабильные имена и defaults.
- Все изменения migration/API/UI должны ссылаться на эти контракты.
