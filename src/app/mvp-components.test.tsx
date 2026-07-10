import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/toast-provider";
import { CollectionPageClient } from "@/app/collection/collection-page-client";
import { CollectionItemPageClient } from "@/app/collection/[itemId]/collection-item-page-client";
import { ExternalImportPageClient } from "@/app/items/new/external-import-page-client";
import { PlaysPageClient } from "@/app/plays/plays-page-client";
import { PreordersPageClient } from "@/app/preorders/preorders-page-client";
import { WishlistItemPageClient } from "@/app/wishlist/[itemId]/wishlist-item-page-client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe("MVP component contracts", () => {
  it("renders the collection list shell with compact filters and loading state", () => {
    const markup = renderToStaticMarkup(<CollectionPageClient />);

    expect(markup).toContain("Моя коллекция");
    expect(markup).toContain("Поиск");
    expect(markup).toContain("Добавить игру");
    expect(markup).toContain("Загружаем коллекцию");
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

  it("renders manual item creation quick actions before external search", () => {
    const markup = renderToStaticMarkup(
      <ExternalImportPageClient initialTarget="play" />,
    );

    expect(markup).toContain("Добавить игру");
    expect(markup).toContain("Быстрый ручной сценарий");
    expect(markup).toContain("Создать и добавить партию");
    expect(markup).toContain("Создать и добавить в wishlist");
    expect(markup).toContain("Создать и оформить предзаказ");
    expect(markup).toContain("Создать как справочник");
    expect(markup).toContain("Внешний поиск BGG/Tesera");
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
    expect(markup).not.toContain("Источник");
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
});

function Wrapped({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
