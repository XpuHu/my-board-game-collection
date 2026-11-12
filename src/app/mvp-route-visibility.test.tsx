import { afterEach, describe, expect, it, vi } from "vitest";
import PlaysPage from "@/app/plays/page";
import WishlistPage from "@/app/wishlist/page";
import WishlistItemPage from "@/app/wishlist/[itemId]/page";
import StatisticsPage from "@/app/statistics/page";
import SettingsPage from "@/app/settings/page";
import PurchasesPage from "@/app/purchases/page";
import HomePage from "@/app/page";
vi.mock("next/navigation", () => ({
  redirect: (href: string) => {
    throw new Error(`REDIRECT:${href}`);
  },
}));
afterEach(() => vi.unstubAllEnvs());
describe("MVP direct URL guards", () => {
  it("does not render deferred pages or the dashboard in MVP", async () => {
    vi.stubEnv("APP_PRODUCT_MODE", "mvp");
    for (const render of [
      WishlistPage,
      StatisticsPage,
      SettingsPage,
      PurchasesPage,
      HomePage,
    ])
      expect(render).toThrow("REDIRECT:/collection");
    await expect(
      PlaysPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("REDIRECT:/collection");
    await expect(
      WishlistItemPage({ params: Promise.resolve({ itemId: "existing" }) }),
    ).rejects.toThrow("REDIRECT:/collection");
  });
  it("preserves the original full-product routes", async () => {
    vi.stubEnv("APP_PRODUCT_MODE", "full");
    for (const render of [
      WishlistPage,
      StatisticsPage,
      SettingsPage,
      PurchasesPage,
      HomePage,
    ])
      expect(render()).toBeTruthy();
    expect(await PlaysPage({ searchParams: Promise.resolve({}) })).toBeTruthy();
  });
});
