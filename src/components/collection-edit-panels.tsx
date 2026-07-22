"use client";

import * as React from "react";
import { Save } from "lucide-react";

import { useToast } from "@/components/toast-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/shared/api/client";
import type { CollectionItemDetailDto } from "@/shared/api";

export function CollectionEditPanels({
  details,
  onSaved,
}: {
  details: CollectionItemDetailDto;
  onSaved: () => void;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <OwnerDataForm details={details} onSaved={onSaved} />
      <ReferenceDataForm details={details} onSaved={onSaved} />
    </div>
  );
}

function OwnerDataForm({ details, onSaved }: FormProps) {
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      await apiRequest(
        `/api/items/${encodeURIComponent(details.item.id)}/user-item`,
        {
          method: "PATCH",
          body: JSON.stringify({
            location: textOrNull(form.get("location")),
            personalRating: numberOrNull(form.get("personalRating")),
            notes: textOrNull(form.get("notes")),
            favorite: form.get("favorite") === "on",
          }),
        },
      );
      toast({ title: "Данные владельца сохранены", variant: "success" });
      onSaved();
    } catch (error) {
      toast({ title: "Не удалось сохранить данные", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="rounded-xl border bg-card p-5">
      <summary className="cursor-pointer font-semibold">Пользовательские данные</summary>
      <form onSubmit={submit} className="mt-5 grid gap-4">
        <label className="flex items-center gap-3 rounded-lg border p-3 text-sm">
          <input name="favorite" type="checkbox" defaultChecked={details.userItem.favorite} />
          В избранном
        </label>
        <div><Label htmlFor="owner-location">Место хранения</Label><Input id="owner-location" name="location" className="mt-2" defaultValue={details.userItem.location ?? ""} /></div>
        <div><Label htmlFor="owner-rating">Личная оценка</Label><Input id="owner-rating" name="personalRating" type="number" min={1} max={10} className="mt-2" defaultValue={details.userItem.personalRating ?? ""} /></div>
        <div><Label htmlFor="owner-notes">Личная заметка</Label><Textarea id="owner-notes" name="notes" className="mt-2" defaultValue={details.userItem.notes ?? ""} /></div>
        <Button type="submit" disabled={saving} className="justify-self-start"><Save className="h-4 w-4" /> {saving ? "Сохраняем" : "Сохранить"}</Button>
      </form>
    </details>
  );
}

function ReferenceDataForm({ details, onSaved }: FormProps) {
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      await apiRequest(`/api/items/${encodeURIComponent(details.item.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: String(form.get("title") ?? "").trim(),
          originalTitle: textOrNull(form.get("originalTitle")),
          year: numberOrNull(form.get("year")),
          description: textOrNull(form.get("description")),
        }),
      });
      toast({ title: "Справочные данные сохранены", variant: "success" });
      onSaved();
    } catch (error) {
      toast({ title: "Не удалось сохранить справочные данные", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="rounded-xl border bg-card p-5">
      <summary className="cursor-pointer font-semibold">Справочные данные Item</summary>
      <form onSubmit={submit} className="mt-5 grid gap-4">
        <div><Label htmlFor="reference-title">Название</Label><Input id="reference-title" name="title" className="mt-2" required defaultValue={details.item.title} /></div>
        <div><Label htmlFor="reference-original-title">Оригинальное название</Label><Input id="reference-original-title" name="originalTitle" className="mt-2" defaultValue={details.item.originalTitle ?? ""} /></div>
        <div><Label htmlFor="reference-year">Год</Label><Input id="reference-year" name="year" type="number" min={1900} max={2100} className="mt-2" defaultValue={details.item.year ?? ""} /></div>
        <div><Label htmlFor="reference-description">Описание</Label><Textarea id="reference-description" name="description" className="mt-2" defaultValue={details.item.description ?? ""} /></div>
        <Button type="submit" disabled={saving} className="justify-self-start"><Save className="h-4 w-4" /> {saving ? "Сохраняем" : "Сохранить"}</Button>
      </form>
    </details>
  );
}

type FormProps = { details: CollectionItemDetailDto; onSaved: () => void };
function textOrNull(value: FormDataEntryValue | null) { const text = String(value ?? "").trim(); return text || null; }
function numberOrNull(value: FormDataEntryValue | null) { const text = String(value ?? "").trim(); if (!text) return null; const parsed = Number(text); return Number.isFinite(parsed) ? parsed : null; }
