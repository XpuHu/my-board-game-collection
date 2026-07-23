# UI_IMPLEMENTATION_PLAN.md

# Board Game Collection — план изменений для реализации UI

**Версия:** 1.0  
**Статус:** Draft  
**Назначение:** согласованный план изменений модели данных, API и frontend для реализации [UI_LAYOUT.md](UI_LAYOUT.md)

---

# 1. Исходные документы и приоритет требований

План составлен с учетом:

- [SPEC.md](SPEC.md) — пользовательские сценарии и бизнес-правила;
- [MVP.md](MVP.md) — обязательный объем первой версии и критерии готовности;
- [DATABASE.md](DATABASE.md) — целевая модель хранения;
- [ARCHITECTURE.md](ARCHITECTURE.md) — границы frontend, backend, application services и providers;
- [UI_LAYOUT.md](UI_LAYOUT.md) — визуальная структура, компоненты, адаптивность и UI-состояния.

При расхождении документов применяется следующий приоритет:

1. Бизнес-правила и разделение `Item` / `UserItem` определяет `SPEC.md`.
2. Обязательность сценария и границы первой версии определяет `MVP.md`.
3. Каноническую persistence-модель определяет `DATABASE.md`.
4. Границы модулей и ответственность сервисов определяет `ARCHITECTURE.md`.
5. `UI_LAYOUT.md` определяет представление и frontend view models, но не заменяет доменную модель.

Минимальные TypeScript-модели из `UI_LAYOUT.md` следует трактовать как модели
представления. Они не являются основанием для удаления существующих статусов,
полей или связей из доменной модели.

---

# 2. Цель изменений

Результатом работ должен стать интерфейс, который:

- реализует четыре главных потока MVP: добавить партию, изменить предзаказ,
  добавить Item в коллекцию и добавить Item в wishlist;
- сохраняет единый `Item` для коллекции, wishlist, партий и предзаказов;
- не смешивает справочные данные `Item` и пользовательские данные `UserItem`;
- получает компактные DTO для коллекции и подробные DTO для wishlist;
- не содержит захардкоженных данных страниц;
- поддерживает desktop, tablet и mobile layout из `UI_LAYOUT.md`;
- сохраняет BGG sync, JSON import/export и существующие CRUD-флоу;
- позволяет внедрять страницы поэтапно без остановки работающего MVP.

---

# 3. Зафиксированные архитектурные решения

## 3.1 Item остается единственной предметной сущностью

Не создавать отдельные таблицы или основные доменные типы для:

- базовой игры;
- дополнения;
- аксессуара;
- wishlist-игры;
- owned-игры.

Различия предметов определяются `ItemType`, а принадлежность к пользовательским
каталогам — состоянием `UserItem`.

## 3.2 UserItem остается multi-state моделью

Не заменять `owned`, `wishlist`, предзаказы и наличие партий одним UI-полем
`CollectionStatus`.

Для UI ввести вычисляемую проекцию:

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

Правила проекции:

- `owned` берется из `UserItem.owned`;
- `wishlist` берется из `UserItem.wishlist`;
- `preordered` вычисляется по наличию активного `Preorder`;
- `played` вычисляется по наличию `PlaySession`;
- `for_sale`, `sold`, `archived` определяются пользовательским lifecycle status.

Обновление состояний должно проходить через application services. UI не должен
независимо записывать противоречивые комбинации `owned`, `wishlist` и `status`.

## 3.3 Статусы предзаказа не упрощаются в базе

Сохранить канонические статусы из `DATABASE.md`:

```text
planned → ordered → paid → shipped → received
                                  ↘ cancelled
```

Вкладки и badges используют UI-группы:

```ts
type PreorderUiStatus = "active" | "delayed" | "received" | "cancelled";
```

- `planned`, `ordered`, `paid`, `shipped` отображаются как `active`;
- `received` и `cancelled` сохраняют свое значение;
- `delayed` является вычисляемым UI-состоянием активного предзаказа, срок
  которого прошел, а получение не зафиксировано.

## 3.4 UI не обращается к Prisma или providers

Поток данных остается таким:

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

Компоненты получают готовые props/view models и не вызывают API самостоятельно.
Query hooks могут работать как с REST adapter, так и с mock adapter.

## 3.5 Новые возможности не расширяют MVP неявно

В первую версию не включаются:

