# DATABASE.md

# Board Game Collection — целевая persistence-модель

**Версия:** 4.0
**Статус:** Approved for implementation
**Дата фиксации:** 2026-07-15
**Связанный план:** [UI_IMPLEMENTATION_PLAN.md](UI_IMPLEMENTATION_PLAN.md), этап 0

---

# 1. Назначение документа

Документ описывает целевую модель хранения после этапов миграции из
[UI_IMPLEMENTATION_PLAN.md](UI_IMPLEMENTATION_PLAN.md). Он является контрактом
для Prisma schema, migrations, application services и JSON backup.

Текущая SQLite-схема может временно не содержать новые поля или хранить
taxonomy как JSON. Такие различия являются запланированным переходным
состоянием, а не альтернативной моделью.

---

# 2. Основные принципы

1. `Item` — единый локальный кэш справочных данных.
2. `UserItem` — пользовательское состояние `Item`; provider sync его не меняет.
3. Коллекция и wishlist — выборки по `UserItem`, а не отдельные таблицы Item.
4. Партии, покупки, предзаказы и события хранятся отдельными записями истории.
5. Внешние идентификаторы обеспечивают идемпотентную синхронизацию.
6. UI-состояния и агрегаты вычисляются и не дублируются в persistence без
   отдельной причины.
7. Удаление справочного Item с пользовательской историей не выполняется
   неявно; для обычного скрытия используется lifecycle/soft delete.

Имена Prisma-полей используют camelCase, имена столбцов — snake_case через
`@map`. Идентификаторы — UUID strings. Время хранится как `DateTime` и отдаётся
API в ISO 8601 UTC.

---

# 3. Схема связей

```text
ItemType 1 ─── * Item 1 ─── 0..1 UserItem
                    │
                    ├── * ExternalReference
                    ├── * PlaySession
                    ├── * Purchase
                    ├── * Preorder 1 ─── * PreorderEvent
                    ├── * Image
                    ├── * Note
                    ├── * Link
                    ├── * ItemRelation (parent/child)
                    ├── * Tag                 (MVP relation)
                    ├── * Mechanic            (через ItemMechanic)
                    ├── * Category            (через ItemCategory)
                    ├── * Designer            (через ItemDesigner)
                    ├── * Artist              (через ItemArtist)
                    └── * Publisher           (через ItemPublisher)
```

---

# 4. Стабильные коды и enums application layer

SQLite и Prisma хранят перечисления строками, а shared schemas ограничивают
допустимые значения.

```text
ItemTypeCode:
base_game | expansion | promo | accessory | organizer | component |
miniature | playmat | sleeves | dice | other

UserItemLifecycleStatus:
active | for_sale | sold | archived

PreorderStatus:
planned | ordered | paid | shipped | received | cancelled

ExpectedDatePrecision:
day | month | quarter | unknown

PlaySource:
manual | boardgamegeek

PlayResult:
win | loss | score | unknown
```

`preordered` и `played` не сохраняются в `UserItem.status`: они вычисляются по
связанным таблицам.

---

# 5. ItemType

| Поле | Тип | Null | Правило |
|---|---|---:|---|
| `id` | UUID | нет | primary key |
| `code` | string | нет | unique, стабильный системный код |
| `name` | string | нет | отображаемое название |
| `is_system` | boolean | нет | default `false` |
| `created_at` | datetime | нет | default now |
| `updated_at` | datetime | нет | auto update |

Системный тип нельзя удалить, пока на него ссылается `Item`.

---

# 6. Item

`Item` содержит только текущую версию справочных данных.

| Поле | Тип | Null | Описание |
|---|---|---:|---|
| `id` | UUID | нет | primary key |
| `type_id` | FK | нет | `ItemType.id`, on delete restrict |
| `title` | string | нет | название |
| `original_title` | string | да | оригинальное название |
| `description` | text | да | описание |
| `year` | integer | да | год выпуска |
| `min_players` | integer | да | минимум игроков |
| `max_players` | integer | да | максимум игроков |
| `min_play_time` | integer | да | минуты |
| `max_play_time` | integer | да | минуты |
| `min_age` | integer | да | минимальный возраст |
| `complexity` | decimal | да | weight/сложность |
| `rating` | decimal | да | рейтинг сообщества |
| `source_mode` | string | нет | `manual` или `imported`, default `manual` |
| `created_at` | datetime | нет | default now |
| `updated_at` | datetime | нет | auto update |
| `deleted_at` | datetime | да | soft delete справочного объекта |

