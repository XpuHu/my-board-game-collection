import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PreorderActionButton } from "./preorder-action-button";

describe("preorder action feedback", () => {
  it("shows a spinner, busy state and loading label while receiving", () => {
    const markup = renderToStaticMarkup(
      <PreorderActionButton
        action="receive"
        pendingAction="receive"
        onClick={() => {}}
      />,
    );
    expect(markup).toContain("animate-spin");
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("Отмечаем получение…");
    expect(markup).toContain('disabled=""');
  });
  it("disables other actions without showing the receiving spinner on them", () => {
    const markup = renderToStaticMarkup(
      <PreorderActionButton
        action="delete"
        pendingAction="receive"
        onClick={() => {}}
      />,
    );
    expect(markup).toContain('disabled=""');
    expect(markup).not.toContain("animate-spin");
    expect(markup).toContain("Удалить предзаказ");
  });
  it("restores the normal action when the request finishes", () => {
    const markup = renderToStaticMarkup(
      <PreorderActionButton action="receive" onClick={() => {}} />,
    );
    expect(markup).toContain("Отметить полученным");
    expect(markup).not.toContain("animate-spin");
    expect(markup).not.toContain('disabled=""');
  });
});