- несколько пользователей и профиль в sidebar;
- полноценное сравнение цен магазинов;
- уведомления о прибытии;
- рекомендации и сложный similarity engine;
- календарь релизов;
- отдельное мобильное приложение.

В нижней части sidebar используется только `powered_by_bgg.webp`, как требует
`UI_LAYOUT.md` 1.1.

---

# 4. Классификация изменений

## 4.1 Изменения без миграции базы

Из существующих данных можно получить:

- параметры игроков и времени для карточек;
- количество партий и последнюю партию;
- последний результат;
- количество изображений и пользовательских фото;
- количество связанных дополнений;
- основную обложку;
- активный предзаказ;
- стоимость покупок;
- большую часть KPI и графиков статистики;
- UI-группу статуса предзаказа;
- похожие Item на основе общих механик, категорий и диапазона игроков.

Для этого нужны новые DTO, Prisma select/aggregate queries и application
services, но не новые таблицы.

## 4.2 Обязательные расширения схемы для полного UI_LAYOUT

| Изменение | Причина | Приоритет |
|---|---|---:|
| `UserItem.ownedAt` | достоверная дата добавления в коллекцию | P0 |
| `UserItem.favorite` | favourite action на `CollectionCard` | P1 |
| `Preorder.expectedDatePrecision` | day/month/quarter/unknown в modal | P1 |
| `PlaySession.startedAt` | поле формы из `UI_LAYOUT.md` | P2 |
| `PlaySession.personalRating` | оценка конкретной партии | P2 |

Поля P1–P2 являются расширением текущего MVP. Перед миграцией соответствующие
поля должны быть добавлены в `SPEC.md` и `DATABASE.md`.

## 4.3 Отдельная задача выравнивания DATABASE.md и Prisma

`DATABASE.md` требует связи многие-ко-многим для механик, категорий,
дизайнеров, художников и издателей. Текущая Prisma-схема хранит эти значения
как JSON-массивы в `Item`.

Нормализацию выполнять отдельной миграцией после стабилизации compact/detail
DTO. Она не должна блокировать AppShell, dashboard и базовые collection cards.

---

# 5. Целевые модели данных

## DATA-01. Дата добавления в коллекцию

Добавить:

```prisma
model UserItem {
  // existing fields
  ownedAt DateTime? @map("owned_at")
}
```

Правила:

- при переходе `owned: false → true` записывать текущее время;
- обычное редактирование Item/UserItem не меняет `ownedAt`;
- при переносе из wishlist сохраняется исходный `Item`;
- существующим owned-записям установить `ownedAt = UserItem.createdAt`;
- экспорт и импорт JSON должны сохранять поле;
- `recentlyAdded` сортируется по `ownedAt`, а не по `updatedAt`.

## DATA-02. Избранное

Добавить:

```prisma
favorite Boolean @default(false)
```

Поле принадлежит `UserItem`, не обновляется provider sync и изменяется через
UserItem application service.

## DATA-03. Точность ожидаемой даты

Добавить:

```prisma
expectedDatePrecision String @default("day") @map("expected_date_precision")
```

Допустимые значения:

```text
day | month | quarter | unknown
```

Правила нормализации:

- `day`: `expectedDate` содержит точную дату;
- `month`: `expectedDate` содержит первый день месяца;
- `quarter`: `expectedDate` содержит первый день квартала;
- `unknown`: `expectedDate = null`;
- относительный срок показывается только для `day`;
- сортировка month/quarter использует нормализованную дату начала периода.

История `PreorderEvent` должна сохранять дату и precision. Формат старых событий
с одной ISO-датой должен продолжать читаться.

## DATA-04. Дополнительные поля партии

После закрытия P0–P1 добавить nullable-поля:

```prisma
startedAt      DateTime? @map("started_at")
personalRating Int?     @map("personal_rating")
```

Ограничения application layer:

- `personalRating` находится в диапазоне 1–10;
- отсутствие оценки не влияет на агрегаты средней оценки;
- `startedAt` не заменяет `playedAt`;
- BGG sync не перезаписывает локальную оценку партии.

## DATA-05. Нормализация справочников Item

Ввести справочники и join tables для:

- Mechanic;
- Category;
- Designer;
- Artist;
- Publisher.

Миграция выполняется в четыре шага:

1. Создать новые таблицы, не удаляя JSON-поля.
2. Перенести и дедуплицировать существующие значения.
3. Переключить providers, mappers, filters и backup на новые связи.
4. Удалить JSON-поля отдельной миграцией после проверки данных.

