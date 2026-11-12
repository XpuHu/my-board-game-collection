import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Gamepad2 } from "lucide-react";
import { describe, expect, it } from "vitest";

import { GameCover } from "@/components/game-cover";
import { OfflineBanner } from "@/components/offline-banner";
import { PageHeader } from "@/components/page-header";
import { Rating } from "@/components/rating";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui-state";

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

  it("renders half-star ratings without rounding them up", () => {
    const markup = renderToStaticMarkup(
      <Rating value={3.5} label="Личная оценка: 7 из 10" tone="accent" />,
    );

    expect(markup).toContain("Личная оценка: 7 из 10");
    expect(markup).toContain("width:50%");
    expect(markup).toContain("width:200%");
  });

  it("renders the prescribed offline message", () => {
    const markup = renderToStaticMarkup(<OfflineBanner forceVisible />);
    expect(markup).toContain(
      "Нет подключения. Отображаются сохранённые данные.",
    );
  });

  it("renders a retry action for the shared error state", () => {
    const markup = renderToStaticMarkup(
      <ErrorState description="API error" onRetry={() => undefined} />,
    );
    expect(markup).toContain("API error");
    expect(markup).toContain("Повторить");
  });

  it("keeps modal footer outside the scroll area and respects reduced motion", () => {
    const dialogSource = readFileSync(
      resolve(process.cwd(), "src/components/ui/dialog.tsx"),
      "utf8",
    );
    const globalStyles = readFileSync(
      resolve(process.cwd(), "src/app/globals.css"),
      "utf8",
    );

    expect(dialogSource).toContain("flex-1 overflow-y-auto");
    expect(dialogSource).toContain("flex shrink-0 flex-col-reverse");
    expect(dialogSource).not.toContain("sticky bottom-0");
    expect(dialogSource).toContain("@radix-ui/react-dialog");
    expect(globalStyles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(globalStyles).toContain(":focus-visible");
  });

  it("uses AA contrast for primary and muted text tokens", () => {
    expect(contrast("#ffffff", "#6757df")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#7f8ca2", "#101b2a")).toBeGreaterThanOrEqual(4.5);
  });
});

function contrast(foreground: string, background: string) {
  const values = [luminance(foreground), luminance(background)];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
}

function luminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
