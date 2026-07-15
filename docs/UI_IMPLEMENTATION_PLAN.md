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

## Этап 3. P0-миграция даты коллекции

- [ ] Добавить `ownedAt`.
- [ ] Выполнить backfill для существующих owned-записей.
- [ ] Обновить collection transitions.
- [ ] Обновить backup schema/import/export.
- [ ] Переключить dashboard и collection sort на `ownedAt`.

Результат: recently added и added date используют достоверное поле, не
зависящее от обычного `updatedAt`.

## Этап 4. Основные пользовательские сценарии P0

- [ ] Главная.
- [ ] Collection cards и pagination.
- [ ] Compact collection detail.
- [ ] Общая AddPlayModal и plays history.
- [ ] Preorders и быстрое изменение точной даты.

Результат: MVP-01, 02, 07, 08, 09 и 11 работают в новом UI.

## Этап 5. P1-миграция пользовательских полей

- [ ] Добавить `favorite`.
- [ ] Добавить `expectedDatePrecision` и обновить events.
- [ ] Обновить backup schema/import/export.
- [ ] Включить favourite action и month/quarter controls.

Результат: favourite и полный preorder modal работают на постоянных данных.

## Этап 6. Wishlist и Add Item

- [ ] Новый wishlist list/detail.
- [ ] Удаление из wishlist без удаления Item.
- [ ] Preorder flow из wishlist.
- [ ] Add Item wizard.
- [ ] Personal data step для collection/preorder.

Результат: MVP-03–06 и MVP-12 работают в новом UI.

## Этап 7. Расширенная статистика и справочники

- [ ] Нормализовать taxonomy из JSON в связи.
- [ ] Расширить wishlist filters.
- [ ] Реализовать все доступные statistics panels.
- [ ] Добавить `startedAt` и play `personalRating`, если подтверждено scope.

Результат: закрыты P1-разделы `UI_LAYOUT.md` без изменения Item/UserItem принципов.

## Этап 8. Responsive, accessibility и stabilization

- [ ] Проверить 1536, 1280, 1024, 768, 430 и 390 px.
- [ ] Keyboard navigation и focus order.
- [ ] Focus trap, Escape и fixed modal footer.
- [ ] WCAG AA contrast и status labels.
- [ ] Alt text и reduced motion.
- [ ] Long titles, no image, no rating, unknown date, 100+ records.
- [ ] Удалить legacy UI после переключения всех страниц.

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