## DATA-06. Типы ItemRelation

Зафиксировать типы из `DATABASE.md` в shared enum/schema:

```text
requires
expands
compatible_with
contains
part_of
localized_version_of
alternative_to
related
```

Добавить application validation:

- parent и child не совпадают;
- комбинация parent/child/type уникальна;
- `expansionsCount` использует только согласованные типы связи.

## DATA-07. Участники и дополнения партий

Для текущего MVP сохранить `playerNames` и `usedItemIds` в JSON, как описано в
`DATABASE.md`. Добавить централизованную нормализацию имен и проверку UUID.

Отдельную нормализацию `Player`, `PlayParticipant` и `PlayUsedItem` выполнять
только при появлении требований к многопользовательскому режиму, индивидуальным
результатам или сложной аналитике. Она не входит в данный P0/P1 план.

---

# 6. API и application services

## API-01. Компактные модели представления

Ввести базовый компактный Item:

```ts
type ItemCompactDto = {
  id: string;
  title: string;
  originalTitle?: string | null;
  type: ItemTypeDto;
  year?: number | null;
  cover?: ImageDto | null;
  minPlayers?: number | null;
  maxPlayers?: number | null;
  minPlayTime?: number | null;
  maxPlayTime?: number | null;
  communityRating?: number | null;
};
```

На его основе создать отдельные DTO:

- `CollectionCardDto` — пользовательские агрегаты и быстрые действия;
- `WishlistCardDto` — справочные характеристики и price signal;
- `PlayListItemDto` — партия плюс compact Item;
- `PreorderListItemDto` — предзаказ плюс compact Item;
- `DashboardDto` — агрегаты главной;
- `StatisticsOverviewDto` и DTO отдельных графиков.

Не использовать один перегруженный DTO для коллекции и wishlist.

## API-02. Dashboard endpoint

Добавить:

```text
GET /api/dashboard
```

Ответ:

```ts
type DashboardDto = {
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
```

Ограничения выдачи соответствуют `UI_LAYOUT.md`: 4 партии, 3 предзаказа,
4 недавно добавленных Item.

## API-03. Collection query

Расширить запрос:

```ts
type CollectionQuery = {
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
  tag?: string;
  favorite?: boolean;
  sort?: "added" | "lastPlayed" | "plays" | "rating" | "title";
  direction?: "asc" | "desc";
  page?: number;
  pageSize?: 24;
};
```

Фильтрацию, сортировку и pagination перенести из JavaScript в Prisma. Для списка
не загружать все партии, покупки, изображения и предзаказы целиком; использовать
`select`, `_count`, `take: 1` и агрегаты.

## API-04. Plays query

Добавить фильтры:

- Item;
- период;
- результат;
- имя игрока;
- количество участников;
- диапазон длительности;
- использованный Item;
- источник manual/BGG;
- pagination.

Основные фильтры отражать в URL. Фильтры по JSON-полям на первом этапе может
выполнять application service, но только над ограниченной выборкой периода.

## API-05. Preorders query

Добавить фильтруемый и paginated список:

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

Метод изменения даты принимает `expectedDate`, `datePrecision`, `reason` и
`comment`, возвращает обновленный `PreorderListItemDto` и созданное событие.

## API-06. Statistics endpoints

P0 сохраняет критерии `MVP-15`:

- всего партий;
- партии за месяц;
- любимая и частые игры;
- стоимость коллекции и предзаказов.

P1 добавляет UI_LAYOUT sections:

- KPI уникальных игр, часов, средней оценки и процента побед;
- партии по месяцам;
- распределение по числу игроков;
- победы и поражения;
- активность по дням недели;
- давно не игранные игры;
- использование дополнений;
- частые игроки.

Тяжелые агрегаты выполнять в Statistics Service, а не в React-компонентах.

## API-07. Backup compatibility

При каждом изменении persistence-модели:

- повысить версию backup schema;
- экспортировать новые поля;
- принимать предыдущую версию;
- задавать безопасные default при импорте;
- не создавать дубли `ExternalReference` и `bggPlayId`;
- добавить round-trip test `export → import → export`.

---

# 7. Frontend foundation

## FE-01. Design tokens

- заменить разрозненные literal colors на переменные `UI_LAYOUT.md`;
- подключить Inter или Manrope с системным fallback;
- установить radius 12 px для Panel и 8 px для внутренних карточек;
- убрать сильные тени с базовых панелей;
- добавить semantic tokens success/warning/danger/info;
- добавить `prefers-reduced-motion`.

