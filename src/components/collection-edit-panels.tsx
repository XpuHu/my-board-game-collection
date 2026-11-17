"use client";
import { Dropdown } from "@/components/ui/dropdown";
import { PublisherPicker } from "@/components/publisher-picker";
import { useProductFeatures } from "@/components/product-features-provider";
import { usePendingCommand } from "@/shared/hooks/use-pending-command";

import * as React from "react";
import {
  AlertTriangle,
  ExternalLink,
  Heart,
  ImageIcon,
  Link2,
  Plus,
  RefreshCw,
  Save,
  Tags,
  Trash2,
} from "lucide-react";

import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { Rating } from "@/components/rating";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/shared/api/client";
import type {
  CollectionCardDto,
  CollectionItemDetailDto,
  ItemRelationType,
  ItemTypeDto,
  LinkType,
  PaginatedResponse,
  ProviderCode,
  SyncItemChangeDto,
  SyncItemField,
  SyncItemResponse,
  TagDto,
  UserItemLifecycleStatus,
} from "@/shared/api";

export type CollectionEditMode = "owner" | "reference";

export function CollectionEditPanels({
  details,
  mode,
  open,
  onOpenChange,
  onSaved,
}: {
  details: CollectionItemDetailDto;
  mode: CollectionEditMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (result?: EditSavedResult) => void;
}) {
  const [dirty, setDirty] = React.useState(false);
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);

  function requestOpenChange(nextOpen: boolean) {
    if (!nextOpen && dirty) {
      setConfirmDiscard(true);
      return;
    }
    onOpenChange(nextOpen);
  }

  function closeAfterSave(result?: EditSavedResult) {
    setDirty(false);
    onOpenChange(false);
    onSaved(result);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={requestOpenChange}>
        <DialogContent
          className={mode === "owner" ? "sm:max-w-xl" : "sm:max-w-3xl"}
        >
          {mode === "owner" ? (
            <OwnerDataForm
              details={details}
              onCancel={() => requestOpenChange(false)}
              onDirtyChange={setDirty}
              onSaved={closeAfterSave}
            />
          ) : (
            <ReferenceDataForm
              details={details}
              onCancel={() => requestOpenChange(false)}
              onDirtyChange={setDirty}
              onSaved={closeAfterSave}
            />
          )}
        </DialogContent>
      </Dialog>
      <ConfirmationDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Выйти без сохранения?"
        description="Внесённые изменения будут потеряны."
        confirmLabel="Выйти без сохранения"
        destructive
        onConfirm={() => {
          setDirty(false);
          onOpenChange(false);
        }}
      />
    </>
  );
}

