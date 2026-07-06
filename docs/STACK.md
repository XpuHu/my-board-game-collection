# STACK.md

# Board Game Collection Stack

**Версия:** 2.1  
**Статус:** Draft

---

# 1. Цель документа

Документ фиксирует технологический стек для локального MVP Board Game Collection.

Стек должен поддерживать:

* React-фронтенд;
* локальный персональный запуск;
* единую модель `Item`;
* две пользовательские области: "Моя коллекция" и Wishlist;
* историю партий;
* синхронизацию партий с BoardGameGeek;
* быстрые формы добавления партии и изменения предзаказа;
* внешние Provider для BoardGameGeek, Tesera и Nastolio;
* возможность позже перейти к облачному или многопользовательскому режиму.

---

# 2. Рекомендуемый стек MVP

| Область | Технология |
| ------- | ---------- |
| Frontend | React |
| Application framework | Next.js |
| Language | TypeScript |
| Database | SQLite |
| ORM | Prisma |
| Styling | Tailwind CSS |
| UI components | shadcn/ui |
| Icons | lucide-react |
| Forms | React Hook Form |
| Validation | Zod |
| Unit tests | Vitest |
| Component tests | React Testing Library |
| E2E tests | Playwright |
| Import/export | JSON |
| Image storage | Local filesystem |

---

# 3. Frontend

Frontend реализуется на React и Next.js App Router.

Основные страницы:

* Главная;
* Моя коллекция;
* Wishlist;
* Предзаказы;
* Партии;
* Статистика;
* Настройки.

UI должен учитывать два разных режима:

* коллекция - компактный рабочий интерфейс для быстрых действий;
* wishlist - подробный справочный интерфейс для принятия решения.

Frontend не обращается напрямую к Prisma, файловому хранилищу или внешним источникам.

---

# 4. Backend

Для MVP backend размещается внутри Next.js через Route Handlers или Server Actions.

Серверная логика должна быть вынесена из UI-компонентов в application/domain/infrastructure слои.

Backend отвечает за:

* `Item`;
* коллекцию;
* wishlist;
* партии;
* BGG sync;
* предзаказы;
* покупки;
* внешний поиск;
* справочную синхронизацию;
* статистику;
* импорт и экспорт.

---

# 5. TypeScript

TypeScript используется для:

* DTO API;
* Prisma-моделей;
* Provider interfaces;
* форм и Zod-схем;
* предотвращения расхождений между collection/wishlist/play/preorder контрактами.

---

# 6. Database

Для MVP используется SQLite.

Причины:

* не требует отдельного сервера;
* подходит для персонального локального приложения;
* проста для резервного копирования;
* достаточна для коллекции, wishlist и истории партий.

Prisma используется для:

* схемы базы;
* миграций;
* типизированного доступа;
* будущего перехода на PostgreSQL.

---

# 7. UI Components

Используются Tailwind CSS, shadcn/ui и lucide-react.

Обязательные компоненты MVP:

* компактный список коллекции;
* подробная карточка wishlist;
* модальное окно добавления партии;
* модальное окно изменения даты предзаказа;
* внешний поиск;
* формы настроек BGG;
* статистические панели.

Иконки lucide-react используются для действий: добавить, редактировать, синхронизировать, открыть ссылку, фильтровать.

---

# 8. Forms

Используются React Hook Form и Zod.

Формы MVP:

* добавление партии;
* изменение даты предзаказа;
* добавление игры в коллекцию;
* добавление игры в wishlist;
* создание предзаказа;
* редактирование пользовательских данных;
* настройки BGG;
* импорт JSON.

Форма добавления партии и форма изменения даты предзаказа должны быть короткими и открываться в одно окно.

---

# 9. State Management

В MVP не нужен отдельный глобальный state manager.

Использовать:

* URL state для поиска, фильтров и сортировки;
* React state для локального UI;
* server-side загрузку там, где возможно;
* TanStack Query только если клиентских асинхронных операций станет много.

---

# 10. Provider Layer

