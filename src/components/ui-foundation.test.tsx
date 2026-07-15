import { renderToStaticMarkup } from "react-dom/server";
import { Gamepad2 } from "lucide-react";
import { describe, expect, it } from "vitest";

import { GameCover } from "@/components/game-cover";
import { OfflineBanner } from "@/components/offline-banner";
import { PageHeader } from "@/components/page-header";
import { Rating } from "@/components/rating";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState, LoadingState } from "@/components/ui-state";

describe("UI foundation", () => {
  it("renders the shared page and status primitives", () => {
    const markup = renderToStaticMarkup(
      <>
        <PageHeader title="Коллекция" subtitle="Все игры" />
        <StatusBadge variant="success">Есть в коллекции</StatusBadge>
        <Rating value={4} showValue />
        <GameCover alt="Без обложки" size="sm" />
      </>,
    );

    expect(markup).toContain("Коллекция");
    expect(markup).toContain("Есть в коллекции");
    expect(markup).toContain("4.0");
    expect(markup).toContain("обложка отсутствует");
  });

  it("uses skeleton content and exposes empty-state actions", () => {
    const markup = renderToStaticMarkup(
      <>
        <LoadingState title="Загрузка коллекции" description="Получаем игры" />
        <EmptyState
          icon={Gamepad2}
          title="Пока пусто"
          description="Добавьте первую игру"
          primaryAction={<button>Добавить</button>}
          secondaryAction={<button>Импортировать</button>}
        />
      </>,
    );

    expect(markup).toContain("Загрузка коллекции");
    expect(markup).toContain("animate-pulse");
    expect(markup).toContain("Добавить");
    expect(markup).toContain("Импортировать");
  });

  it("renders the prescribed offline message", () => {
    const markup = renderToStaticMarkup(<OfflineBanner forceVisible />);
    expect(markup).toContain(
      "Нет подключения. Отображаются сохранённые данные.",
    );
  });
});
