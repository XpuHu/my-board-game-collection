import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/toast-provider";
import HomePage from "@/app/page";
import { CollectionPageClient } from "@/app/collection/collection-page-client";
import { CollectionItemPageClient } from "@/app/collection/[itemId]/collection-item-page-client";
import { ExternalImportPageClient } from "@/app/items/new/external-import-page-client";
import { PlaysPageClient } from "@/app/plays/plays-page-client";
import { PreordersPageClient } from "@/app/preorders/preorders-page-client";
import { WishlistItemPageClient } from "@/app/wishlist/[itemId]/wishlist-item-page-client";
import { WishlistPageClient } from "@/app/wishlist/wishlist-page-client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("MVP component contracts", () => {
  it("renders the collection list shell with compact toolbar and loading state", () => {
    const markup = renderToStaticMarkup(
      <Wrapped>
        <CollectionPageClient />
      </Wrapped>,
    );

    expect(markup).toContain("Моя коллекция");
    expect(markup).toContain("Поиск по коллекции");
    expect(markup).toContain("Добавить игру");
    expect(markup).not.toContain("Недавние партии");
    expect(markup).toContain("Название");
    expect(markup).toContain("Загружаем данные");
  });

  it("renders the collection item card loading shell", () => {
    const markup = renderToStaticMarkup(
      <Wrapped>
        <CollectionItemPageClient itemId="item-1" />
      </Wrapped>,
    );

    expect(markup).toContain("Загружаем карточку");
    expect(markup).toContain("Получаем компактные данные владельца");
  });

  it("renders external catalog search before offering manual creation", () => {
    const markup = renderToStaticMarkup(
      <ExternalImportPageClient initialTarget="play" />,
    );

    expect(markup).toContain("Добавить игру");
    expect(markup).toContain("1. Найти в каталогах");
    expect(markup).toContain("сначала BoardGameGeek, затем Tesera");
    expect(markup).toContain("2. Выбор");
    expect(markup).toContain("3. Личные данные");
    expect(markup).toContain("4. Готово");
    expect(markup).not.toContain("Быстрый ручной сценарий");
    expect(markup).not.toContain("3. Ввести данные вручную");
  });

  it("renders the plays page shell with history filters and add action", () => {
    const markup = renderToStaticMarkup(
      <Wrapped>
        <PlaysPageClient initialItemId="item-1" />
      </Wrapped>,
    );

    expect(markup).toContain("Партии");
    expect(markup).toContain("Добавить партию");
    expect(markup).toContain("С даты");
    expect(markup).toContain("По дату");
    expect(markup).toContain("Источник");
    expect(markup).toContain("Игрок");
    expect(markup).toContain("Участников");
    expect(markup).toContain("Длительность, мин");
    expect(markup).toContain("Дополнение");
  });

  it("renders the preorder page shell with expected-date workflow entry points", () => {
    const markup = renderToStaticMarkup(
      <Wrapped>
        <PreordersPageClient />
      </Wrapped>,
    );

    expect(markup).toContain("Предзаказы");
    expect(markup).toContain("Оформить предзаказ");
    expect(markup).toContain("Загружаем предзаказы");
    expect(markup).toContain("активные ожидания");
    expect(markup).toContain("Полученные");
  });

  it("renders dashboard P0 quick actions", () => {
    const markup = renderToStaticMarkup(<HomePage />);

    expect(markup).toContain("Быстрые действия");
    expect(markup).toContain("Добавить партию");
    expect(markup).toContain("Изменить предзаказ");
    expect(markup).toContain("Добавить фото");
  });

  it("renders the wishlist item card loading shell", () => {
    const markup = renderToStaticMarkup(
      <Wrapped>
        <WishlistItemPageClient itemId="item-1" />
      </Wrapped>,
    );

    expect(markup).toContain("Загружаем wishlist");
    expect(markup).toContain("подробную справочную карточку");
  });

  it("renders the target wishlist list with URL-backed filters", () => {
    const markup = renderToStaticMarkup(
      <Wrapped>
        <WishlistPageClient />
      </Wrapped>,
    );

    expect(markup).toContain("Добавить в wishlist");
    expect(markup).toContain("Рейтинг от");
    expect(markup).toContain("Механики");
    expect(markup).toContain("Сортировка");
    expect(markup).toContain("Загружаем wishlist");
  });
});

function Wrapped({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
