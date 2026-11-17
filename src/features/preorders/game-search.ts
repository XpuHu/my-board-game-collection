import { apiRequest } from "@/shared/api/client";
import { searchExternalItems } from "@/features/items/api";

export type PreorderGame = {
  id: string;
  title: string;
  type: { name: string };
};
export type LocalGameSearch = {
  data: PreorderGame[];
  pagination: { page: number; totalPages: number; total: number };
};

export async function searchPreorderGames(
  query: string,
  page = 1,
  external = false,
) {
  if (!external) {
    const local = await apiRequest<LocalGameSearch>(
      `/api/items/search?q=${encodeURIComponent(query.trim())}&page=${page}`,
    );
    if (local.data.length > 0) return { source: "local", ...local } as const;
  }
  const result = await searchExternalItems({
    q: query.trim(),
    provider: "boardgamegeek",
    fallbackToTesera: false,
  });
  if (
    result.warnings?.some((warning) => warning.code === "PROVIDER_DISABLED")
  ) {
    throw new Error(
      "Поиск в BGG отключён. Повторите поиск после подключения каталога.",
    );
  }
  return { source: "external", ...result } as const;
}
