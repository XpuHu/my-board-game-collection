import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExternalImportPageClient } from "./external-import-page-client";

describe("preorder creation entry", () => {
  it("starts with one game search field and hides manual entry and source selectors", () => {
    const markup = renderToStaticMarkup(
      <ExternalImportPageClient initialTarget="preorder" />,
    );
    expect(markup.match(/<input\b/g)).toHaveLength(1);
    expect(markup).toContain("Поиск игры");
    expect(markup).not.toContain("Выбрать существующую игру");
    expect(markup).not.toContain("manual-title");
    expect(markup).not.toContain("Источник поиска");
    expect(markup).not.toContain("Цель импорта");
  });
});
