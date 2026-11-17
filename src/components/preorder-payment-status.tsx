import {
  CircleCheck,
  CircleDashed,
  CircleDollarSign,
  CircleHelp,
} from "lucide-react";
import { paymentSummary, type PaymentRow } from "@/shared/lib/payment-schedule";

export function PreorderPaymentStatus({
  total,
  currency,
  rows = [],
  fullyPaid = false,
}: {
  total: number;
  currency: string;
  rows?: PaymentRow[] | null;
  fullyPaid?: boolean;
}) {
  const summary = paymentSummary(total.toFixed(2), rows ?? []);
  const unknown = !fullyPaid && !rows?.length;
  const paid = fullyPaid || summary.state === "paid";
  const partial = summary.state === "partial";
  const label = unknown
    ? "Нет данных об оплате"
    : paid
      ? "Полностью оплачен"
      : partial
        ? "Частично оплачен"
        : "Не оплачен";
  const money = (amount: number) =>
    new Intl.NumberFormat("ru-RU", { style: "currency", currency }).format(
      amount,
    );
  const tooltip = unknown
    ? label
    : `${label}. Оплачено: ${money(fullyPaid ? total : Number(summary.paid))}. Осталось: ${money(fullyPaid ? 0 : Number(summary.remaining))}`;
  const Icon = unknown
    ? CircleHelp
    : paid
      ? CircleCheck
      : partial
        ? CircleDollarSign
        : CircleDashed;

  return (
    <span
      role="img"
      aria-label={tooltip}
      title={tooltip}
      tabIndex={0}
      className={`inline-flex shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        unknown
          ? "text-muted-foreground"
          : paid
            ? "text-emerald-500"
            : partial
              ? "text-warning"
              : "text-muted-foreground"
      }`}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}
