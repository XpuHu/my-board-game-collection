"use client";
import * as React from "react";
import {
  paymentScheduleSchema,
  paymentSummary,
  type PaymentRow,
} from "@/shared/lib/payment-schedule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
const formatMoney = (amount: number, currency: string) =>
  new Intl.NumberFormat("ru-RU", { style: "currency", currency }).format(
    amount,
  );

export function PaymentSchedule({
  id,
  total,
  currency,
  initialRows,
  initialVersion,
  fullyPaid = false,
  status,
  open: controlledOpen,
  panelId,
  onSaved,
}: {
  id: string;
  total: number;
  currency: string;
  initialRows?: PaymentRow[] | null;
  initialVersion?: number;
  fullyPaid?: boolean;
  status: string;
  open?: boolean;
  panelId?: string;
  onSaved?: () => void;
}) {
  const [rows, setRows] = React.useState<PaymentRow[]>(initialRows ?? []);
  const [saved, setSaved] = React.useState<PaymentRow[]>(initialRows ?? []);
  const [version, setVersion] = React.useState(initialVersion ?? 0);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [internalOpen, setOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const summary = paymentSummary(total.toFixed(2), saved);
  const money = (value: string) => formatMoney(Number(value), currency);
  const set = (id: string, patch: Partial<PaymentRow>) =>
    setRows((old) =>
      old.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  async function save() {
    const parsed = paymentScheduleSchema.safeParse(rows);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Проверьте график");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/preorders/${id}/payments`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version, rows: parsed.data }),
      });
      if (!response.ok)
        throw new Error(
          response.status === 409
            ? "График изменился. Обновите страницу перед повтором."
            : "Не удалось сохранить график. При потере ответа обновите страницу перед повтором.",
        );
      const result = await response.json();
      setVersion(result.version);
      setSaved(result.rows);
      setRows(result.rows);
      onSaved?.();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ошибка сохранения");
    } finally {
      setBusy(false);
    }
  }
  if (fullyPaid && controlledOpen !== undefined) return null;
  if (fullyPaid)
    return (
      <p className="mx-4 mb-4 rounded-lg border p-3 text-sm" role="status">
        {["received", "cancelled"].includes(status)
          ? "Полностью оплачен"
          : "Полностью оплачен · ожидается доставка"}
      </p>
    );
  if (controlledOpen !== undefined && !open) return null;
  return (
    <section id={panelId} className="mx-4 mb-4 rounded-lg border p-3 text-sm">
      {saved.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-3" aria-live="polite">
          <strong>
            {summary.state === "paid"
              ? ["received", "cancelled"].includes(status)
                ? "Оплачено"
                : "Оплачено · ожидается доставка"
              : summary.state === "partial"
                ? "Частично оплачено"
                : "Не оплачено"}
          </strong>
          <span>
            Оплачено: {money(summary.paid)} · Осталось:{" "}
            {money(summary.remaining)}
          </span>
          {summary.next ? (
            <span>
              Следующий платёж: {summary.next.date} ·{" "}
              {money(summary.next.amount)}
              {summary.next.date < new Date().toISOString().slice(0, 10)
                ? " · Просрочен"
                : ""}
            </span>
          ) : null}
          {!summary.planMatches ? (
            <span className="text-warning">
              Сумма графика отличается от стоимости лота
            </span>
          ) : null}
          {Number(summary.excess) > 0 ? (
            <span>Превышение оплаты: {money(summary.excess)}</span>
          ) : null}
        </div>
      ) : null}
      {controlledOpen === undefined ? (
        <Button type="button" variant="outline" onClick={() => setOpen(!open)}>
          {open ? "Свернуть график" : "График оплаты"}
        </Button>
      ) : null}
      {open ? (
        <div className="mt-3 grid gap-3">
          <p className="text-muted-foreground">
            Даты и суммы задаются вручную. Отметка означает оплату всей суммы
            строки.
          </p>
          <fieldset disabled={busy} className="grid gap-2">
            {rows.map((row, index) => (
              <div
                key={row.id}
                className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]"
              >
                <label className="grid gap-1">
                  Дата {index + 1}
                  <Input
                    type="date"
                    value={row.date}
                    onChange={(e) => set(row.id, { date: e.target.value })}
                  />
                </label>
                <label className="grid gap-1 text-right">
                  Сумма, {currency}
                  <Input
                    className="text-right"
                    inputMode="decimal"
                    value={row.amount}
                    onChange={(e) =>
                      set(row.id, { amount: e.target.value.replace(",", ".") })
                    }
                  />
                </label>
                <label className="flex items-center gap-2 py-2">
                  <input
                    type="checkbox"
                    checked={row.paid}
                    onChange={(e) => set(row.id, { paid: e.target.checked })}
                  />
                  Оплачено
                </label>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() =>
                    setRows((old) => old.filter((item) => item.id !== row.id))
                  }
                >
                  Удалить
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setRows((old) => [
                  ...old,
                  {
                    id: crypto.randomUUID(),
                    date: "",
                    amount: "",
                    paid: false,
                  },
                ])
              }
              disabled={rows.length >= 120}
            >
              Добавить платёж
            </Button>
            <Button type="button" onClick={() => void save()}>
              Сохранить график
            </Button>
          </fieldset>
          {error ? (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
