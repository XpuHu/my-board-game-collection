export const dashboardQuotes = [
  {
    text: "Нет такой плохой игры, которая не стала бы лучше после хорошей партии.",
    author: "Том Вассел",
  },
] as const;

export function quoteForDate(date = new Date()) {
  const day = Math.floor(date.getTime() / 86_400_000);
  return dashboardQuotes[Math.abs(day) % dashboardQuotes.length];
}