Переходно поля `categories`, `mechanics`, `designers`, `artists`, `publishers`
могут существовать как JSON-массивы. Целевая модель использует связи из
раздела 16.

---

# 7. UserItem

Для однопользовательского MVP `item_id` уникален. При появлении пользователей
ограничение заменяется на unique `(user_id, item_id)`.

```prisma
model UserItem {
  id             String    @id @default(uuid())
  itemId         String    @unique @map("item_id")
  owned          Boolean   @default(false)
  wishlist       Boolean   @default(false)
  status         String    @default("active")
  ownedAt        DateTime? @map("owned_at")
  favorite       Boolean   @default(false)
  location       String?
  personalRating Int?      @map("personal_rating")
  notes          String?
  interestLevel  Int?      @map("interest_level")
  decisionNotes  String?   @map("decision_notes")
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")
}
```

| Поле | Семантика |
|---|---|
| `owned` | включает Item в коллекцию |
| `wishlist` | включает Item в wishlist, если `owned = false` |
| `status` | только `active`, `for_sale`, `sold`, `archived` |
| `owned_at` | дата добавления в актуальную коллекцию; nullable для never-owned |
| `favorite` | пользовательское избранное, default `false` |
| `personal_rating` | целое 1–10 или null |
| `interest_level` | целое 1–5 или null |

Application constraints:

- после команды каталога не допускается `owned = true AND wishlist = true`;
- `status = for_sale` требует `owned = true`;
- `status = sold` требует `owned = false AND wishlist = false`;
- `status = archived` исключает запись из основных каталогов;
- переход `owned false → true` заполняет `owned_at`, если оно null;
- provider sync не изменяет ни одно поле таблицы.

Индексы: `owned`, `wishlist`, `status`, `owned_at`, `favorite`.

---

# 8. ExternalReference

| Поле | Тип | Null | Описание |
|---|---|---:|---|
| `id` | UUID | нет | primary key |
| `item_id` | FK | нет | `Item.id`, cascade |
| `provider` | string | нет | `boardgamegeek`, `tesera`, `nastolio`, `manual` |
| `external_id` | string | нет | ID у provider |
| `url` | string | да | внешняя ссылка |
| `last_sync` | datetime | да | последняя успешная синхронизация |
| `created_at` | datetime | нет | default now |
| `updated_at` | datetime | нет | auto update |

Unique `(provider, external_id)`. Индексы: `item_id`, `provider`.

---

# 9. PlaySession

```prisma
model PlaySession {
  // существующие поля
  playedAt       DateTime  @map("played_at")
  startedAt      DateTime? @map("started_at")
  personalRating Int?      @map("personal_rating")
}
```

| Поле | Тип | Null | Описание |
|---|---|---:|---|
| `id` | UUID | нет | primary key |
| `item_id` | FK | нет | основной Item, cascade |
| `played_at` | datetime | нет | календарная дата партии |
| `started_at` | datetime | да | точное время начала, не заменяет `played_at` |
| `players_count` | integer | да | положительное число |
| `duration_minutes` | integer | да | положительное число |
| `result` | string | да | `win`, `loss`, `score`, `unknown` |
| `score` | string | да | счёт/результат |
| `scenario` | string | да | сценарий или сложность |
| `player_names` | JSON | да | нормализованный массив строк |
| `used_item_ids` | JSON | да | уникальный массив UUID |
| `personal_rating` | integer | да | целое 1–10 |
| `notes` | text | да | заметка |
| `source` | string | нет | default `manual` |
| `bgg_play_id` | string | да | unique внешний ID партии |
| `locally_modified_at` | datetime | да | защита локальных изменений |
| `imported_at` | datetime | да | дата импорта |
| `created_at` | datetime | нет | default now |
| `updated_at` | datetime | нет | auto update |

