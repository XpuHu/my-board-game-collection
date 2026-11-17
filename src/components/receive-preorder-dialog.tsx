"use client";

import * as React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { calendarToIso } from "@/shared/lib/calendar-date";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

export function ReceivePreorderDialog({
  title,
  saving,
  onClose,
  onSubmit,
}: {
  title: string;
  saving: boolean;
  onClose: () => void;
  onSubmit: (date: string) => Promise<void>;
}) {
  const id = React.useId();
  const [date, setDate] = React.useState(() =>
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Moscow",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()),
  );
  const [error, setError] = React.useState("");
  const busy = React.useRef(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving || busy.current) return;
    const value = calendarToIso(date);
    if (!value) {
      setError("Укажите корректную дату получения");
      return;
    }
    setError("");
    busy.current = true;
    try {
      await onSubmit(value);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Не удалось отметить получение",
      );
    } finally {
      busy.current = false;
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving && !busy.current) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Получение предзаказа</DialogTitle>
          <DialogDescription>
            {title}. Укажите дату фактического получения. Она применяется ко
            всему лоту.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id={id} onSubmit={submit}>
            <Label htmlFor={`${id}-date`}>Дата получения</Label>
            <Input
              id={`${id}-date`}
              className="mt-2"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
              disabled={saving}
            />
            {error ? (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </form>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={onClose}
          >
            Отмена
          </Button>
          <Button type="submit" form={id} disabled={saving} aria-busy={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            )}
            {saving ? "Сохраняем…" : "Отметить полученным"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
