import {
  updatePreorderRequestSchema,
  type PreorderListItemDto,
  type ExpectedDatePrecision,
  type PreorderStatus,
  type UpdatePreorderRequest,
  type PreorderPositionInput,
} from "@/shared/api";
import { calendarToIso } from "@/shared/lib/calendar-date";
export type PreorderEditValues = {
  pricingMode: "lot" | "per_item";
  paymentType: "one_time" | "installments" | "unspecified";
  positionPrices: Record<string, string>;
  shop: string;
  price: string;
  currency: string;
  orderDate: string;
  trackingNumber: string;
  comment: string;
  status: PreorderStatus;
  precision: ExpectedDatePrecision;
  day: string;
  month: string;
  year: string;
  quarter: string;
};
export function preorderEditValues(
  preorder: PreorderListItemDto,
): PreorderEditValues {
  const expected = preorder.expectedDate;
  return {
    pricingMode: preorder.pricingMode ?? "per_item",
    paymentType: preorder.paymentType ?? "unspecified",
    positionPrices: Object.fromEntries(
      (preorder.children ?? []).map((child) => [
        child.id,
        child.priceKnown === false
          ? ""
          : String(child.basePrice ?? child.price.amount),
      ]),
    ),
    shop: preorder.shop,
    price: String(preorder.basePrice ?? preorder.price.amount),
    currency: preorder.price.currency,
    orderDate: preorder.orderDate?.slice(0, 10) ?? "",
    trackingNumber: preorder.trackingNumber ?? "",
    comment: preorder.comment ?? "",
    status: preorder.status,
    precision: preorder.expectedDatePrecision ?? (expected ? "day" : "unknown"),
    day: expected?.slice(0, 10) ?? "",
    month: expected?.slice(0, 7) ?? "",
    year: expected?.slice(0, 4) ?? String(new Date().getUTCFullYear()),
    quarter: expected
      ? String(Math.floor(new Date(expected).getUTCMonth() / 3) + 1)
      : "1",
  };
}
export function preorderEditRequest(
  preorder: PreorderListItemDto,
  values: PreorderEditValues,
  additions: PreorderPositionInput[] = [],
): UpdatePreorderRequest {
  if (
    values.pricingMode === "per_item" &&
    additions.some(
      (item) =>
        item.price === undefined ||
        !Number.isFinite(item.price) ||
        item.price < 0,
    )
  )
    throw new Error("Укажите стоимость каждого добавляемого дополнения");
  if (!values.price.trim()) throw new Error("Укажите стоимость предзаказа");
  const date =
    values.precision === "day"
      ? values.day
      : values.precision === "month"
        ? `${values.month}-01`
        : values.precision === "quarter" && /^[1-4]$/.test(values.quarter)
          ? `${values.year}-${String((Number(values.quarter) - 1) * 3 + 1).padStart(2, "0")}-01`
          : "";
  const expectedDate =
    values.precision === "unknown" ? null : calendarToIso(date);
  if (values.precision !== "unknown" && !expectedDate)
    throw new Error("Укажите корректный ожидаемый срок");
  const orderDate = values.orderDate ? calendarToIso(values.orderDate) : null;
  if (values.orderDate && !orderDate)
    throw new Error("Укажите корректную дату заказа");
  if (
    ["received", "cancelled"].includes(preorder.status) &&
    values.status !== preorder.status
  )
    throw new Error(
      "Для возврата полученного предзаказа используйте действие «Вернуть в активные»",
    );
  const positionPrices: { preorderId: string; price: number }[] = [];
  if (values.pricingMode === "per_item")
    for (const child of preorder.children ?? []) {
      const value = values.positionPrices[child.id];
      if (
        !value?.trim() ||
        !Number.isFinite(Number(value)) ||
        Number(value) < 0
      )
        throw new Error(`Укажите стоимость позиции «${child.item.title}»`);
      if (
        child.priceKnown === false ||
        Number(value) !== (child.basePrice ?? child.price.amount)
      )
        positionPrices.push({ preorderId: child.id, price: Number(value) });
    }
  const parsed = updatePreorderRequestSchema.safeParse({
    pricingMode: values.pricingMode,
    paymentType: values.paymentType,
    shop: values.shop,
    price: Number(values.price),
    currency: values.currency,
    orderDate,
    expectedDate,
    expectedDatePrecision: values.precision,
    trackingNumber: values.trackingNumber.trim() || null,
    comment: values.comment.trim() || null,
    status: values.status,
  });
  if (!parsed.success)
    throw new Error(
      "Проверьте магазин, стоимость и код валюты (например, RUB)",
    );
  const candidate = parsed.data;
  const previous: UpdatePreorderRequest = {
    pricingMode: preorder.pricingMode ?? "per_item",
    paymentType: preorder.paymentType ?? "unspecified",
    shop: preorder.shop,
    price: preorder.basePrice ?? preorder.price.amount,
    currency: preorder.price.currency,
    orderDate: preorder.orderDate
      ? calendarToIso(preorder.orderDate.slice(0, 10))
      : null,
    expectedDate: preorder.expectedDate
      ? calendarToIso(preorder.expectedDate.slice(0, 10))
      : null,
    expectedDatePrecision: preorder.expectedDatePrecision,
    trackingNumber: preorder.trackingNumber ?? null,
    comment: preorder.comment ?? null,
    status: preorder.status,
  };
  const patch: UpdatePreorderRequest = {};
  for (const key of [
    "pricingMode",
    "paymentType",
    "shop",
    "price",
    "currency",
    "orderDate",
    "trackingNumber",
    "comment",
    "status",
  ] as const) {
    if (candidate[key] !== previous[key])
      Object.assign(patch, { [key]: candidate[key] });
  }
  if (
    candidate.expectedDate !== previous.expectedDate ||
    candidate.expectedDatePrecision !== previous.expectedDatePrecision
  ) {
    patch.expectedDate = candidate.expectedDate;
    patch.expectedDatePrecision = candidate.expectedDatePrecision;
  }
  if (patch.pricingMode) patch.price = candidate.price;
  if (positionPrices.length) patch.positionPrices = positionPrices;
  if (additions.length) patch.expansions = additions;
  return patch;
}
