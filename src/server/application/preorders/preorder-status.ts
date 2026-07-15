import type {
  ExpectedDatePrecision,
  PreorderStatus,
  PreorderUiStatus,
} from "@/shared/api";

type PreorderStatusSource = {
  status: PreorderStatus | string;
  expectedDate?: Date | null;
  expectedDatePrecision: ExpectedDatePrecision;
};

export function getPreorderUiStatus(
  preorder: PreorderStatusSource,
  now = new Date(),
): PreorderUiStatus {
  if (preorder.status === "received") return "received";
  if (preorder.status === "cancelled") return "cancelled";
  if (!preorder.expectedDate || preorder.expectedDatePrecision === "unknown") {
    return "active";
  }

  return now.getTime() >
    expectedDateBoundary(
      preorder.expectedDate,
      preorder.expectedDatePrecision,
    )
    ? "delayed"
    : "active";
}

export function expectedDateBoundary(
  expectedDate: Date,
  precision: Exclude<ExpectedDatePrecision, "unknown">,
) {
  const year = expectedDate.getUTCFullYear();
  const month = expectedDate.getUTCMonth();

  if (precision === "day") {
    return Date.UTC(year, month, expectedDate.getUTCDate() + 1) - 1;
  }

  if (precision === "month") {
    return Date.UTC(year, month + 1, 1) - 1;
  }

  const nextQuarterMonth = Math.floor(month / 3) * 3 + 3;
  return Date.UTC(year, nextQuarterMonth, 1) - 1;
}
