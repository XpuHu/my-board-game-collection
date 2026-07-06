# DATABASE.md

# Board Game Collection

**Версия:** 3.1

---

# 1. Цели

База данных должна поддерживать:

* `Item` как локальный кэш справочных данных из внешних источников;
* `UserItem` как пользовательское состояние конкретного элемента;
* два пользовательских каталога: коллекцию и wishlist;
* компактное отображение owned-игр и подробное отображение wishlist;
* историю партий;
* синхронизацию партий с BoardGameGeek;
* историю покупок и предзаказов;
* историю изменений предзаказов;
* повторную синхронизацию внешних справочных данных без потери пользовательского состояния.

---

# 2. Основная модель

Все справочные объекты представлены сущностью **Item**.

`Item` может быть базовой игрой, дополнением, промо, аксессуаром, органайзером или любым другим связанным объектом.

`Item` хранит нормализованный локальный кэш внешней справочной информации:

* название;
* описание;
* год;
* количество игроков;
* время партии;
* возраст;
* рейтинг;
* сложность;
* источник данных.

`UserItem` хранит пользовательское состояние этого `Item`:

* есть ли игра в коллекции;
* есть ли игра в wishlist;
* личная оценка;
* место хранения;
* заметки;
* пользовательские теги и статус.

Коллекция и wishlist не являются отдельными типами `Item`. Это разные представления `UserItem`.

---

# 3. Сущности

```text
Item
│
├── ItemType
├── UserItem
├── ExternalReference
├── Purchase
├── Preorder
│   └── PreorderEvent
├── PlaySession
├── Image
├── Note
├── ItemRelation
├── Link
└── Tag
```

---

# 4. Item

`Item` - локальный кэш справочных данных. Он обновляется импортом и синхронизацией внешних источников.

| Поле | Тип | Описание |
| ---- | --- | -------- |
| id | UUID | идентификатор |
| type_id | FK | тип элемента |
| title | string | название |
| original_title | string | оригинальное название, nullable |
| description | text | описание, nullable |
| year | integer | год выпуска, nullable |
| min_players | integer | минимум игроков, nullable |
| max_players | integer | максимум игроков, nullable |
| min_play_time | integer | минимальное время партии, nullable |
| max_play_time | integer | максимальное время партии, nullable |
| min_age | integer | минимальный возраст, nullable |
| complexity | decimal | сложность/weight, nullable |
| rating | decimal | рейтинг сообщества, nullable |
| source_mode | string | `imported` или `manual` |
| created_at | datetime | дата создания |
| updated_at | datetime | дата изменения |
| deleted_at | datetime | мягкое удаление, nullable |

Механики, категории, дизайнеры, художники и издатели хранятся через связи многие-ко-многим с `Item`.

Синхронизация внешних источников обновляет поля `Item`, справочные изображения, ссылки и справочные связи.

---

# 5. ItemType

| Поле | Тип | Описание |
| ---- | --- | -------- |
| id | UUID | идентификатор |
| code | string | стабильный код |
| name | string | отображаемое название |
| is_system | boolean | системный тип |
| created_at | datetime | дата создания |
| updated_at | datetime | дата изменения |

Системные типы:

* `base_game`;
* `expansion`;
* `promo`;
* `accessory`;
* `organizer`;
* `component`;
* `miniature`;
* `playmat`;
* `sleeves`;
* `dice`;
* `other`.

---

# 6. UserItem

`UserItem` - пользовательское состояние `Item`.

В локальном MVP существует один пользователь, поэтому `item_id` уникален. Если появится многопользовательский режим, ограничение заменяется на уникальность пары `user_id + item_id`.

| Поле | Тип | Описание |
| ---- | --- | -------- |
| id | UUID | идентификатор |
| item_id | FK | элемент |
| owned | boolean | есть в коллекции |
| wishlist | boolean | есть в wishlist |
| status | string | общий пользовательский статус |
| location | string | место хранения, nullable |
| personal_rating | integer | личная оценка, nullable |
| notes | text | короткие заметки, nullable |
| interest_level | integer | уровень интереса wishlist, nullable |
| decision_notes | text | заметки о покупке/пробе, nullable |
| created_at | datetime | дата создания |
| updated_at | datetime | дата изменения |

Правила:

* `owned = true` включает элемент в "Мою коллекцию".
* `wishlist = true` включает элемент в Wishlist.
* Один элемент может одновременно быть `wishlist` и `preordered`.
* При переносе из wishlist в коллекцию `Item` не дублируется, меняется только `UserItem`.
* Синхронизация справочных данных не изменяет `UserItem`.

---

# 7. ExternalReference

| Поле | Тип | Описание |
| ---- | --- | -------- |
| id | UUID | идентификатор |
| item_id | FK | элемент |
| provider | string | источник |
| external_id | string | внешний идентификатор |
| url | string | ссылка, nullable |
| last_sync | datetime | последняя синхронизация справки |
| created_at | datetime | дата создания |
| updated_at | datetime | дата изменения |

Provider:

* `boardgamegeek`;
* `tesera`;
* `nastolio`;
* `manual`.

Один `Item` может иметь несколько внешних идентификаторов.

---

# 8. PlaySession

История партий.

| Поле | Тип | Описание |
| ---- | --- | -------- |
| id | UUID | идентификатор |
| item_id | FK | игра или применимый элемент |
| played_at | date | дата партии |
| players_count | integer | количество игроков, nullable |
| duration_minutes | integer | длительность, nullable |
| result | string | `win`, `loss`, `score`, `unknown`, nullable |
| score | string | счет или результат, nullable |
| scenario | string | сценарий/сложность, nullable |
| player_names | json | список игроков, nullable |
| used_item_ids | json | использованные дополнения, nullable |
| notes | text | заметки, nullable |
| source | string | `manual`, `boardgamegeek` |
| bgg_play_id | string | идентификатор партии BGG, nullable |
| locally_modified_at | datetime | локальное изменение, nullable |
| imported_at | datetime | дата импорта, nullable |
| created_at | datetime | дата создания |
| updated_at | datetime | дата изменения |

