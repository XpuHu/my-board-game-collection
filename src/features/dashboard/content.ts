export const dashboardQuotes = [
  "Хорошая коллекция — это игры, к которым хочется возвращаться.",
  "Лучшая партия начинается с приглашения за стол.",
  "Новая коробка радует, сыгранная — запоминается.",
] as const;

export function quoteForDate(date = new Date()) {
  const day = Math.floor(date.getTime() / 86_400_000);
  return dashboardQuotes[Math.abs(day) % dashboardQuotes.length];
}