Внешние источники реализуются через интерфейсы.

```ts
interface ItemProvider {
  searchItems(query: string, filters?: unknown): Promise<ItemSearchResult[]>;
  getItem(externalId: string): Promise<ExternalItemDetails>;
  getRelatedItems?(externalId: string): Promise<ExternalItemRelation[]>;
  synchronizeItem(reference: ExternalReference): Promise<ExternalItemDetails>;
}

interface BggPlayProvider {
  getUserPlays(username: string, since?: string | null): Promise<ExternalPlay[]>;
}
```

Планируемые Provider:

* `BoardGameGeekProvider`;
* `BggPlayProvider`;
* `TeseraProvider`;
* `NastolioProvider`;
* `ManualProvider`.

BGG справочник и BGG партии должны быть разделены логически, потому что у них разные правила синхронизации.

---

# 11. Хранение изображений

Для MVP:

* справочные изображения можно хранить как внешние URL;
* пользовательские фотографии сохраняются локально;
* в базе хранится путь, тип изображения и привязка к `Item`;
* синхронизация не изменяет пользовательские фотографии.

В будущем можно добавить S3-совместимое хранилище.

---

# 12. Импорт и экспорт

Для MVP используется JSON.

Экспорт включает:

* `Item`;
* `ItemType`;
* `UserItem`;
* `ExternalReference`;
* `PlaySession`;
* `Purchase`;
* `Preorder`;
* `PreorderEvent`;
* `Image`;
* `Note`;
* `ItemRelation`;
* `Link`;
* `Tag`.

Импорт валидируется через Zod.

Импорт не должен создавать дубли внешних идентификаторов и `bggPlayId`.

---

# 13. Тестирование

Минимальные unit-тесты:

* добавление игры в коллекцию без дубля;
* добавление игры в wishlist без дубля;
* перенос из wishlist в коллекцию;
* создание партии;
* BGG sync без дублей;
* изменение даты предзаказа создает `PreorderEvent`;
* справочная синхронизация не меняет `UserItem`.

Минимальные component tests:

* список коллекции;
* карточка коллекции;
* форма добавления партии;
* список предзаказов;
* окно изменения даты;
* карточка wishlist.

Минимальные e2e-сценарии:

* добавить партию;
* изменить предзаказ;
* добавить игру в коллекцию;
* добавить игру в wishlist;
* синхронизировать партии BGG через mock provider;
* экспортировать и импортировать JSON.

---

# 14. Рекомендуемая структура

```text
src
│
├── app
│   ├── collection
│   ├── wishlist
│   ├── plays
│   ├── preorders
│   ├── statistics
│   ├── settings
│   └── api
│
├── components
│   ├── collection
│   ├── wishlist
│   ├── plays
│   ├── preorders
│   ├── forms
│   └── shared
│
├── domain
│   ├── item
│   ├── user-item
│   ├── play-session
│   ├── preorder
│   └── item-relation
│
├── application
│   ├── items
│   ├── collection
│   ├── wishlist
│   ├── plays
│   ├── bgg-sync
│   ├── preorders
│   ├── search
│   ├── synchronization
│   └── statistics
│
├── infrastructure
│   ├── database
│   ├── providers
│   ├── images
│   └── import-export
│
└── shared
```

---

# 15. Конфигурация

```text
DATABASE_URL="file:./dev.db"
UPLOAD_DIR="./uploads"
APP_URL="http://localhost:3000"
```

BGG username хранится в настройках приложения, а не обязательно в `.env`, потому что это пользовательская настройка.

---

# 16. Что не добавлять в MVP

В MVP не нужно добавлять:

* отдельный backend-сервис без необходимости;
* микросервисную архитектуру;
* Redis;
* Elasticsearch;
* сложный глобальный state manager;
* PostgreSQL как обязательную зависимость;
* авторизацию, если приложение остается персональным локальным инструментом;
* облачное файловое хранилище;
* фоновые очереди для BGG sync.

Эти решения можно добавить позже при реальной потребности.