## FE-02. Общие компоненты

Создать или унифицировать:

- `PageHeader`;
- `Panel` и `PanelHeader`;
- `GameCover` с `sm/md/lg/card`, skeleton и fallback;
- `StatusBadge`;
- `Rating`;
- `Skeleton`, `SkeletonCard`, `SkeletonRow`;
- `EmptyState` с primary/secondary action;
- `ErrorState`;
- `OfflineBanner`;
- `Modal`, `ModalBody`, `ModalFooter`;
- `Pagination`;
- `OverflowMenu`;
- `SidebarBggAttribution`.

## FE-03. AppShell

Desktop:

- fixed sidebar 224 px и `height: 100vh`;
- fluid main content без `max-width`;
- BGG attribution внизу sidebar;
- без footer с дублирующим attribution.

Tablet:

- sidebar 72 px;
- скрытые labels;
- BGG attribution шириной до 48 px.

Mobile:

- верхний app bar;
- bottom navigation для 4–5 основных разделов;
- дополнительные пункты в menu;
- безопасные отступы под bottom navigation.

## FE-04. Frontend data layer

Ввести page-level query hooks/adapters:

```text
features/dashboard/api
features/collection/api
features/plays/api
features/preorders/api
features/wishlist/api
features/statistics/api
```

Требования:

- UI-компоненты не знают URL API;
- abort/cancellation при смене фильтра;
- единая обработка ошибок;
- optimistic update только для обратимых быстрых действий;
- mock adapter реализует тот же interface, что REST adapter;
- query state и основные вкладки синхронизируются с URL.

Не требуется выполнять одномоментный перенос всего репозитория в новую
директорию. Структуру из `UI_LAYOUT.md` вводить инкрементально по features.

---

# 8. План страниц

## PAGE-01. Главная — P0

Зависимости: `API-02`, `DATA-01`, `FE-01..04`.

- заменить локальные массивы на `DashboardDto`;
- реализовать 12-колоночную grid;
- сделать строки партий и Item кликабельными;
- открывать изменение даты из dashboard modal;
- показывать 2×2 recently added по `ownedAt`;
- построить heatmap из dated activity;
- хранить цитаты в отдельном content adapter, не внутри компонента;
- быстрые действия: партия, Item, предзаказ, фото;
- не добавлять footer и профиль в sidebar.

## PAGE-02. Коллекция — P0

Зависимости: `API-01`, `API-03`, `DATA-01`, `FE-02`.

- заменить таблицу на `CollectionCard` grid;
- добавить search, type tabs, sort и filter panel;
- добавить состояния recently played / stale / never played / preorder;
- добавить pagination по 24 и URL query;
- быстрый `+ Партия` открывает modal с выбранным Item;
- favourite включить после `DATA-02`, не блокируя остальную карточку;
- mobile: одна карточка до 419 px, две — от 420 px при достаточной ширине.

## PAGE-03. Карточка коллекции — P0/P1

Зависимости: `API-01`, collection detail DTO.

- сохранить compact owner-first hero;
- добавить URL tabs: overview, expansions, plays, photos, purchases, notes,
  relations;
- вынести длинную справочную информацию в отдельное действие/секцию;
- overview строить из готовых агрегатов;
- формы пользовательских и справочных данных оставить раздельными;
- все действия обновляют только соответствующую часть кэша.

## PAGE-04. Добавление партии — P0

Зависимости: `API-04`, общий Modal.

- одна переиспользуемая форма для главной, коллекции и `/plays`;
- сохранить MVP-поля: Item, дата, игроки, длительность, результат, счет,
  сценарий, дополнения, заметка;
- `startedAt` и `personalRating` включить после `DATA-04`;
- после сохранения обновить plays list, collection aggregates и dashboard;
- BGG-партии показывать с источником, локальное редактирование не должно
  ломать идемпотентность sync.

## PAGE-05. Предзаказы — P0/P1

Зависимости: `API-05`, `DATA-03` для полного modal.

- tabs All/Active/Received/Cancelled отражать в URL;
- строка содержит обложку, магазин, цену, даты, UI-status и actions;
- expected date визуально выделена;
- быстрый modal работает с главной и списка;
- P0 поддерживает точную/неизвестную дату;
- P1 добавляет month/quarter precision;
- сохранение создает `PreorderEvent`, закрывает modal, обновляет строку и toast.