Ограничения:

* `bgg_play_id` уникален, если задан.
* Повторная BGG-синхронизация не создает дубликаты.
* Локально измененные поля не перезаписываются без явного правила синхронизации.

---

# 9. Purchase

| Поле | Тип | Описание |
| ---- | --- | -------- |
| id | UUID | идентификатор |
| item_id | FK | элемент |
| shop | string | магазин |
| price | decimal | цена |
| currency | string | валюта |
| delivery_cost | decimal | доставка, nullable |
| discount | decimal | скидка, nullable |
| total_price | decimal | итоговая стоимость |
| purchase_date | date | дата покупки, nullable |
| comment | text | комментарий, nullable |
| created_at | datetime | дата создания |
| updated_at | datetime | дата изменения |

---

# 10. Preorder

| Поле | Тип | Описание |
| ---- | --- | -------- |
| id | UUID | идентификатор |
| item_id | FK | элемент |
| shop | string | магазин или площадка |
| price | decimal | стоимость |
| currency | string | валюта |
| order_date | date | дата оформления, nullable |
| expected_date | date | ожидаемая дата получения, nullable |
| received_date | date | фактическая дата получения, nullable |
| tracking_number | string | трек-номер, nullable |
| status | string | статус |
| comment | text | комментарий, nullable |
| created_at | datetime | дата создания |
| updated_at | datetime | дата изменения |

Статусы:

* `planned`;
* `ordered`;
* `paid`;
* `shipped`;
* `received`;
* `cancelled`.

---

# 11. PreorderEvent

История изменений предзаказа.

| Поле | Тип | Описание |
| ---- | --- | -------- |
| id | UUID | идентификатор |
| preorder_id | FK | предзаказ |
| type | string | тип события |
| old_value | string | старое значение, nullable |
| new_value | string | новое значение, nullable |
| reason | string | причина, nullable |
| comment | text | комментарий, nullable |
| created_at | datetime | дата события |

Минимальный тип события MVP:

* `expected_date_changed`.

---

# 12. Image

| Поле | Тип | Описание |
| ---- | --- | -------- |
| id | UUID | идентификатор |
| item_id | FK | элемент |
| type | string | `reference` или `user` |
| provider | string | источник, nullable |
| url | string | внешний URL, nullable |
| path | string | локальный путь, nullable |
| caption | string | подпись, nullable |
| sort_order | integer | порядок |
| created_at | datetime | дата создания |

Справочные изображения обновляются синхронизацией. Пользовательские изображения не участвуют в синхронизации.

---

# 13. ItemRelation

Связи между любыми `Item`.

| Поле | Тип | Описание |
| ---- | --- | -------- |
| id | UUID | идентификатор |
| parent_item_id | FK | исходный элемент |
| child_item_id | FK | связанный элемент |
| relation_type | string | тип связи |
| comment | text | комментарий, nullable |
| created_at | datetime | дата создания |
| updated_at | datetime | дата изменения |

Типы:

* `requires`;
* `expands`;
* `compatible_with`;
* `contains`;
* `part_of`;
* `localized_version_of`;
* `alternative_to`;
* `related`.

---

# 14. Note, Tag, Link

`Note` хранит развернутые пользовательские заметки.

`Tag` хранит пользовательские метки и связан с `UserItem` или `Item` по правилам локального приложения. Для MVP допустима связь `Item`-`Tag`, потому что пользователь один.

`Link` хранит дополнительные ссылки:

* `official`;
* `rules`;
* `kickstarter`;
* `gamefound`;
* `youtube`;
* `review`;
* `publisher`;
* `shop`;
* `other`.

---

# 15. Индексы и ограничения

Обязательные ограничения:

* `Item.type_id` обязателен;
* `Item.title` обязателен;
* `UserItem.item_id` уникален для локального MVP;
* `ExternalReference(provider, external_id)` уникален;
* `PlaySession.bgg_play_id` уникален, если не `null`;
* `ItemRelation(parent_item_id, child_item_id, relation_type)` уникален;
* `ItemRelation.parent_item_id` не равен `child_item_id`;
* `Tag.name` уникален.

Рекомендуемые индексы:

* `Item.title`;
* `Item.original_title`;
* `Item.type_id`;
* `UserItem.owned`;
* `UserItem.wishlist`;
* `UserItem.status`;
* `PlaySession.item_id`;
* `PlaySession.played_at`;
* `PlaySession.bgg_play_id`;
* `Preorder.status`;
* `Preorder.expected_date`;
* `ExternalReference.item_id`;
* `ExternalReference.provider`.

---

# 16. Принципы

## Item - локальный справочный кэш

`Item` хранит текущую нормализованную версию справочных данных. Его поля могут обновляться синхронизацией.

## UserItem - пользовательское состояние

`UserItem` хранит то, что принадлежит пользователю: owned, wishlist, личную оценку, место, заметки и статус.

## Два каталога

Коллекция и wishlist - это разные выборки по `UserItem`, а не разные таблицы игр.

## История

Партии, покупки, предзаказы и изменения дат предзаказов не перезаписываются как одно поле истории. Каждая важная операция сохраняется отдельной записью.

## BGG Sync

Синхронизация партий использует внешний идентификатор BGG и должна быть идемпотентной.
