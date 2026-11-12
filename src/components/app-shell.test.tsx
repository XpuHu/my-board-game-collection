import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ProductFeaturesProvider } from "@/components/product-features-provider";
import { featuresForMode } from "@/shared/config/product-features";
import { AppShell } from "@/components/app-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/collection",
}));

describe("AppShell", () => {
  it("renders responsive navigation and a single sidebar attribution", () => {
    const markup = renderToStaticMarkup(
      <AppShell>
        <main>Содержимое</main>
      </AppShell>,
    );

    expect(markup).toContain("Основная навигация");
    expect(markup).toContain("Мобильная навигация");
    expect(markup).toContain('aria-current="page"');
    expect(markup.match(/Powered by BoardGameGeek/g)).toHaveLength(2);
    expect(markup.match(/alt="Powered by BoardGameGeek"/g)).toHaveLength(1);
    expect(markup).not.toContain("<footer");
    expect(markup).toContain('class="app-shell-content"');
    expect(markup).not.toContain("md:pl-[72px]");
    expect(markup).not.toContain("min-[1200px]:pl-56");
    expect(markup).not.toContain("xl:");
    expect(markup).toContain("safe-area-inset-top");
    expect(markup).toContain("safe-area-inset-bottom");
    expect(markup).toContain('href="#main-content"');
    expect(markup).toContain('id="main-content"');
    expect(markup).toContain("Перейти к содержимому");
    expect(markup).not.toContain("shadow-[");
  });
  it("hides deferred navigation in MVP and restores it in full mode", () => {
    const mvp = renderToStaticMarkup(
      <AppShell>
        <main>Core</main>
      </AppShell>,
    );
    for (const href of ["/plays", "/statistics", "/wishlist", "/settings"])
      expect(mvp).not.toContain(`href="${href}"`);
    expect(mvp).toContain('href="/collection"');
    expect(mvp).toContain('href="/preorders"');
    const full = renderToStaticMarkup(
      <ProductFeaturesProvider features={featuresForMode("full")}>
        <AppShell>
          <main>Full</main>
        </AppShell>
      </ProductFeaturesProvider>,
    );
    for (const href of ["/plays", "/statistics", "/wishlist", "/settings"])
      expect(full).toContain(`href="${href}"`);
  });
});