function OwnerDataForm({
  details,
  onCancel,
  onDirtyChange,
  onSaved,
}: FormProps) {
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const features = useProductFeatures();
  const initialAvailability = details.userItem.owned
    ? "collection"
    : features.wishlist && details.userItem.wishlist
      ? "wishlist"
      : "none";
  const [availability, setAvailability] = React.useState<
    "collection" | "wishlist" | "none"
  >(initialAvailability);
  const [status, setStatus] = React.useState(details.userItem.lifecycleStatus);
  const [location, setLocation] = React.useState(
    details.userItem.location ?? "",
  );
  const [rating, setRating] = React.useState(
    details.userItem.personalRating ?? 0,
  );
  const [favorite, setFavorite] = React.useState(details.userItem.favorite);
  const [notes, setNotes] = React.useState(details.userItem.notes ?? "");
  const [allTags, setAllTags] = React.useState<TagDto[]>(details.userItem.tags);
  const [selectedTagIds, setSelectedTagIds] = React.useState(
    () => new Set(details.userItem.tags.map(({ id }) => id)),
  );
  const [newTagName, setNewTagName] = React.useState("");
  const [creatingTag, setCreatingTag] = React.useState(false);
  const [tagError, setTagError] = React.useState<string | null>(null);
  const initialTagIds = React.useMemo(
    () => details.userItem.tags.map(({ id }) => id).sort(),
    [details.userItem.tags],
  );
  const dirty =
    availability !== initialAvailability ||
    status !== details.userItem.lifecycleStatus ||
    location !== (details.userItem.location ?? "") ||
    rating !== (details.userItem.personalRating ?? 0) ||
    favorite !== details.userItem.favorite ||
    notes !== (details.userItem.notes ?? "") ||
    JSON.stringify(Array.from(selectedTagIds).sort()) !==
      JSON.stringify(initialTagIds);

  React.useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  React.useEffect(() => {
    let active = true;

    apiRequest<TagDto[]>("/api/tags")
      .then((tags) => {
        if (active) setAllTags(tags);
      })
      .catch(() => {
        // Existing tags stay editable even if the optional tag directory fails.
      });

    return () => {
      active = false;
    };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await apiRequest(
        `/api/items/${encodeURIComponent(details.item.id)}/user-item`,
        {
          method: "PATCH",
          body: JSON.stringify({
            owned: availability === "collection",
            wishlist: features.wishlist
              ? availability === "wishlist"
              : details.userItem.wishlist && availability !== "collection",
            status,
            location: textOrNull(location),
            personalRating: rating || null,
            notes: textOrNull(notes),
            favorite,
            tagIds: Array.from(selectedTagIds),
          }),
        },
      );
      toast({ title: "Личные данные сохранены", variant: "success" });
      onSaved({
        status,
        destination:
          availability === "wishlist" && features.wishlist
            ? `/wishlist/${details.item.id}`
            : availability === "none"
              ? "/collection"
              : undefined,
      });
    } catch (error) {
      setError(errorMessage(error) ?? "Повторите попытку.");
      toast({
        title: "Не удалось сохранить личные данные",
        description: errorMessage(error),
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds((current) => {
      const next = new Set(current);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }

  async function createTag() {
    const name = newTagName.trim();
    if (!name) {
      setTagError("Введите название тега.");
      return;
    }

    const existingTag = allTags.find(
      (tag) =>
        tag.name.toLocaleLowerCase("ru") === name.toLocaleLowerCase("ru"),
    );
    if (existingTag) {
      setSelectedTagIds((current) => new Set(current).add(existingTag.id));
      setNewTagName("");
      setTagError(null);
      return;
    }

    setCreatingTag(true);
    setTagError(null);
    try {
      const tag = await apiRequest<TagDto>("/api/tags", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setAllTags((current) =>
        [...current.filter(({ id }) => id !== tag.id), tag].sort(
          (left, right) => left.name.localeCompare(right.name, "ru"),
        ),
      );
      setSelectedTagIds((current) => new Set(current).add(tag.id));
      setNewTagName("");
    } catch (error) {
      setTagError(errorMessage(error) ?? "Не удалось добавить тег.");
    } finally {
      setCreatingTag(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Редактировать личные данные</DialogTitle>
        <DialogDescription>
          Эти изменения относятся только к вашей коллекции и не меняют
          справочную карточку игры.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="contents">
        <DialogBody className="grid gap-5">
          {error ? <FormError message={error} /> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="owner-availability">Наличие</Label>
              <Select
                value={availability}
                onValueChange={(value) => {
                  const nextAvailability = value as typeof availability;
                  setAvailability(nextAvailability);
                  if (nextAvailability !== "collection") {
                    setStatus("active");
                  }
                }}
              >
                <SelectTrigger
                  id="owner-availability"
                  className="mt-2 border-[var(--border-subtle)] focus:ring-1"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="collection">В коллекции</SelectItem>
                  {features.wishlist ? (
                    <SelectItem value="wishlist">В wishlist</SelectItem>
                  ) : null}
                  <SelectItem value="none">Не в коллекции</SelectItem>
                </SelectContent>
              </Select>
              {availability !== "collection" ? (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  После сохранения игра исчезнет из коллекции, связанные данные
                  сохранятся.
                </p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="owner-status">Статус</Label>
              <Select
                value={status}
                disabled={availability !== "collection"}
                onValueChange={(value) =>
                  setStatus(value as UserItemLifecycleStatus)
                }
              >
                <SelectTrigger
                  id="owner-status"
                  className="mt-2 border-[var(--border-subtle)] focus:ring-1"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Активна</SelectItem>
                  <SelectItem value="for_sale">На продажу</SelectItem>
                  <SelectItem value="sold">Продана</SelectItem>
                  <SelectItem value="archived">Архивирована</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="owner-location">Место хранения</Label>
            <Input
              id="owner-location"
              className="mt-2 border-[var(--border-subtle)] focus-visible:ring-1"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Например, шкаф в гостиной"
            />
          </div>

          <div className="grid grid-cols-2 items-center gap-2">
            <button
              type="button"
              aria-pressed={favorite}
              className="inline-flex min-h-10 items-center gap-2 rounded-md px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              onClick={() => setFavorite((current) => !current)}
            >
              <Heart
                aria-hidden="true"
                className="h-5 w-5 text-[var(--accent-primary-hover)]"
                fill={favorite ? "currentColor" : "none"}
              />
              В избранном
            </button>
            <div className="flex min-w-0 items-center justify-end">
              <RatingSlider value={rating} onChange={setRating} />
            </div>
          </div>

          <fieldset>
            <legend className="flex items-center gap-2 text-sm font-medium">
              <Tags className="h-4 w-4" />
              Пользовательские теги
            </legend>
            {allTags.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {allTags.map((tag) => (
                  <label
                    key={tag.id}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full border bg-background px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-[var(--accent-soft)]"
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={selectedTagIds.has(tag.id)}
                      onChange={() => toggleTag(tag.id)}
                    />
                    {tag.name}
                  </label>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Теги ещё не созданы.
              </p>
            )}
            <div className="mt-3 flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <Label htmlFor="owner-new-tag" className="sr-only">
                  Название нового тега
                </Label>
                <Input
                  id="owner-new-tag"
                  value={newTagName}
                  disabled={creatingTag}
                  placeholder="Новый тег"
                  aria-invalid={Boolean(tagError)}
                  aria-describedby={
                    tagError ? "owner-new-tag-error" : undefined
                  }
                  className="border-[var(--border-subtle)] focus-visible:ring-1"
                  onChange={(event) => {
                    setNewTagName(event.target.value);
                    if (tagError) setTagError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void createTag();
                    }
                  }}
                />
                {tagError ? (
                  <p
                    id="owner-new-tag-error"
                    className="mt-1.5 text-xs text-destructive"
                  >
                    {tagError}
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={creatingTag || !newTagName.trim()}
                onClick={() => void createTag()}
              >
                <Plus className="h-4 w-4" />
                {creatingTag ? "Добавление…" : "Добавить"}
              </Button>
            </div>
          </fieldset>

          <div>
            <Label htmlFor="owner-notes">Личная заметка</Label>
            <Textarea
              id="owner-notes"
              name="notes"
              className="mt-2 min-h-28 border-[var(--border-subtle)] focus-visible:ring-1"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Что важно помнить об этой игре?"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Это короткая заметка в карточке. Отдельные записи создаются во
              вкладке «Заметки».
            </p>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Отмена
          </Button>
          <Button type="submit" disabled={saving || !dirty}>
            <Save className="h-4 w-4" />
            {saving ? "Сохранение…" : "Сохранить"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

function RatingSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const [hoverValue, setHoverValue] = React.useState<number | null>(null);
  const previewValue = hoverValue ?? value;

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    option: number,
  ) {
    let nextValue: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      nextValue = Math.min(10, option + 1);
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      nextValue = Math.max(1, option - 1);
    }
    if (nextValue == null) return;
    event.preventDefault();
    onChange(nextValue);
    setHoverValue(nextValue);
  }

  return (
    <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
      <div
        role="radiogroup"
        aria-label="Личная оценка"
        className="relative inline-flex min-h-10 items-center"
        onMouseLeave={() => setHoverValue(null)}
      >
        <Rating
          value={previewValue / 2}
          tone="accent"
          size="lg"
          label={
            previewValue
              ? `Личная оценка: ${previewValue} из 10`
              : "Оценка не выбрана"
          }
        />
        <div className="absolute inset-0 grid grid-cols-5 gap-1">
          {Array.from({ length: 5 }, (_, starIndex) => (
            <span key={starIndex} className="grid grid-cols-2">
              {[1, 2].map((half) => {
                const option = starIndex * 2 + half;
                return (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-label={`${option} из 10`}
                    aria-checked={value === option}
                    tabIndex={
                      value === option || (!value && option === 1) ? 0 : -1
                    }
                    className="h-full min-w-3 cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    onMouseEnter={() => setHoverValue(option)}
                    onFocus={() => setHoverValue(option)}
                    onBlur={() => setHoverValue(null)}
                    onClick={() => onChange(option)}
                    onKeyDown={(event) => handleKeyDown(event, option)}
                  />
                );
              })}
            </span>
          ))}
        </div>
      </div>
      <span className="min-w-12 text-sm font-medium tabular-nums">
        {value ? `${value} / 10` : ""}
      </span>
      {value ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => onChange(0)}
        >
          Очистить
        </Button>
      ) : null}
    </div>
  );
}

function ReferenceDataForm({
  details,
  onCancel,
  onDirtyChange,
  onSaved,
}: FormProps) {
  const { toast } = useToast();
  const command = usePendingCommand(
    `reference-command:${details.item.id}`,
    `/api/items/${details.item.id}/reference-data`,
    "PATCH",
  );
  const [saving, setSaving] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [baseDirty, setBaseDirty] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [itemTypes, setItemTypes] = React.useState<ItemTypeDto[]>([
    details.item.type,
  ]);
  const [images, setImages] = React.useState<ReferenceImageDraft[]>(() =>
    details.item.images
      .filter(({ type }) => type === "reference")
      .map((image) => ({
        id: image.id,
        url: image.url ?? "",
        caption: image.caption ?? "",
        provider: image.provider ?? "manual",
      })),
  );
  const [links, setLinks] = React.useState<ReferenceLinkDraft[]>(() =>
    details.item.links.map((link) => ({
      id: link.id,
      url: link.url,
      title: link.title ?? "",
      type: link.type,
    })),
  );
  const [references, setReferences] = React.useState<ReferenceSourceDraft[]>(
    () =>
      details.item.externalReferences.map((reference) => ({
        id: reference.id,
        provider: reference.provider,
        externalId: reference.externalId,
        url: reference.url ?? "",
        lastSync: reference.lastSync ?? null,
      })),
  );
  const [relations, setRelations] = React.useState<ReferenceRelationDraft[]>(
    () =>
      details.item.relations.map((relation) => ({
        id: relation.id,
        relatedItemId: relation.relatedItem.id,
        relatedItemTitle: relation.relatedItem.title,
        direction: relation.direction,
        relationType: relation.relationType,
        comment: relation.comment ?? "",
      })),
  );
  const [relationCandidates, setRelationCandidates] = React.useState<
    CollectionCardDto[]
  >([]);
  const [removedImageIds, setRemovedImageIds] = React.useState<string[]>([]);
  const [removedLinkIds, setRemovedLinkIds] = React.useState<string[]>([]);
  const [removedReferenceIds, setRemovedReferenceIds] = React.useState<
    string[]
  >([]);
  const [removedRelationIds, setRemovedRelationIds] = React.useState<string[]>(
    [],
  );
  const [syncProvider, setSyncProvider] = React.useState<ProviderCode | null>(
    () =>
      details.item.externalReferences.find(
        ({ provider }) => provider !== "manual",
      )?.provider ?? null,
  );
  const [syncPreview, setSyncPreview] = React.useState<SyncItemResponse | null>(
    null,
  );
  const [selectedSyncFields, setSelectedSyncFields] = React.useState(
    () => new Set<SyncItemField>(),
  );
  const [initialResources] = React.useState(() =>
    serializeResources(images, links, references, relations, [], [], [], []),
  );
  const resourcesDirty =
    serializeResources(
      images,
      links,
      references,
      relations,
      removedImageIds,
      removedLinkIds,
      removedReferenceIds,
      removedRelationIds,
    ) !== initialResources;
  const dirty = baseDirty || resourcesDirty;

  React.useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  React.useEffect(() => {
    let active = true;
    apiRequest<ItemTypeDto[]>("/api/item-types")
      .then((types) => {
        if (active) setItemTypes(types);
      })
      .catch(() => {
        // The current type remains available if the directory cannot load.
      });

    apiRequest<PaginatedResponse<CollectionCardDto>>(
      "/api/collection?page=1&pageSize=100",
    )
      .then((response) => {
        if (active) {
          setRelationCandidates(
            response.data.filter(({ item }) => item.id !== details.item.id),
          );
        }
      })
      .catch(() => {
        // Existing relations remain removable if candidates cannot load.
      });
    return () => {
      active = false;
    };
  }, [details.item.id]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (command.pending) {
      setSaving(true);
      setError(null);
      try {
        await command.run();
        toast({ title: "Справочные данные сохранены", variant: "success" });
        onSaved();
      } catch (error) {
        setError(errorMessage(error) ?? "Не удалось подтвердить сохранение");
      } finally {
        setSaving(false);
      }
      return;
    }
    const form = new FormData(event.currentTarget);
    const validationErrors = validateReferenceForm(form);
    const resourceError = validateReferenceResources({
      images,
      links,
      references,
      relations,
    });

    if (Object.keys(validationErrors).length || resourceError) {
      setFieldErrors(validationErrors);
      setError(resourceError ?? "Проверьте поля формы.");
      const firstField = Object.keys(validationErrors)[0];
      if (firstField) {
        document.getElementById(`reference-${firstField}`)?.focus();
      }
      return;
    }

    setSaving(true);
    setError(null);
    setFieldErrors({});

    try {
      const initial = JSON.parse(initialResources) as {
        images: ReferenceImageDraft[];
        links: ReferenceLinkDraft[];
        references: ReferenceSourceDraft[];
        relations: ReferenceRelationDraft[];
      };
      const changed = <T extends { id?: string }>(values: T[], before: T[]) =>
        values.filter(
          (value) =>
            !value.id ||
            !sameDraft(
              value,
              before.find(({ id }) => id === value.id),
            ),
        );
      await command.run({
        item: {
          typeId: String(form.get("typeId") ?? details.item.type.id),
          title: String(form.get("title") ?? "").trim(),
          originalTitle: textOrNull(form.get("originalTitle")),
          year: numberOrNull(form.get("year")),
          minPlayers: numberOrNull(form.get("minPlayers")),
          maxPlayers: numberOrNull(form.get("maxPlayers")),
          minPlayTime: numberOrNull(form.get("minPlayTime")),
          maxPlayTime: numberOrNull(form.get("maxPlayTime")),
          minAge: numberOrNull(form.get("minAge")),
          complexity: numberOrNull(form.get("complexity")),
          description: textOrNull(form.get("description")),
          categories: listValue(form.get("categories")),
          mechanics: listValue(form.get("mechanics")),
          designers: listValue(form.get("designers")),
          artists: listValue(form.get("artists")),
          publishers: listValue(form.get("publishers")),
        },
        images: changed(images, initial.images).map((value) => ({
          id: value.id,
          data: {
            type: "reference",
            provider: value.provider,
            url: textOrNull(value.url),
            caption: textOrNull(value.caption),
          },
        })),
        links: changed(links, initial.links).map((value) => ({
          id: value.id,
          data: {
            type: value.type,
            url: value.url.trim(),
            title: textOrNull(value.title),
          },
        })),
        references: changed(references, initial.references).map((value) => ({
          id: value.id,
          data: {
            provider: value.provider,
            externalId: value.externalId.trim(),
            url: textOrNull(value.url),
          },
        })),
        relations: changed(relations, initial.relations).map((value) => ({
          id: value.id,
          data: {
            relatedItemId: value.relatedItemId,
            direction: value.direction,
            relationType: value.relationType,
            comment: textOrNull(value.comment),
          },
        })),
        removedImageIds,
        removedLinkIds,
        removedReferenceIds,
        removedRelationIds,
      });
      toast({ title: "Справочные данные сохранены", variant: "success" });
      onSaved();
    } catch (saveError) {
      setError(errorMessage(saveError) ?? "Повторите попытку.");
      toast({
        title: "Не удалось сохранить справочные данные",
        description: errorMessage(saveError),
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function loadSyncPreview() {
    if (!syncProvider || dirty) return;
    setSyncing(true);
    setError(null);
    try {
      const preview = await apiRequest<SyncItemResponse>(
        `/api/items/${encodeURIComponent(details.item.id)}/sync`,
        {
          method: "POST",
          body: JSON.stringify({ provider: syncProvider, preview: true }),
        },
      );
      setSyncPreview(preview);
      setSelectedSyncFields(
        new Set(
          preview.changes
            .filter(({ selectedByDefault }) => selectedByDefault)
            .map(({ field }) => field),
        ),
      );
    } catch (previewError) {
      setError(errorMessage(previewError) ?? "Не удалось получить изменения.");
    } finally {
      setSyncing(false);
    }
  }

  async function applySyncPreview() {
    if (!syncProvider || !selectedSyncFields.size) return;
    setSyncing(true);
    setError(null);
    try {
      const result = await apiRequest<SyncItemResponse>(
        `/api/items/${encodeURIComponent(details.item.id)}/sync`,
        {
          method: "POST",
          body: JSON.stringify({
            provider: syncProvider,
            fields: Array.from(selectedSyncFields),
          }),
        },
      );
      toast({
        title: "Справочные данные обновлены",
        description: `Применено изменений: ${result.updatedFields.length}.`,
        variant: "success",
      });
      onSaved();
    } catch (syncError) {
      setError(errorMessage(syncError) ?? "Не удалось применить изменения.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Редактировать справочные данные</DialogTitle>
        <DialogDescription>
          Название, параметры и авторы относятся к самой игре. Личная оценка и
          заметки здесь не изменяются.
        </DialogDescription>
      </DialogHeader>
      <form
        onSubmit={submit}
        onChange={(event) => {
          if (
            (event.target as HTMLElement).closest("[data-sync-controls=true]")
          ) {
            return;
          }
          setBaseDirty(true);
          setSyncPreview(null);
        }}
        className="contents"
        noValidate
      >
        <DialogBody className="grid gap-6">
          {command.pending ? (
            <p role="status">
              Предыдущее сохранение ожидает подтверждения. Нажмите «Сохранить»,
              чтобы безопасно повторить именно его.
            </p>
          ) : null}
          <fieldset
            disabled={saving || Boolean(command.pending)}
            className="contents"
          >
            {error ? <FormError message={error} /> : null}

            <FormSection title="Основное">
              <div>
                <Label htmlFor="reference-title">Название</Label>
                <Input
                  id="reference-title"
                  name="title"
                  className="mt-2"
                  aria-invalid={Boolean(fieldErrors.title)}
                  aria-describedby={
                    fieldErrors.title ? "reference-title-error" : undefined
                  }
                  defaultValue={details.item.title}
                />
                <FieldError id="reference-title-error">
                  {fieldErrors.title}
                </FieldError>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="reference-typeId">Тип элемента</Label>
                  <Dropdown
                    id="reference-typeId"
                    name="typeId"
                    defaultValue={details.item.type.id}
                    className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {itemTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </Dropdown>
                </div>
                <Field
                  id="reference-originalTitle"
                  label="Оригинальное название"
                  name="originalTitle"
                  defaultValue={details.item.originalTitle ?? ""}
                />
              </div>
              <div>
                <Label htmlFor="reference-description">Описание</Label>
                <Textarea
                  id="reference-description"
                  name="description"
                  className="mt-2 min-h-36"
                  defaultValue={details.item.description ?? ""}
                />
              </div>
            </FormSection>

            <FormSection title="Характеристики">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="reference-year"
                  label="Год выпуска"
                  name="year"
                  type="number"
                  min="1800"
                  max={new Date().getFullYear() + 10}
                  error={fieldErrors.year}
                  defaultValue={details.item.year ?? ""}
                />
                <Field
                  id="reference-minPlayers"
                  label="Игроков, от"
                  name="minPlayers"
                  type="number"
                  min="1"
                  error={fieldErrors.minPlayers}
                  defaultValue={details.item.minPlayers ?? ""}
                />
                <Field
                  id="reference-maxPlayers"
                  label="Игроков, до"
                  name="maxPlayers"
                  type="number"
                  min="1"
                  error={fieldErrors.maxPlayers}
                  defaultValue={details.item.maxPlayers ?? ""}
                />
                <Field
                  id="reference-minPlayTime"
                  label="Минут, от"
                  name="minPlayTime"
                  type="number"
                  min="1"
                  error={fieldErrors.minPlayTime}
                  defaultValue={details.item.minPlayTime ?? ""}
                />
                <Field
                  id="reference-maxPlayTime"
                  label="Минут, до"
                  name="maxPlayTime"
                  type="number"
                  min="1"
                  error={fieldErrors.maxPlayTime}
                  defaultValue={details.item.maxPlayTime ?? ""}
                />
                <Field
                  id="reference-minAge"
                  label="Возраст"
                  name="minAge"
                  type="number"
                  min="1"
                  error={fieldErrors.minAge}
                  defaultValue={details.item.minAge ?? ""}
                />
                <Field
                  id="reference-complexity"
                  label="Сложность, 0–5"
                  name="complexity"
                  type="number"
                  min="0"
                  max="5"
                  step="0.01"
                  error={fieldErrors.complexity}
                  defaultValue={details.item.complexity ?? ""}
                />
              </div>
            </FormSection>

            <FormSection title="Классификация">
              <ListField
                id="reference-categories"
                label="Категории"
                name="categories"
                values={details.item.categories}
              />
              <ListField
                id="reference-mechanics"
                label="Механики"
                name="mechanics"
                values={details.item.mechanics}
              />
            </FormSection>

            <FormSection title="Авторы и выпуск">
              <ListField
                id="reference-designers"
                label="Дизайнеры"
                name="designers"
                values={details.item.designers}
              />
              <ListField
                id="reference-artists"
                label="Художники"
                name="artists"
                values={details.item.artists}
              />
              <ListField
                id="reference-publishers"
                label="Издатели"
                name="publishers"
                values={details.item.publishers}
              />
            </FormSection>

            <ReferenceRelationsEditor
              relations={relations}
              candidates={relationCandidates}
              onChange={setRelations}
              onRemove={(relation) => {
                if (relation.id) {
                  setRemovedRelationIds((current) => [
                    ...current,
                    relation.id!,
                  ]);
                }
                setRelations((current) =>
                  current.filter((item) => item !== relation),
                );
              }}
            />

            <ReferenceImagesEditor
              images={images}
              onChange={setImages}
              onRemove={(image) => {
                if (image.id) {
                  setRemovedImageIds((current) => [...current, image.id!]);
                }
                setImages((current) =>
                  current.filter((item) => item !== image),
                );
              }}
            />

            <ReferenceLinksEditor
              links={links}
              onChange={setLinks}
              onRemove={(link) => {
                if (link.id) {
                  setRemovedLinkIds((current) => [...current, link.id!]);
                }
                setLinks((current) => current.filter((item) => item !== link));
              }}
            />

            <ReferenceSourcesEditor
              references={references}
              onChange={setReferences}
              onRemove={(reference) => {
                if (reference.id) {
                  setRemovedReferenceIds((current) => [
                    ...current,
                    reference.id!,
                  ]);
                }
                setReferences((current) =>
                  current.filter((item) => item !== reference),
                );
              }}
            />

            <div data-sync-controls="true">
              <SyncEditor
                references={references}
                provider={syncProvider}
                onProviderChange={setSyncProvider}
                preview={syncPreview}
                selectedFields={selectedSyncFields}
                onSelectedFieldsChange={setSelectedSyncFields}
                disabled={dirty || syncing}
                syncing={syncing}
                onPreview={loadSyncPreview}
                onApply={applySyncPreview}
              />
            </div>
          </fieldset>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Отмена
          </Button>
          <Button type="submit" disabled={saving || syncing || !dirty}>
            <Save className="h-4 w-4" />
            {saving ? "Сохранение…" : "Сохранить справочные данные"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

function Field({
  id,
  label,
  error,
  ...props
}: React.ComponentProps<typeof Input> & {
  id: string;
  label: string;
  error?: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        className="mt-2"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}

function ListField({
  id,
  label,
  name,
  values,
}: {
  id: string;
  label: string;
  name: string;
  values: { name: string }[];
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {name === "publishers" ? (
        <PublisherPicker
          id={id}
          name={name}
          defaultValue={values.map((v) => v.name).join(", ")}
        />
      ) : (
        <Input
          id={id}
          name={name}
          className="mt-2"
          defaultValue={values.map(({ name: value }) => value).join(", ")}
          placeholder="Значения через запятую"
        />
      )}
    </div>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 border-b border-[var(--border-subtle)] pb-6 last:border-b-0 last:pb-0">
      <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function FormError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <span>{message}</span>
    </div>
  );
}

function FieldError({
  id,
  children,
}: {
  id: string;
  children?: React.ReactNode;
}) {
  return children ? (
    <p id={id} className="mt-1.5 text-xs text-destructive">
      {children}
    </p>
  ) : null;
}

function ReferenceRelationsEditor({
  relations,
  candidates,
  onChange,
  onRemove,
}: {
  relations: ReferenceRelationDraft[];
  candidates: CollectionCardDto[];
  onChange: React.Dispatch<React.SetStateAction<ReferenceRelationDraft[]>>;
  onRemove: (relation: ReferenceRelationDraft) => void;
}) {
  const availableCandidates = candidates.filter(
    ({ item }) =>
      !relations.some(({ relatedItemId }) => relatedItemId === item.id),
  );

  function update(index: number, patch: Partial<ReferenceRelationDraft>) {
    onChange((current) =>
      current.map((relation, currentIndex) =>
        currentIndex === index ? { ...relation, ...patch } : relation,
      ),
    );
  }

  return (
    <FormSection title="Связи">
      {relations.length ? (
        relations.map((relation, index) => {
          const options: Array<{ item: { id: string; title: string } }> =
            candidates.some(({ item }) => item.id === relation.relatedItemId)
              ? candidates
              : [
                  {
                    item: {
                      id: relation.relatedItemId,
                      title: relation.relatedItemTitle,
                    },
                  },
                  ...candidates,
                ];

          return (
            <div
              key={relation.id ?? `new-relation-${index}`}
              className="grid gap-3 rounded-lg border bg-background p-3"
            >
              <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto]">
                <Dropdown
                  aria-label={`Связанный элемент ${index + 1}`}
                  value={relation.relatedItemId}
                  onValueChange={(selectedValue) => {
                    const candidate = options.find(
                      ({ item }) => item.id === selectedValue,
                    );
                    update(index, {
                      relatedItemId: selectedValue,
                      relatedItemTitle:
                        candidate?.item.title ?? relation.relatedItemTitle,
                    });
                  }}
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                >
                  {options.map(({ item }) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </Dropdown>
                <Dropdown
                  aria-label={`Тип связи ${index + 1}`}
                  value={relation.relationType}
                  onValueChange={(selectedValue) =>
                    update(index, {
                      relationType: selectedValue as ItemRelationType,
                    })
                  }
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                >
                  {Object.entries(relationTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Dropdown>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Удалить связь ${index + 1}`}
                  onClick={() => onRemove(relation)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
                <Dropdown
                  aria-label={`Направление связи ${index + 1}`}
                  value={relation.direction}
                  onValueChange={(selectedValue) =>
                    update(index, {
                      direction: selectedValue as "parent" | "child",
                    })
                  }
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                >
                  <option value="parent">Родитель</option>
                  <option value="child">Дочерний элемент</option>
                </Dropdown>
                <Input
                  aria-label={`Комментарий к связи ${index + 1}`}
                  value={relation.comment}
                  onChange={(event) =>
                    update(index, { comment: event.target.value })
                  }
                  placeholder="Комментарий"
                />
              </div>
            </div>
          );
        })
      ) : (
        <p className="text-sm text-muted-foreground">
          Связанные элементы пока не указаны.
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        disabled={!availableCandidates.length}
        onClick={() => {
          const candidate = availableCandidates[0];
          if (!candidate) return;
          onChange((current) => [
            ...current,
            {
              relatedItemId: candidate.item.id,
              relatedItemTitle: candidate.item.title,
              direction: "child",
              relationType: "related",
              comment: "",
            },
          ]);
        }}
      >
        Добавить связь
      </Button>
      {!candidates.length ? (
        <p className="text-xs text-muted-foreground">
          Чтобы добавить связь, в коллекции должен быть другой элемент.
        </p>
      ) : null}
    </FormSection>
  );
}

function ReferenceImagesEditor({
  images,
  onChange,
  onRemove,
}: {
  images: ReferenceImageDraft[];
  onChange: React.Dispatch<React.SetStateAction<ReferenceImageDraft[]>>;
  onRemove: (image: ReferenceImageDraft) => void;
}) {
  function update(index: number, patch: Partial<ReferenceImageDraft>) {
    onChange((current) =>
      current.map((image, currentIndex) =>
        currentIndex === index ? { ...image, ...patch } : image,
      ),
    );
  }

  return (
    <FormSection title="Справочные изображения">
      <p className="text-sm text-muted-foreground">
        Здесь хранится обложка и изображения из каталогов. Пользовательские
        фотографии редактируются во вкладке «Фотографии».
      </p>
      {images.map((image, index) => (
        <div
          key={image.id ?? `new-image-${index}`}
          className="grid gap-3 rounded-lg border bg-background p-3"
        >
          <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto]">
            <Input
              aria-label={`URL справочного изображения ${index + 1}`}
              value={image.url}
              onChange={(event) => update(index, { url: event.target.value })}
              placeholder="https://…"
            />
            <ProviderSelect
              value={image.provider}
              onChange={(provider) => update(index, { provider })}
              ariaLabel={`Источник изображения ${index + 1}`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Удалить справочное изображение ${index + 1}`}
              onClick={() => onRemove(image)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <Input
            aria-label={`Подпись справочного изображения ${index + 1}`}
            value={image.caption}
            onChange={(event) => update(index, { caption: event.target.value })}
            placeholder="Подпись"
          />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          onChange((current) => [
            ...current,
            { url: "", caption: "", provider: "manual" },
          ])
        }
      >
        <ImageIcon className="h-4 w-4" />
        Добавить справочное изображение
      </Button>
    </FormSection>
  );
}

function ReferenceLinksEditor({
  links,
  onChange,
  onRemove,
}: {
  links: ReferenceLinkDraft[];
  onChange: React.Dispatch<React.SetStateAction<ReferenceLinkDraft[]>>;
  onRemove: (link: ReferenceLinkDraft) => void;
}) {
  function update(index: number, patch: Partial<ReferenceLinkDraft>) {
    onChange((current) =>
      current.map((link, currentIndex) =>
        currentIndex === index ? { ...link, ...patch } : link,
      ),
    );
  }

  return (
    <FormSection title="Внешние ссылки">
      {links.map((link, index) => (
        <div
          key={link.id ?? `new-link-${index}`}
          className="grid gap-3 rounded-lg border bg-background p-3"
        >
          <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto]">
            <Input
              aria-label={`URL внешней ссылки ${index + 1}`}
              value={link.url}
              onChange={(event) => update(index, { url: event.target.value })}
              placeholder="https://…"
            />
            <Dropdown
              aria-label={`Тип внешней ссылки ${index + 1}`}
              value={link.type}
              onValueChange={(selectedValue) =>
                update(index, { type: selectedValue as LinkType })
              }
              className="h-10 rounded-md border bg-background px-3 text-sm"
            >
              {linkTypeOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Dropdown>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Удалить внешнюю ссылку ${index + 1}`}
              onClick={() => onRemove(link)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <Input
            aria-label={`Название внешней ссылки ${index + 1}`}
            value={link.title}
            onChange={(event) => update(index, { title: event.target.value })}
            placeholder="Название ссылки"
          />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          onChange((current) => [
            ...current,
            { url: "", title: "", type: "other" },
          ])
        }
      >
        <Link2 className="h-4 w-4" />
        Добавить ссылку
      </Button>
    </FormSection>
  );
}

function ReferenceSourcesEditor({
  references,
  onChange,
  onRemove,
}: {
  references: ReferenceSourceDraft[];
  onChange: React.Dispatch<React.SetStateAction<ReferenceSourceDraft[]>>;
  onRemove: (reference: ReferenceSourceDraft) => void;
}) {
  function update(index: number, patch: Partial<ReferenceSourceDraft>) {
    onChange((current) =>
      current.map((reference, currentIndex) =>
        currentIndex === index ? { ...reference, ...patch } : reference,
      ),
    );
  }

  return (
    <details className="rounded-lg border bg-background p-4">
      <summary className="cursor-pointer text-sm font-semibold">
        Источники и идентификаторы
      </summary>
      <div className="mt-4 grid gap-4">
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Изменение provider или идентификатора влияет на последующую
          синхронизацию.
        </p>
        {references.map((reference, index) => (
          <div
            key={reference.id ?? `new-reference-${index}`}
            className="grid gap-3 rounded-lg border p-3"
          >
            <div className="grid gap-3 sm:grid-cols-[10rem_1fr_auto]">
              <ProviderSelect
                value={reference.provider}
                onChange={(provider) => update(index, { provider })}
                ariaLabel={`Provider источника ${index + 1}`}
              />
              <Input
                aria-label={`Внешний идентификатор ${index + 1}`}
                value={reference.externalId}
                onChange={(event) =>
                  update(index, { externalId: event.target.value })
                }
                placeholder="Идентификатор"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Удалить источник ${index + 1}`}
                onClick={() => onRemove(reference)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <Input
              aria-label={`Ссылка на источник ${index + 1}`}
              value={reference.url}
              onChange={(event) => update(index, { url: event.target.value })}
              placeholder="https://…"
            />
            {reference.lastSync ? (
              <p className="text-xs text-muted-foreground">
                Последняя синхронизация: {formatDateTime(reference.lastSync)}
              </p>
            ) : null}
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onChange((current) => [
              ...current,
              {
                provider: "manual",
                externalId: "",
                url: "",
                lastSync: null,
              },
            ])
          }
        >
          <ExternalLink className="h-4 w-4" />
          Добавить источник
        </Button>
      </div>
    </details>
  );
}

function ProviderSelect({
  value,
  onChange,
  ariaLabel,
}: {
  value: ProviderCode;
  onChange: (provider: ProviderCode) => void;
  ariaLabel: string;
}) {
  return (
    <Dropdown
      aria-label={ariaLabel}
      value={value}
      onValueChange={(selectedValue) => onChange(selectedValue as ProviderCode)}
      className="h-10 rounded-md border bg-background px-3 text-sm"
    >
      {providerOptions.map(([code, label]) => (
        <option key={code} value={code}>
          {label}
        </option>
      ))}
    </Dropdown>
  );
}

function SyncEditor({
  references,
  provider,
  onProviderChange,
  preview,
  selectedFields,
  onSelectedFieldsChange,
  disabled,
  syncing,
  onPreview,
  onApply,
}: {
  references: ReferenceSourceDraft[];
  provider: ProviderCode | null;
  onProviderChange: (provider: ProviderCode | null) => void;
  preview: SyncItemResponse | null;
  selectedFields: Set<SyncItemField>;
  onSelectedFieldsChange: React.Dispatch<
    React.SetStateAction<Set<SyncItemField>>
  >;
  disabled: boolean;
  syncing: boolean;
  onPreview: () => void;
  onApply: () => void;
}) {
  const providers = Array.from(
    new Set(
      references
        .map(({ provider: code }) => code)
        .filter((code) => code !== "manual"),
    ),
  );
  const activeReference = references.find(
    ({ provider: code }) => code === provider,
  );

  if (!providers.length) {
    return (
      <FormSection title="Синхронизация">
        <p className="text-sm text-muted-foreground">
          Добавьте внешний источник, чтобы обновлять справочные данные.
        </p>
      </FormSection>
    );
  }

  function toggleField(field: SyncItemField) {
    onSelectedFieldsChange((current) => {
      const next = new Set(current);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  }

  return (
    <FormSection title="Синхронизация">
      <div className="grid gap-3 rounded-lg border bg-background p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <Label htmlFor="reference-sync-provider">Источник</Label>
            <Dropdown
              id="reference-sync-provider"
              value={provider ?? ""}
              onValueChange={(selectedValue) =>
                onProviderChange(selectedValue as ProviderCode)
              }
              className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              {providers.map((code) => (
                <option key={code} value={code}>
                  {providerLabel(code)}
                </option>
              ))}
            </Dropdown>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={disabled || !provider}
            onClick={onPreview}
          >
            <RefreshCw className="h-4 w-4" />
            {syncing ? "Проверяем…" : "Проверить обновления"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {activeReference?.lastSync
            ? `Последняя синхронизация: ${formatDateTime(activeReference.lastSync)}`
            : "Успешной синхронизации ещё не было."}
        </p>
        {disabled && !syncing ? (
          <p className="text-xs text-[var(--warning)]">
            Сначала сохраните изменения формы.
          </p>
        ) : null}
      </div>

      {preview ? (
        <div className="grid gap-3">
          <p className="text-sm">
            Личные данные, партии, покупки и заметки не изменятся.
          </p>
          {preview.changes.length ? (
            preview.changes.map((change) => (
              <SyncChange
                key={change.field}
                change={change}
                checked={selectedFields.has(change.field)}
                onChange={() => toggleField(change.field)}
              />
            ))
          ) : (
            <p className="rounded-lg border p-3 text-sm text-muted-foreground">
              Справочные данные уже актуальны.
            </p>
          )}
          <Button
            type="button"
            disabled={syncing || selectedFields.size === 0}
            onClick={onApply}
          >
            {syncing
              ? "Применение…"
              : `Применить выбранные изменения (${selectedFields.size})`}
          </Button>
        </div>
      ) : null}
    </FormSection>
  );
}

function SyncChange({
  change,
  checked,
  onChange,
}: {
  change: SyncItemChangeDto;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="grid cursor-pointer gap-2 rounded-lg border bg-background p-3 text-sm">
      <span className="flex items-center gap-2 font-medium">
        <input type="checkbox" checked={checked} onChange={onChange} />
        {syncFieldLabel(change.field)}
      </span>
      <span className="grid gap-2 pl-6 sm:grid-cols-2">
        <span>
          <span className="block text-xs text-muted-foreground">Сейчас</span>
          {displaySyncValue(change.currentValue)}
        </span>
        <span>
          <span className="block text-xs text-muted-foreground">
            Из источника
          </span>
          {displaySyncValue(change.incomingValue)}
        </span>
      </span>
    </label>
  );
}

function validateReferenceForm(form: FormData) {
  const errors: Record<string, string> = {};
  const title = String(form.get("title") ?? "").trim();
  if (!title) errors.title = "Введите название.";

  const year = numberOrNull(form.get("year"));
  const maxYear = new Date().getFullYear() + 10;
  if (year != null && (year < 1800 || year > maxYear)) {
    errors.year = `Укажите год от 1800 до ${maxYear}.`;
  }

  validatePositive(form, errors, "minPlayers", "Минимум игроков");
  validatePositive(form, errors, "maxPlayers", "Максимум игроков");
  validatePositive(form, errors, "minPlayTime", "Минимальное время");
  validatePositive(form, errors, "maxPlayTime", "Максимальное время");
  validatePositive(form, errors, "minAge", "Возраст");

  const minPlayers = numberOrNull(form.get("minPlayers"));
  const maxPlayers = numberOrNull(form.get("maxPlayers"));
  if (minPlayers != null && maxPlayers != null && minPlayers > maxPlayers) {
    errors.maxPlayers = "Максимум не может быть меньше минимума.";
  }

  const minTime = numberOrNull(form.get("minPlayTime"));
  const maxTime = numberOrNull(form.get("maxPlayTime"));
  if (minTime != null && maxTime != null && minTime > maxTime) {
    errors.maxPlayTime = "Максимум не может быть меньше минимума.";
  }

  const complexity = numberOrNull(form.get("complexity"));
  if (complexity != null && (complexity < 0 || complexity > 5)) {
    errors.complexity = "Сложность должна быть от 0 до 5.";
  }

  return errors;
}

function validatePositive(
  form: FormData,
  errors: Record<string, string>,
  field: string,
  label: string,
) {
  const value = numberOrNull(form.get(field));
  if (value != null && value <= 0) {
    errors[field] = `${label}: укажите положительное число.`;
  }
}

function validateReferenceResources({
  images,
  links,
  references,
  relations,
}: Pick<ReferenceResources, "images" | "links" | "references" | "relations">):
  string | null {
  if (images.some((image) => !image.id && !isHttpUrl(image.url))) {
    return "Для нового справочного изображения укажите корректный http или https URL.";
  }
  if (images.some((image) => image.url.trim() && !isHttpUrl(image.url))) {
    return "Проверьте URL справочных изображений.";
  }
  if (links.some((link) => !isHttpUrl(link.url))) {
    return "Проверьте URL внешних ссылок.";
  }
  if (
    references.some(
      (reference) =>
        !reference.externalId.trim() ||
        (reference.url.trim() && !isHttpUrl(reference.url)),
    )
  ) {
    return "Для каждого источника нужен идентификатор и корректный URL.";
  }
  const sourceKeys = references.map(
    ({ provider, externalId }) => `${provider}:${externalId.trim()}`,
  );
  if (new Set(sourceKeys).size !== sourceKeys.length) {
    return "Provider и внешний идентификатор должны образовывать уникальную пару.";
  }
  if (relations.some(({ relatedItemId }) => !relatedItemId)) {
    return "Для каждой связи выберите связанный элемент.";
  }
  const relationKeys = relations.map(
    ({ relatedItemId, direction, relationType }) =>
      `${relatedItemId}:${direction}:${relationType}`,
  );
  if (new Set(relationKeys).size !== relationKeys.length) {
    return "Одинаковую связь нельзя добавить дважды.";
  }
  return null;
}

export async function persistReferenceResources(
  itemId: string,
  resources: ReferenceResources,
) {
  const base = `/api/items/${encodeURIComponent(itemId)}`;
  const initial = JSON.parse(resources.initialResources) as {
    images: ReferenceImageDraft[];
    links: ReferenceLinkDraft[];
    references: ReferenceSourceDraft[];
    relations: ReferenceRelationDraft[];
  };
  const changedImages = resources.images.filter(
    (image) =>
      !image.id ||
      !sameDraft(
        image,
        initial.images.find(({ id }) => id === image.id),
      ),
  );
  const changedLinks = resources.links.filter(
    (link) =>
      !link.id ||
      !sameDraft(
        link,
        initial.links.find(({ id }) => id === link.id),
      ),
  );
  const changedReferences = resources.references.filter(
    (reference) =>
      !reference.id ||
      !sameDraft(
        reference,
        initial.references.find(({ id }) => id === reference.id),
      ),
  );
  const changedRelations = resources.relations.filter(
    (relation) =>
      !relation.id ||
      !sameDraft(
        relation,
        initial.relations.find(({ id }) => id === relation.id),
      ),
  );

  await Promise.all([
    ...resources.removedImageIds.map((id) =>
      apiRequest(`${base}/images/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    ),
    ...resources.removedLinkIds.map((id) =>
      apiRequest(`${base}/links/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    ),
    ...resources.removedReferenceIds.map((id) =>
      apiRequest(`${base}/external-references/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    ),
    ...resources.removedRelationIds.map((id) =>
      apiRequest(`${base}/relations/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    ),
  ]);

  await Promise.all([
    ...changedImages.map((image) =>
      apiRequest(
        image.id
          ? `${base}/images/${encodeURIComponent(image.id)}`
          : `${base}/images`,
        {
          method: image.id ? "PATCH" : "POST",
          body: JSON.stringify({
            type: "reference",
            provider: image.provider,
            url: textOrNull(image.url),
            caption: textOrNull(image.caption),
          }),
        },
      ),
    ),
    ...changedLinks.map((link) =>
      apiRequest(
        link.id
          ? `${base}/links/${encodeURIComponent(link.id)}`
          : `${base}/links`,
        {
          method: link.id ? "PATCH" : "POST",
          body: JSON.stringify({
            type: link.type,
            url: link.url.trim(),
            title: textOrNull(link.title),
          }),
        },
      ),
    ),
    ...changedReferences.map((reference) =>
      apiRequest(
        reference.id
          ? `${base}/external-references/${encodeURIComponent(reference.id)}`
          : `${base}/external-references`,
        {
          method: reference.id ? "PATCH" : "POST",
          body: JSON.stringify({
            provider: reference.provider,
            externalId: reference.externalId.trim(),
            url: textOrNull(reference.url),
          }),
        },
      ),
    ),
    ...changedRelations.map((relation) =>
      apiRequest(
        relation.id
          ? `${base}/relations/${encodeURIComponent(relation.id)}`
          : `${base}/relations`,
        {
          method: relation.id ? "PATCH" : "POST",
          body: JSON.stringify({
            relatedItemId: relation.relatedItemId,
            direction: relation.direction,
            relationType: relation.relationType,
            comment: textOrNull(relation.comment),
          }),
        },
      ),
    ),
  ]);
}

function sameDraft(left: unknown, right: unknown) {
  return right !== undefined && JSON.stringify(left) === JSON.stringify(right);
}

function serializeResources(
  images: ReferenceImageDraft[],
  links: ReferenceLinkDraft[],
  references: ReferenceSourceDraft[],
  relations: ReferenceRelationDraft[],
  removedImageIds: string[],
  removedLinkIds: string[],
  removedReferenceIds: string[],
  removedRelationIds: string[],
) {
  return JSON.stringify({
    images,
    links,
    references,
    relations,
    removedImageIds: [...removedImageIds].sort(),
    removedLinkIds: [...removedLinkIds].sort(),
    removedReferenceIds: [...removedReferenceIds].sort(),
    removedRelationIds: [...removedRelationIds].sort(),
  });
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function displaySyncValue(value: unknown) {
  if (value === null || value === undefined || value === "")
    return "Нет данных";
  if (Array.isArray(value))
    return value.length ? value.join(", ") : "Нет данных";
  return String(value);
}

function providerLabel(provider: ProviderCode) {
  return providerOptions.find(([code]) => code === provider)?.[1] ?? provider;
}

function syncFieldLabel(field: SyncItemField) {
  return syncFieldLabels[field];
}

const providerOptions: [ProviderCode, string][] = [
  ["boardgamegeek", "BoardGameGeek"],
  ["tesera", "Tesera"],
  ["nastolio", "Nastolio"],
  ["manual", "Вручную"],
];

const linkTypeOptions: [LinkType, string][] = [
  ["official", "Официальная"],
  ["rules", "Правила"],
  ["kickstarter", "Kickstarter"],
  ["gamefound", "Gamefound"],
  ["youtube", "YouTube"],
  ["review", "Обзор"],
  ["publisher", "Издатель"],
  ["shop", "Магазин"],
  ["other", "Другое"],
];

const syncFieldLabels: Record<SyncItemField, string> = {
  type: "Тип элемента",
  title: "Название",
  originalTitle: "Оригинальное название",
  description: "Описание",
  year: "Год выпуска",
  minPlayers: "Минимум игроков",
  maxPlayers: "Максимум игроков",
  minPlayTime: "Минимальная длительность",
  maxPlayTime: "Максимальная длительность",
  minAge: "Возраст",
  complexity: "Сложность",
  rating: "Рейтинг источника",
  categories: "Категории",
  mechanics: "Механики",
  designers: "Дизайнеры",
  artists: "Художники",
  publishers: "Издатели",
  externalReferences: "Ссылка на источник",
  images: "Обложка",
  links: "Внешняя ссылка",
};

const relationTypeLabels: Record<
  CollectionItemDetailDto["item"]["relations"][number]["relationType"],
  string
> = {
  requires: "Требует",
  expands: "Дополняет",
  compatible_with: "Совместимо",
  contains: "Содержит",
  part_of: "Часть",
  localized_version_of: "Локализация",
  alternative_to: "Альтернатива",
  related: "Связано",
};

type ReferenceImageDraft = {
  id?: string;
  url: string;
  caption: string;
  provider: ProviderCode;
};

type ReferenceLinkDraft = {
  id?: string;
  url: string;
  title: string;
  type: LinkType;
};

type ReferenceSourceDraft = {
  id?: string;
  provider: ProviderCode;
  externalId: string;
  url: string;
  lastSync: string | null;
};

type ReferenceRelationDraft = {
  id?: string;
  relatedItemId: string;
  relatedItemTitle: string;
  direction: "parent" | "child";
  relationType: ItemRelationType;
  comment: string;
};

type ReferenceResources = {
  images: ReferenceImageDraft[];
  links: ReferenceLinkDraft[];
  references: ReferenceSourceDraft[];
  relations: ReferenceRelationDraft[];
  removedImageIds: string[];
  removedLinkIds: string[];
  removedReferenceIds: string[];
  removedRelationIds: string[];
  initialResources: string;
};

type EditSavedResult = {
  status?: UserItemLifecycleStatus;
  destination?: string;
};

type FormProps = {
  details: CollectionItemDetailDto;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: (result?: EditSavedResult) => void;
};

function textOrNull(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function numberOrNull(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function listValue(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : undefined;
}