## PAGE-06. История партий — P0/P1

Зависимости: `API-04`.

- desktop layout: filters 280 px + list;
- P0 допускает компактный period control вместо полноценного календаря;
- строка содержит дату, cover, Item, игроков, длительность, результат и score;
- mobile row превращается в card;
- фильтры и pagination синхронизируются с URL.

## PAGE-07. Wishlist — P0/P1

Зависимости: `API-01`, detail DTO, `DATA-05` для расширенных фильтров.

- list card: cover, title, rating, players, duration, mechanics, price signal;
- действия: detail, remove, add to collection, preorder;
- detail: hero, description, characteristics, gallery, taxonomy, creators,
  links, shops и similar items;
- перенос в коллекцию переиспользует Item и сохраняет пользовательские данные;
- сравнение цен не реализовывать: показывать существующие shop links и
  preorder/purchase signals.

## PAGE-08. Статистика — P0/P1

Зависимости: `API-06`.

- сначала сохранить и переверстать метрики `MVP-15`;
- затем добавить KPI и sections `UI_LAYOUT.md`;
- графики получают готовые series DTO;
- отсутствие данных об игроках, цене или длительности не ломает страницу;
- manual и BGG PlaySession учитываются одинаково.

## PAGE-09. Добавление Item — P0/P1

Зависимости: Search Service, providers, UserItem/Purchase/Preorder services.

- оформить существующий flow как wizard Search → Select → Personal data → Done;
- provider tabs управляют Search Service, не вызывают provider напрямую;
- result card показывает cover, titles, year, type, provider, players, duration,
  rating;
- personal step показывает только поля выбранного сценария;
- повторный внешний ID переиспользует Item;
- ручное создание остается fallback;
- provider failure показывается warning, не уничтожая результаты других sources.

---

# 9. Этапы внедрения

## Этап 0. Документация и контракты

- [x] Внести согласованные новые поля в `SPEC.md` и `DATABASE.md`.
- [x] Зафиксировать semantics `UserItem.status` и вычисляемых states.
- [x] Утвердить `expectedDatePrecision` и legacy event format.
- [x] Утвердить compact/detail/dashboard DTO.
- [x] Зафиксировать URL query contracts.

Результат: schema/API решения приняты до изменения migrations и UI.

## Этап 1. Безопасные backend-read изменения

- [x] Добавить compact DTO и dashboard DTO.
- [x] Перенести collection/wishlist pagination и filters в Prisma.
- [x] Расширить play/preorder queries.
- [x] Добавить недостающие статистические агрегаты из существующих данных.
- [x] Сохранить старые response contracts до переключения frontend.

Результат: новый UI можно строить без миграции и без mock-only логики.

## Этап 2. UI foundation и AppShell

- [x] Реализовать tokens и общие компоненты.
- [x] Перестроить responsive AppShell.
- [x] Перенести BGG attribution в sidebar.
- [x] Добавить skeleton/error/empty/offline patterns.
- [x] Добавить mock/REST adapters.

Результат: единая визуальная и компонентная база.

## Этап 2.1. Выравнивание контрактов и стабилизация foundation

Зависимости: этапы 0–2. Этап является обязательным gate перед миграциями и
переключением страниц на новый UI. Изменения persistence-схемы в scope не входят:
поля этапов 3 и 5 до миграции выдаются через документированные fallback-проекции.

### 2.1.1 DTO и совместимость API

- [x] Привести `CollectionCardDto`, `WishlistCardDto`, `PlayListItemDto`,
  `PreorderListItemDto`, detail DTO и `DashboardDto` к формам из `SPEC.md`.
- [x] Добавить серверный resolver `UserItem.states`; legacy-значения `status`
  нормализовать в lifecycle projection, не записывая изменения в БД.
- [x] До миграции использовать безопасные fallback: `ownedAt = createdAt` для
  owned-записей, `favorite = false`, preorder precision `day | unknown`,
  nullable play-поля — `null`.
- [x] Возвращать `usedItems` как compact DTO, Money DTO и preorder/event values
  в согласованной форме, включая чтение legacy event strings.
- [x] Сохранить старые response contracts через явный legacy adapter/view до
  переключения соответствующей страницы; не смешивать legacy и target DTO.

### 2.1.2 Query contracts и границы выборок

