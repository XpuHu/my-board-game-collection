export function validCalendarDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function calendarToIso(value: string) {
  return validCalendarDay(value) ? `${value}T00:00:00.000Z` : null;
}
export function validIsoDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(
      value,
    ) &&
    validCalendarDay(value.slice(0, 10)) &&
    !Number.isNaN(Date.parse(value))
  );
}
export function formatCalendarDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}
type Expected = {
  expectedDate?: string | null;
  expectedDatePrecision: "day" | "month" | "quarter" | "unknown";
};
export function formatExpectedDate(preorder: Expected) {
  if (!preorder.expectedDate || preorder.expectedDatePrecision === "unknown")
    return "Дата неизвестна";
  const date = new Date(preorder.expectedDate);
  if (preorder.expectedDatePrecision === "quarter")
    return `${Math.floor(date.getUTCMonth() / 3) + 1}-й квартал ${date.getUTCFullYear()}`;
  if (preorder.expectedDatePrecision === "month")
    return new Intl.DateTimeFormat("ru-RU", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
  return formatCalendarDate(preorder.expectedDate);
}
export function formatRelativeExpectedDate(
  preorder: Expected,
  now = new Date(),
) {
  if (!preorder.expectedDate || preorder.expectedDatePrecision !== "day")
    return null;
  const today = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const day = Date.parse(`${preorder.expectedDate.slice(0, 10)}T00:00:00.000Z`);
  return new Intl.RelativeTimeFormat("ru-RU", { numeric: "auto" }).format(
    Math.round((day - today) / 86400000),
    "day",
  );
}
