"use client";
import { calendarToIso } from "@/shared/lib/calendar-date";

import * as React from "react";
import { Save } from "lucide-react";

import { useToast } from "@/components/toast-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updatePreorderExpectedDate } from "@/features/preorders/api";
import type { ExpectedDatePrecision, PreorderListItemDto } from "@/shared/api";

export function ExpectedDateDialog({
  preorder,
  open,
  onOpenChange,
  onSaved,
}: {
  preorder: PreorderListItemDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);
  const [precision, setPrecision] = React.useState<ExpectedDatePrecision>(
    preorder?.expectedDatePrecision ??
      (preorder?.expectedDate ? "day" : "unknown"),
  );
  const [date, setDate] = React.useState(
    preorder?.expectedDate?.slice(0, 10) ?? "",
  );
  const [month, setMonth] = React.useState(
    preorder?.expectedDate?.slice(0, 7) ?? "",
  );
  const [quarterYear, setQuarterYear] = React.useState(
    preorder?.expectedDate?.slice(0, 4) ?? String(new Date().getUTCFullYear()),
  );
  const [quarter, setQuarter] = React.useState(
    preorder?.expectedDate
      ? String(
          Math.floor(new Date(preorder.expectedDate).getUTCMonth() / 3) + 1,
        )
      : "1",
  );
  const [reason, setReason] = React.useState("");
  const [comment, setComment] = React.useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preorder) return;
    const expectedDate = expectedDateForPrecision({
      precision,
      date,
      month,
      quarterYear,
      quarter,
    });
    if (precision !== "unknown" && !expectedDate) {
      toast({ title: "Укажите ожидаемый период", variant: "error" });
      return;
    }

    setSaving(true);
    try {
      await updatePreorderExpectedDate(preorder.id, {
        expectedDate,
        expectedDatePrecision: precision,
        reason: reason.trim() || null,
        comment: comment.trim() || null,
      });
      toast({ title: "Дата предзаказа обновлена", variant: "success" });
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      toast({
        title: "Не удалось изменить дату",
        description: error instanceof Error ? error.message : undefined,
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Изменить ожидаемую дату</DialogTitle>
          <DialogDescription>
            {preorder?.item.title ?? "Предзаказ"}. Изменение сохранится в
            истории.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="contents">
          <DialogBody className="grid gap-4">
            <div>
              <Label htmlFor="expected-date-precision">Точность срока</Label>
              <select
                id="expected-date-precision"
                className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={precision}
                onChange={(event) =>
                  setPrecision(event.target.value as ExpectedDatePrecision)
                }
              >
                <option value="day">Точный день</option>
                <option value="month">Месяц</option>
                <option value="quarter">Квартал</option>
                <option value="unknown">Дата неизвестна</option>
              </select>
            </div>
            {precision === "day" ? (
              <div>
                <Label htmlFor="expected-date">Ожидаемая дата</Label>
                <Input
                  id="expected-date"
                  type="date"
                  className="mt-2"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>
            ) : null}
            {precision === "month" ? (
              <div>
                <Label htmlFor="expected-month">Ожидаемый месяц</Label>
                <Input
                  id="expected-month"
                  type="month"
                  className="mt-2"
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                />
              </div>
            ) : null}
            {precision === "quarter" ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="expected-quarter-year">Год</Label>
                  <Input
                    id="expected-quarter-year"
                    type="number"
                    min={1900}
                    max={2200}
                    className="mt-2"
                    value={quarterYear}
                    onChange={(event) => setQuarterYear(event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="expected-quarter">Квартал</Label>
                  <select
                    id="expected-quarter"
                    className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={quarter}
                    onChange={(event) => setQuarter(event.target.value)}
                  >
                    <option value="1">I квартал</option>
                    <option value="2">II квартал</option>
                    <option value="3">III квартал</option>
                    <option value="4">IV квартал</option>
                  </select>
                </div>
              </div>
            ) : null}
            {precision === "unknown" ? (
              <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                Срок останется неизвестным; календарная дата храниться не будет.
              </p>
            ) : null}
            <div>
              <Label htmlFor="expected-date-reason">Причина изменения</Label>
              <Input
                id="expected-date-reason"
                className="mt-2"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Перенос издателем, доставка, таможня"
              />
            </div>
            <div>
              <Label htmlFor="expected-date-comment">Комментарий</Label>
              <Textarea
                id="expected-date-comment"
                className="mt-2"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? "Сохраняем" : "Сохранить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function expectedDateForPrecision({
  precision,
  date,
  month,
  quarterYear,
  quarter,
}: {
  precision: ExpectedDatePrecision;
  date: string;
  month: string;
  quarterYear: string;
  quarter: string;
}) {
  if (precision === "unknown") return null;
  const dateOnly =
    precision === "day"
      ? date
      : precision === "month"
        ? month && `${month}-01`
        : /^\d{4}$/.test(quarterYear)
          ? `${quarterYear}-${String((Number(quarter) - 1) * 3 + 1).padStart(2, "0")}-01`
          : "";
  return dateOnly ? calendarToIso(dateOnly) : null;
}