- [x] Исправить инвариант wishlist: list/detail используют
  `wishlist = true AND owned = false`.
- [x] Привести названия, repeatable-параметры, defaults, sort/direction и
  pagination к разделу 10 `SPEC.md`; старые имена временно принимать как aliases.
- [x] Валидировать enum, диапазоны, даты и конфликтующие фильтры; возвращать 400,
  а не молча игнорировать некорректные значения.
- [x] Перенести фильтры collection по числу и последней дате партий в SQL/Prisma;
  не строить глобальные массивы ID в application memory.
- [x] Ограничить временные JSON-фильтры taxonomy/plays предварительной DB-выборкой;
  player/used-item filters выполнять только для явно заданного периода.
- [x] Проверить стабильную сортировку и корректный `total` на наборах 0, 1, 24,
  25 и 100+ записей.

### 2.1.3 AppShell и visual foundation

- [x] Оставить `powered_by_bgg.webp` только в sidebar; удалить attribution из
  collection/wishlist detail и исключить дублирующий footer.
- [x] Убрать `max-width` из основного desktop layout; ограничения ширины оставлять
  только у форм, modal и читаемых текстовых блоков.
- [x] Убрать literal colors и сильные тени из AppShell/shared UI. Page-specific
  legacy literals удалять при миграции страниц, начиная с dashboard этапа 4.

  Автоматические проверки safe-area, focus styles и единственного attribution
  добавлены; интерактивная viewport-проверка ожидает доступного browser runtime.

### 2.1.4 Frontend data layer

- [x] Подключить page-level REST adapters и `useAdapterQuery` минимум к dashboard
  и collection read flow; React-компоненты не импортируют URL или raw fetch.
- [x] Реализовать abort/ignore stale response при смене filter/page и единое
  преобразование API errors в page state.
- [x] Синхронизировать collection filter/sort/page с URL и восстановлением через
  Back/Forward; изменение фильтра сбрасывает `page=1`.
- [x] Добавить реальные mock fixtures для 0, 1, 4–8 и 100+ записей; mock и REST
  adapters должны проходить один contract suite.

### 2.1.5 Тесты и критерии выхода

- [x] Добавить contract tests target response для dashboard и target/legacy response
  для collection, wishlist, plays и preorders, включая 400 для невалидных query.
- [x] Добавить regression test: owned Item отсутствует в wishlist response.
- [x] Добавить тесты SQL pagination/filter/sort и ограниченных JSON candidates.
- [x] Добавить tests adapters/query hook: cancellation, stale response, retry,
  empty/error/offline и URL restoration.
- [x] Зафиксировать отсутствие BGG attribution вне AppShell статическим тестом.
- [x] Выполнить `lint`, `typecheck`, tests и production build.

Результат: target DTO и query contracts совпадают с `SPEC.md`, legacy API остается
работоспособным, foundation проверен вертикальным dashboard/collection срезом, а
этапы 3–4 не наследуют расхождения контрактов и заведомо дорогие read queries.

## Этап 2.2. Устранение расхождений foundation и изоляция legacy

Зависимости: этап 2.1. Этап является обязательным corrective gate перед этапом 3:
доменные команды, target DTO и тестовые критерии должны соответствовать `SPEC.md`,
а legacy-код — остаться только на явно обозначенной границе совместимости.

### 2.2.1 Инварианты каталога и атомарные переходы

- [x] Вынести вычисление и проверку итогового состояния `UserItem` в единый
  application-level transition/validator; запретить `owned = true` одновременно с
  `wishlist = true` и `for_sale` при `owned = false` во всех командах записи.
- [x] Исправить добавление в коллекцию и переход предзаказа в `received`: атомарно
  устанавливать `owned = true`, `wishlist = false` и актуальный lifecycle status;
  существующие пользовательские данные и история должны сохраняться.
- [x] Для попытки добавить уже owned Item в wishlist возвращать `409 Conflict` без
  изменения записи; обычное добавление в wishlist устанавливает `owned = false`,
  `wishlist = true` и канонический lifecycle status.
- [x] Generic update должен загружать текущее состояние, объединять его с patch,
  валидировать итоговую комбинацию и только затем выполнять запись; изменение
  флагов, lifecycle status и связанных данных проводить в одной транзакции.
- [x] Заменить route-тест, допускающий `owned = true` и `wishlist = true`, матрицей
  допустимых и запрещённых переходов для collection, wishlist, preorder received,
  `sold`, `archived`, `for_sale` и generic update.