`used_item_ids` не содержит основной `item_id`, повторов и несуществующих UUID.
Нормализация участников в отдельные таблицы не входит в P0/P1.

Индексы: `item_id`, `played_at`, unique/index `bgg_play_id`.

---

# 10. Purchase

| Поле | Тип | Null | Описание |
|---|---|---:|---|
| `id` | UUID | нет | primary key |
| `item_id` | FK | нет | `Item.id`, cascade |
| `shop` | string | нет | магазин |
| `price` | decimal | нет | цена до корректировок |
| `currency` | string(3) | нет | ISO 4217 code |
| `delivery_cost` | decimal | да | неотрицательная доставка |
| `discount` | decimal | да | неотрицательная скидка |
| `total_price` | decimal | нет | итоговая сумма |
| `purchase_date` | datetime | да | дата покупки |
| `comment` | text | да | комментарий |
| `created_at` | datetime | нет | default now |
| `updated_at` | datetime | нет | auto update |

Индекс: `item_id`. Денежные значения неотрицательны; валюты агрегируются
раздельно.

---

# 11. Preorder

```prisma
model Preorder {
  // существующие поля
  expectedDate          DateTime? @map("expected_date")
  expectedDatePrecision String    @default("day") @map("expected_date_precision")
}
```

| Поле | Тип | Null | Описание |
|---|---|---:|---|
| `id` | UUID | нет | primary key |
| `item_id` | FK | нет | `Item.id`, cascade |
| `shop` | string | нет | магазин/площадка |
| `price` | decimal | нет | неотрицательная стоимость |
| `currency` | string(3) | нет | ISO 4217 code |
| `order_date` | datetime | да | дата оформления |
| `expected_date` | datetime | да | нормализованное начало периода |
| `expected_date_precision` | string | нет | day/month/quarter/unknown |
| `received_date` | datetime | да | фактическое получение |
| `tracking_number` | string | да | трек-номер |
| `status` | string | нет | канонический статус предзаказа |
| `comment` | text | да | комментарий |
| `created_at` | datetime | нет | default now |
| `updated_at` | datetime | нет | auto update |

Инварианты пары даты:

```text
day     → точный календарный день
month   → первый день календарного месяца
quarter → 1 января / 1 апреля / 1 июля / 1 октября
unknown → expected_date IS NULL
```

Application service всегда пишет precision явно. Default `day` нужен для
совместимости старых writers; reader до завершения backfill трактует legacy
комбинацию `expected_date = null AND precision = day` как effective `unknown`.

Канонические статусы:

```text
planned → ordered → paid → shipped → received
                                  ↘ cancelled
```

UI-группа `delayed` не хранится. Индексы: `item_id`, `status`,
`expected_date`, составной `(status, expected_date)`.

---

# 12. PreorderEvent

| Поле | Тип | Null | Описание |
|---|---|---:|---|
| `id` | UUID | нет | primary key |
| `preorder_id` | FK | нет | `Preorder.id`, cascade |
| `type` | string | нет | тип события |
| `old_value` | text | да | предыдущее значение |
| `new_value` | text | да | новое значение |
| `reason` | string | да | причина пользователя |
| `comment` | text | да | комментарий |
| `created_at` | datetime | нет | immutable event timestamp |

Минимальные типы событий:

```text
expected_date_changed | status_changed
```

Для `expected_date_changed` новый writer сериализует в каждом value JSON:

```json
{"expectedDate":"2026-10-01T00:00:00.000Z","expectedDatePrecision":"month"}
```

`expectedDate` может быть null только вместе с precision `unknown`.

Legacy reader:

- JSON object → проверить оба поля;
- ISO string → precision `day`;
- SQL null → дата null, precision `unknown`;
- невалидное значение → не падать при чтении списка, вернуть event warning и
  сохранить исходный текст для диагностики.