### 2.2.2 Семантика срока и событий предзаказа

- [x] Вынести вычисление `PreorderUiStatus` в precision-aware helper: `day`
  становится delayed только после завершения календарного дня, `unknown` никогда
  не становится delayed; заложить те же правила границ для `month` и `quarter`.
- [x] Использовать единое правило календаря/timezone при сравнении даты на сервере
  и в UI; не сравнивать date-only значение с текущим временем напрямую.
- [x] Обновление ожидаемой даты и создание `expected_date_changed` выполнять в
  одной транзакции, возвращая созданный `PreorderEvent`, а не повторно запрашивая
  последнее событие через `findFirst`.
- [x] Target и legacy response строить из результата одной команды; добавить
  канонический `UpdatePreorderExpectedDateResponse` и исключить возможность вернуть
  событие параллельного запроса.

### 2.2.3 Разделение target и legacy-контрактов

- [x] Привести канонические `ImageDto`, `ExternalReferenceDto`, `LinkDto`,
  `ItemRelationDto`, `PurchaseDto`, `NoteDto` и preorder response types к точным
  формам из `SPEC.md`; удалить target-обходы через `Omit`, inline-типы и
  `PurchaseViewDto`.
- [x] Вынести legacy DTO, schemas, client methods и response mappers в отдельные
  каталоги `src/shared/api/legacy/` и `src/server/api/legacy/`; legacy-типы должны
  иметь явный префикс `Legacy` и не экспортироваться из target barrel-файлов.
- [x] Оставить актуальные DTO, schemas, adapters и HTTP primitives в каноническом
  `src/shared/api/`; старые DTO, client methods и mappers доступны только через
  явные imports из `legacy/` и не экспортируются target barrel-файлами.
- [x] Переключить foundation list flows dashboard, collection, wishlist, plays и
  preorders на target adapters. `view=legacy` и legacy client разрешить только для
  явно обозначенных ещё не мигрированных detail/mutation consumers; target features
  не импортируют `legacy/`.
- [x] Зафиксировать `/api/dashboard` как target-only endpoint, поскольку у него нет
  legacy consumer; для collection, wishlist, plays и preorders сохранить отдельные
  legacy adapters до явного удаления совместимости.
- [x] Удалить legacy aliases и дублирующие преобразования из target DTO и
  foundation adapters; добавить статическую проверку направления зависимостей:
  target barrel и target features не зависят от `legacy/`.

### 2.2.4 Regression, contract и query-hook tests

- [x] Добавить application и route regression tests для всех инвариантов каталога,
  включая сохранение данных при переходах и отсутствие owned Item в wishlist.
- [x] Добавить тесты preorder status на момент до, внутри и после календарной
  границы для `day`, `month`, `quarter` и `unknown`, а также тест параллельных
  обновлений ожидаемой даты с проверкой соответствия возвращённого события.
- [x] Разделить contract suites на target и legacy: dashboard проверять только как
  target, а collection, wishlist, plays и preorders — target плюс изолированный
  legacy response; сохранить проверки `400`/`409` для ошибочных запросов и команд.
- [x] Протестировать непосредственно `useAdapterQuery`, а не только transport
  adapter: abort при unmount/смене params, игнорирование stale response, retry,
  empty/error/offline states и восстановление URL через Back/Forward.
- [x] Выполнить `lint`, `typecheck`, полный набор tests и production build; этап
  закрывать только после удаления ложных `[x]` и подтверждения всех критериев 2.2.

Результат: все команды сохраняют доменные инварианты, preorder status и event
response детерминированы, актуальный код использует только target-контракты, а
legacy физически изолирован и доступен исключительно как временный API adapter.

## Этап 3. P0-миграция даты коллекции

- [x] Добавить `ownedAt`.
- [x] Выполнить backfill для существующих owned-записей.
- [x] Обновить collection transitions.
- [x] Обновить backup schema/import/export.
- [x] Переключить dashboard и collection sort на `ownedAt`.

Результат: recently added и added date используют достоверное поле, не
зависящее от обычного `updatedAt`.

## Этап 4. Основные пользовательские сценарии P0

- [x] Главная.
- [x] Collection cards и pagination.
- [x] Compact collection detail.
- [x] Общая AddPlayModal и plays history.
- [x] Preorders и быстрое изменение точной даты.

Результат: MVP-01, 02, 07, 08, 09 и 11 работают в новом UI.