События не редактируются и не удаляются отдельно. Индекс: `preorder_id`.

---

# 13. Image

| Поле | Тип | Null | Описание |
|---|---|---:|---|
| `id` | UUID | нет | primary key |
| `item_id` | FK | нет | `Item.id`, cascade |
| `type` | string | нет | `reference` или `user` |
| `provider` | string | да | источник справочного изображения |
| `url` | string | да | внешний URL |
| `path` | string | да | локальный путь |
| `caption` | string | да | подпись |
| `sort_order` | integer | нет | default 0 |
| `created_at` | datetime | нет | default now |

Хотя бы одно из `url`/`path` должно быть задано. Provider sync изменяет только
`type = reference`. Индекс: `item_id`.

---

# 14. ItemRelation

| Поле | Тип | Null | Описание |
|---|---|---:|---|
| `id` | UUID | нет | primary key |
| `parent_item_id` | FK | нет | исходный Item, cascade |
| `child_item_id` | FK | нет | связанный Item, cascade |
| `relation_type` | string | нет | стабильный тип связи |
| `comment` | text | да | комментарий |
| `created_at` | datetime | нет | default now |
| `updated_at` | datetime | нет | auto update |

Типы:

```text
requires | expands | compatible_with | contains | part_of |
localized_version_of | alternative_to | related
```

Ограничения:

- parent != child;
- unique `(parent_item_id, child_item_id, relation_type)`;
- `expansionsCount` учитывает только согласованные направленные типы `expands`
  и обратную сторону `requires` по правилам relation mapper.

Индексы: `parent_item_id`, `child_item_id`.

---

# 15. Note, Tag и Link

## Note

`Note(id, item_id, title?, body, created_at, updated_at)` хранит развёрнутые
пользовательские заметки. Индекс `item_id`.

## Tag

`Tag(id, name, color?, created_at, updated_at)` имеет unique `name`.
Для однопользовательского MVP допустима существующая связь many-to-many
`Item`–`Tag`. При многопользовательском режиме она переносится на `UserItem`.

## Link

`Link(id, item_id, type, url, title?, created_at, updated_at)` хранит типы:

```text
official | rules | kickstarter | gamefound | youtube | review |
publisher | shop | other
```

Индекс `item_id`.

---

# 16. Нормализованные справочники Item

Целевая модель заменяет JSON-массивы отдельными справочниками и join tables.

Каждый справочник содержит минимум:

| Поле | Тип | Null | Описание |
|---|---|---:|---|
| `id` | UUID | нет | primary key |
| `name` | string | нет | отображаемое имя |
| `normalized_name` | string | нет | имя для дедупликации/поиска |
| `created_at` | datetime | нет | default now |
| `updated_at` | datetime | нет | auto update |

Справочники:

```text
Mechanic | Category | Designer | Artist | Publisher
```

Join tables:

```text
ItemMechanic(item_id, mechanic_id)
ItemCategory(item_id, category_id)
ItemDesigner(item_id, designer_id)
ItemArtist(item_id, artist_id)
ItemPublisher(item_id, publisher_id)
```

Каждая join table имеет composite primary/unique key на двух FK, cascade при
удалении Item и restrict при удалении используемого справочного значения.
`normalized_name` уникален внутри соответствующего справочника после
нормализации Unicode, trim и case-folding.

Миграция выполняется отдельно:

1. Создать таблицы, сохранив JSON-поля.
2. Backfill и дедупликация.
3. Dual read/write и проверка количества связей.
4. Переключение providers, filters и backup.
5. Удаление JSON-полей отдельной миграцией после проверки.

До шага 4 DTO возвращают одинаковые массивы независимо от источника хранения.

---

# 17. Обязательные ограничения и индексы

Обязательные unique constraints:

- `ItemType.code`;
- `UserItem.item_id` для локального MVP;
- `ExternalReference(provider, external_id)`;
- `PlaySession.bgg_play_id`, если не null;
- `ItemRelation(parent_item_id, child_item_id, relation_type)`;
- `Tag.name`;
- каждая пара FK в taxonomy join table.

Application/DB checks, где поддерживаются:

- минимальные значения игроков и длительности положительные;
- `personal_rating` 1–10;
- `interest_level` 1–5;
- цены и денежные корректировки неотрицательны;
- currency состоит из трёх символов;
- min <= max для игроков, времени и диапазонов query;
- parent ItemRelation не равен child;
- precision соответствует нормализованной дате.

Все внешние ключи индексируются. Дополнительные read-индексы вводятся по
фактическим Prisma query plans; обязательный минимум указан в разделах сущностей.

---

# 18. Миграции и backfill новых полей

## 18.1 UserItem

1. Добавить nullable `owned_at`.
2. Для строк `owned = true` записать `owned_at = created_at`.
3. Добавить `favorite` с default `false`.
4. Нормализовать legacy status:

```text
owned | wishlist | preordered | played → active
for_sale | sold | archived             → без изменения
прочее                              → active + warning в migration report
```

5. Изменить default `status` на `active`.
6. Устранить legacy `owned = true AND wishlist = true`: сохранить owned и
   сбросить wishlist, не удаляя Item или историю.

Backfill должен быть повторяемым на копии production SQLite.

## 18.2 Preorder

1. Добавить `expected_date_precision` с временным/default значением `day`.
2. Для `expected_date IS NOT NULL` оставить `day`.
3. Для `expected_date IS NULL` записать `unknown`.
4. Переключить writers на явную запись precision.
5. Сохранить legacy events без переписывания; reader поддерживает оба формата.

## 18.3 PlaySession

`started_at` и `personal_rating` добавляются nullable без backfill. BGG sync не
записывает `personal_rating` и не меняет локальное значение.

---

# 19. Backup schema

При первой persistence-миграции после этого документа версия backup повышается
с `1` до `2`.

Backup v2 добавляет:

```text
UserItem.ownedAt
UserItem.favorite
UserItem.status с lifecycle-семантикой
Preorder.expectedDatePrecision
PreorderEvent JSON values для новых expected_date_changed
PlaySession.startedAt
PlaySession.personalRating
```

Importer v1 → v2 применяет defaults:

- owned UserItem: `ownedAt = createdAt`; иначе `null`;
- `favorite = false`;
- legacy status нормализуется по разделу 18.1;
- preorder с датой: precision `day`; без даты: `unknown`;
- `startedAt = null`, `personalRating = null`.

Старые события импортируются дословно. Экспорт после импорта может оставить их
legacy-строками; только новые события обязаны использовать JSON. Импорт не
создаёт дубли внешних ссылок, BGG-партий, relations и join-связей.

Обязательные тесты:

- импорт backup v1;
- round-trip backup v2;
- mixed legacy/new preorder events;
- повторный импорт одного backup;
- сохранность UUID и внешних идентификаторов.

---

# 20. Read-model правила

Persistence entities не отдаются клиенту напрямую.

- `UserItem.states` вычисляется из flags, lifecycle status и EXISTS/count
  связанных таблиц.
- `Preorder.uiStatus` вычисляется из status, даты, precision и текущего дня.
- compact DTO используют `select`, `_count`, aggregate и `take: 1`, а не полную
  загрузку дочерних коллекций.
- collection sort `added` использует `owned_at`.
- dashboard recent items ограничивается четырьмя, предзаказы — тремя, партии —
  четырьмя.
- taxonomy mapper скрывает переход между JSON и join tables.

Формы DTO и URL query зафиксированы в [SPEC.md](SPEC.md).

---

# 21. Критерии соответствия

Схема считается соответствующей документу, когда:

- `Item` и `UserItem` не смешивают справочные и пользовательские данные;
- lifecycle status не хранит вычисляемые состояния;
- новые поля имеют описанные defaults, validation и backfill;
- дата и precision предзаказа изменяются атомарно и создают событие;
- legacy event и backup v1 продолжают читаться;
- BGG sync остаётся идемпотентным;
- taxonomy-нормализация выполняется без блокирования compact/detail DTO;
- schema, importer/exporter и application services покрыты migration и
  contract tests.