## Этап 5. P1-миграция пользовательских полей

- [x] Добавить `favorite`.
- [x] Добавить `expectedDatePrecision` и обновить events.
- [x] Обновить backup schema/import/export.
- [x] Включить favourite action и month/quarter controls.

Результат: favourite и полный preorder modal работают на постоянных данных.

## Этап 6. Wishlist и Add Item

- [x] Новый wishlist list/detail.
- [x] Удаление из wishlist без удаления Item.
- [x] Preorder flow из wishlist.
- [x] Add Item wizard.
- [x] Personal data step для collection/preorder.

Результат: MVP-03–06 и MVP-12 работают в новом UI.

## Этап 7. Расширенная статистика и справочники

- [x] Нормализовать taxonomy из JSON в связи.
- [x] Расширить wishlist filters.
- [x] Реализовать все доступные statistics panels.
- [x] Добавить `startedAt` и play `personalRating`, если подтверждено scope.

Результат: закрыты P1-разделы `UI_LAYOUT.md` без изменения Item/UserItem принципов.

## Этап 8. Responsive, accessibility и stabilization

- [ ] Проверить 1536, 1280, 1024, 768, 430 и 390 px.
- [x] Keyboard navigation и focus order.
- [x] Focus trap, Escape и fixed modal footer.
- [x] WCAG AA contrast и status labels.
- [x] Alt text и reduced motion.
- [x] Long titles, no image, no rating, unknown date, 100+ records.
- [x] Удалить legacy UI после переключения всех страниц.

---

# 10. Тестирование

## 10.1 Database и migrations

- backfill `ownedAt`;
- default `favorite = false`;
- legacy и новые preorder dates;
- повторный запуск миграций на копии существующей SQLite БД;
- сохранность BGG IDs и external references.

## 10.2 Application services

- Item не дублируется между collection/wishlist;
- provider sync не меняет UserItem;
- BGG play sync остается идемпотентным;
- collection filters/sorts/pagination;
- dashboard aggregates;
- preorder event с датой и precision;
- статистика учитывает manual и BGG партии.

## 10.3 API contracts

- schema validation query/body;
- compact и detail DTO snapshots/contracts;
- 400/404/409 errors;
- backup backward compatibility.

## 10.4 Frontend

- component tests shared UI;
- loading/empty/error/offline для каждой страницы;
- URL filters, tabs и pagination;
- optimistic favorite и rollback;
- modal create/edit flows;
- accessibility tests;
- визуальные screenshots ключевых viewport;
- end-to-end четыре главных MVP-флоу.

На каждом этапе обязательны:

```text
npm run lint
npm run typecheck
npm test
npm run build
```

---

# 11. Риски и меры

| Риск | Мера |
|---|---|
| UI-модели заменят доменную multi-state модель | отдельные view DTO и state resolver |
| Миграция дат исказит recently added | явный backfill и документированная семантика `ownedAt` |
| Новый UI сломает BGG sync | не менять provider boundary, добавить regression tests |
| Pagination останется клиентской | перенести where/order/skip/take в application service до UI |
| Нормализация taxonomy потеряет значения | dual-write/read и удаление JSON отдельной миграцией |
| Backup перестанет импортироваться | versioned schema и backward-compatible importer |
| P1-функции раздуют MVP | отдельные этапы и feature acceptance после P0 |
| Mobile polish отложится до конца | проверять responsive на каждой странице, финальный этап — аудит |

---

# 12. Definition of Done всего плана

План считается выполненным, когда:

- четыре основных MVP-флоу проходят end-to-end;
- collection и wishlist используют один Item без дублей;
- справочная синхронизация не меняет пользовательские данные;
- BGG sync остается идемпотентным;
- главная не содержит локальных mock-массивов в production adapter;
- collection использует dashboard cards и server-side pagination по 24;
- основные filters/tabs/page отражаются в URL;
- preorder date change создает историю;
- все страницы имеют skeleton, empty и error states;
- AppShell соответствует desktop/tablet/mobile требованиям;
- BGG attribution находится только в sidebar;
- keyboard navigation и контраст проходят accessibility audit;
- JSON backup старой версии импортируется;
- lint, typecheck, tests и production build проходят;
- `SPEC.md`, `DATABASE.md`, `MVP.md`, `ARCHITECTURE.md` и `UI_LAYOUT.md`
  не противоречат реализованным контрактам.
