"use client";

import * as React from "react";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";

import { useToast } from "@/components/toast-provider";
import { Button } from "@/components/ui/button";
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
import {
  linkTypes,
  providerCodes,
  type ImageDto,
  type ItemDetailsDto,
  type LinkDto,
  type LinkType,
  type ProviderCode,
} from "@/shared/api";
import { legacyApiClient as apiClient } from "@/shared/api/legacy";

type ItemReferenceEditorProps = {
  details: ItemDetailsDto;
  onDetailsChange: (details: ItemDetailsDto) => void;
  isEditing?: boolean;
};

type ItemFormState = {
  typeId: string;
  title: string;
  originalTitle: string;
  description: string;
  year: string;
  minPlayers: string;
  maxPlayers: string;
  minPlayTime: string;
  maxPlayTime: string;
  minAge: string;
  complexity: string;
  rating: string;
  categories: string;
  mechanics: string;
  designers: string;
  artists: string;
  publishers: string;
};

type ExternalReferenceFormState = {
  provider: ProviderCode;
  externalId: string;
  url: string;
};

type ImageFormState = {
  type: ImageDto["type"];
  provider: ProviderCode | "__none__";
  url: string;
  caption: string;
  sortOrder: string;
};

type LinkFormState = {
  type: LinkType;
  url: string;
  title: string;
};

const emptyReferenceForm: ExternalReferenceFormState = {
  provider: "manual",
  externalId: "",
  url: "",
};

const emptyImageForm: ImageFormState = {
  type: "user",
  provider: "__none__",
  url: "",
  caption: "",
  sortOrder: "0",
};

const emptyLinkForm: LinkFormState = {
  type: "other",
  url: "",
  title: "",
};

export function ItemReferenceEditor({
  details,
  onDetailsChange,
  isEditing = true,
}: ItemReferenceEditorProps) {
  const { toast } = useToast();
  const [itemTypes, setItemTypes] = React.useState(
    details.item.type ? [details.item.type] : [],
  );
  const [itemForm, setItemForm] = React.useState(() => toItemForm(details));
  const [referenceForm, setReferenceForm] =
    React.useState<ExternalReferenceFormState>(emptyReferenceForm);
  const [imageForm, setImageForm] =
    React.useState<ImageFormState>(emptyImageForm);
  const [linkForm, setLinkForm] = React.useState<LinkFormState>(emptyLinkForm);
  const [editingReferenceId, setEditingReferenceId] = React.useState<
    string | null
  >(null);
  const [editingImageId, setEditingImageId] = React.useState<string | null>(
    null,
  );
  const [editingLinkId, setEditingLinkId] = React.useState<string | null>(null);
  const [savingSection, setSavingSection] = React.useState<string | null>(null);

  React.useEffect(() => {
    let isActive = true;

    apiClient.itemTypes.list().then((types) => {
      if (isActive) {
        setItemTypes(types);
      }
    });

    return () => {
      isActive = false;
    };
  }, []);

  function updateItemForm<K extends keyof ItemFormState>(
    key: K,
    value: ItemFormState[K],
  ) {
    setItemForm((current) => ({ ...current, [key]: value }));
  }

  function updateReferenceForm<K extends keyof ExternalReferenceFormState>(
    key: K,
    value: ExternalReferenceFormState[K],
  ) {
    setReferenceForm((current) => ({ ...current, [key]: value }));
  }

  function updateImageForm<K extends keyof ImageFormState>(
    key: K,
    value: ImageFormState[K],
  ) {
    setImageForm((current) => ({ ...current, [key]: value }));
  }

  function updateLinkForm<K extends keyof LinkFormState>(
    key: K,
    value: LinkFormState[K],
  ) {
    setLinkForm((current) => ({ ...current, [key]: value }));
  }

  async function saveItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingSection("item");

    try {
      const updated = await apiClient.items.update(details.item.id, {
        typeId: itemForm.typeId,
        title: itemForm.title.trim(),
        originalTitle: nullableText(itemForm.originalTitle),
        description: nullableText(itemForm.description),
        year: nullableNumber(itemForm.year),
        minPlayers: nullableNumber(itemForm.minPlayers),
        maxPlayers: nullableNumber(itemForm.maxPlayers),
        minPlayTime: nullableNumber(itemForm.minPlayTime),
        maxPlayTime: nullableNumber(itemForm.maxPlayTime),
        minAge: nullableNumber(itemForm.minAge),
        complexity: nullableNumber(itemForm.complexity),
        rating: nullableNumber(itemForm.rating),
        categories: parseList(itemForm.categories),
        mechanics: parseList(itemForm.mechanics),
        designers: parseList(itemForm.designers),
        artists: parseList(itemForm.artists),
        publishers: parseList(itemForm.publishers),
      });
      onDetailsChange(updated);
      toast({
        title: "Справочник обновлен",
        description:
          "Поля Item сохранены без изменения пользовательского состояния.",
        variant: "success",
      });
    } catch (error) {
      showSaveError(toast, error);
    } finally {
      setSavingSection(null);
    }
  }

  async function saveReference(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingSection("reference");

    try {
      const payload = {
        provider: referenceForm.provider,
        externalId: referenceForm.externalId.trim(),
        url: nullableText(referenceForm.url),
      };
      const updated = editingReferenceId
        ? await apiClient.items.updateExternalReference(
            details.item.id,
            editingReferenceId,
            payload,
          )
        : await apiClient.items.createExternalReference(
            details.item.id,
            payload,
          );
      onDetailsChange(updated);
      resetReferenceForm();
      toast({
        title: "Идентификатор сохранен",
        description:
          "Сохранение прошло локально, без синхронизации с provider.",
        variant: "success",
      });
    } catch (error) {
      showSaveError(toast, error);
    } finally {
      setSavingSection(null);
    }
  }

  async function saveImage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingSection("image");

    try {
      const payload = {
        type: imageForm.type,
        provider: imageForm.provider === "__none__" ? null : imageForm.provider,
        url: nullableText(imageForm.url),
        caption: nullableText(imageForm.caption),
        sortOrder: nullableNumber(imageForm.sortOrder) ?? 0,
      };
      const updated = editingImageId
        ? await apiClient.items.updateImage(
            details.item.id,
            editingImageId,
            payload,
          )
        : await apiClient.items.createImage(details.item.id, payload);
      onDetailsChange(updated);
      resetImageForm();
      toast({
        title: "Изображение сохранено",
        description: "URL добавлен как ручной справочный материал.",
        variant: "success",
      });
    } catch (error) {
      showSaveError(toast, error);
    } finally {
      setSavingSection(null);
    }
  }

  async function saveLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingSection("link");

    try {
      const payload = {
        type: linkForm.type,
        url: linkForm.url.trim(),
        title: nullableText(linkForm.title),
      };
      const updated = editingLinkId
        ? await apiClient.items.updateLink(
            details.item.id,
            editingLinkId,
            payload,
          )
        : await apiClient.items.createLink(details.item.id, payload);
      onDetailsChange(updated);
      resetLinkForm();
      toast({
        title: "Ссылка сохранена",
        description: "Ссылка сохранена без внешних запросов.",
        variant: "success",
      });
    } catch (error) {
      showSaveError(toast, error);
    } finally {
      setSavingSection(null);
    }
  }

  async function deleteReference(referenceId: string) {
    setSavingSection(referenceId);
    try {
      onDetailsChange(
        await apiClient.items.deleteExternalReference(
          details.item.id,
          referenceId,
        ),
      );
    } catch (error) {
      showSaveError(toast, error);
    } finally {
      setSavingSection(null);
    }
  }

  async function deleteImage(imageId: string) {
    setSavingSection(imageId);
    try {
      onDetailsChange(
        await apiClient.items.deleteImage(details.item.id, imageId),
      );
    } catch (error) {
      showSaveError(toast, error);
    } finally {
      setSavingSection(null);
    }
  }

  async function deleteLink(linkId: string) {
    setSavingSection(linkId);
    try {
      onDetailsChange(
        await apiClient.items.deleteLink(details.item.id, linkId),
      );
    } catch (error) {
      showSaveError(toast, error);
    } finally {
      setSavingSection(null);
    }
  }

  function startReferenceEdit(
    reference: ItemDetailsDto["externalReferences"][number],
  ) {
    setEditingReferenceId(reference.id);
    setReferenceForm({
      provider: reference.provider,
      externalId: reference.externalId,
      url: reference.url ?? "",
    });
  }

  function startImageEdit(image: ImageDto) {
    setEditingImageId(image.id);
    setImageForm({
      type: image.type,
      provider: image.provider ?? "__none__",
      url: image.url ?? "",
      caption: image.caption ?? "",
      sortOrder: String(image.sortOrder),
    });
  }

  function startLinkEdit(link: LinkDto) {
    setEditingLinkId(link.id);
    setLinkForm({
      type: link.type,
      url: link.url,
      title: link.title ?? "",
    });
  }

  function resetReferenceForm() {
    setEditingReferenceId(null);
    setReferenceForm(emptyReferenceForm);
  }

  function resetImageForm() {
    setEditingImageId(null);
    setImageForm(emptyImageForm);
  }

  function resetLinkForm() {
    setEditingLinkId(null);
    setLinkForm(emptyLinkForm);
  }

  const referenceLabels = uniqueValues([
    ...details.item.categories,
    ...details.item.mechanics,
  ]);

  if (!isEditing) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide">
            Об игре
          </h2>
          <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
            {details.item.description ?? "Описание пока не добавлено."}
          </p>
          {referenceLabels.length ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {referenceLabels.map((value) => (
                <span
                  key={value}
                  className="rounded-md bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
                >
                  {value}
                </span>
              ))}
            </div>
          ) : null}
        </section>
        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide">
            Характеристики
          </h2>
          <dl className="mt-5 grid gap-4 text-sm">
            <ReadOnlyRow label="Тип" value={details.item.type.name} />
            <ReadOnlyRow
              label="Год выпуска"
              value={displayValue(details.item.year)}
            />
            <ReadOnlyRow
              label="Дизайнеры"
              value={displayList(details.item.designers)}
            />
            <ReadOnlyRow
              label="Художники"
              value={displayList(details.item.artists)}
            />
            <ReadOnlyRow
              label="Издатели"
              value={displayList(details.item.publishers)}
            />
            <ReadOnlyRow
              label="Сложность"
              value={
                details.item.complexity
                  ? `${details.item.complexity}/5`
                  : "Не указана"
              }
            />
          </dl>
        </section>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">Справочная карточка</h2>
        </div>
        <form onSubmit={saveItem} className="grid gap-4 p-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="item-reference-type">Тип</Label>
            <Select
              value={itemForm.typeId}
              onValueChange={(value) => updateItemForm("typeId", value)}
            >
              <SelectTrigger id="item-reference-type" className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {itemTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="item-reference-title">Название</Label>
            <Input
              id="item-reference-title"
              value={itemForm.title}
              onChange={(event) => updateItemForm("title", event.target.value)}
              className="mt-2"
              required
            />
          </div>

          <TextInput
            id="item-reference-original-title"
            label="Оригинальное название"
            value={itemForm.originalTitle}
            onChange={(value) => updateItemForm("originalTitle", value)}
          />
          <TextInput
            id="item-reference-year"
            label="Год"
            type="number"
            value={itemForm.year}
            onChange={(value) => updateItemForm("year", value)}
          />
          <TextInput
            id="item-reference-min-players"
            label="Мин. игроков"
            type="number"
            value={itemForm.minPlayers}
            onChange={(value) => updateItemForm("minPlayers", value)}
          />
          <TextInput
            id="item-reference-max-players"
            label="Макс. игроков"
            type="number"
            value={itemForm.maxPlayers}
            onChange={(value) => updateItemForm("maxPlayers", value)}
          />
          <TextInput
            id="item-reference-min-play-time"
            label="Мин. время"
            type="number"
            value={itemForm.minPlayTime}
            onChange={(value) => updateItemForm("minPlayTime", value)}
          />
          <TextInput
            id="item-reference-max-play-time"
            label="Макс. время"
            type="number"
            value={itemForm.maxPlayTime}
            onChange={(value) => updateItemForm("maxPlayTime", value)}
          />
          <TextInput
            id="item-reference-min-age"
            label="Возраст"
            type="number"
            value={itemForm.minAge}
            onChange={(value) => updateItemForm("minAge", value)}
          />
          <TextInput
            id="item-reference-complexity"
            label="Сложность"
            type="number"
            step="0.01"
            value={itemForm.complexity}
            onChange={(value) => updateItemForm("complexity", value)}
          />
          <TextInput
            id="item-reference-rating"
            label="Рейтинг"
            type="number"
            step="0.01"
            value={itemForm.rating}
            onChange={(value) => updateItemForm("rating", value)}
          />

          <div className="sm:col-span-2">
            <Label htmlFor="item-reference-description">Описание</Label>
            <Textarea
              id="item-reference-description"
              value={itemForm.description}
              onChange={(event) =>
                updateItemForm("description", event.target.value)
              }
              className="mt-2"
            />
          </div>

          <TextInput
            id="item-reference-categories"
            label="Категории"
            value={itemForm.categories}
            onChange={(value) => updateItemForm("categories", value)}
            className="sm:col-span-2"
          />
          <TextInput
            id="item-reference-mechanics"
            label="Механики"
            value={itemForm.mechanics}
            onChange={(value) => updateItemForm("mechanics", value)}
            className="sm:col-span-2"
          />
          <TextInput
            id="item-reference-designers"
            label="Дизайнеры"
            value={itemForm.designers}
            onChange={(value) => updateItemForm("designers", value)}
            className="sm:col-span-2"
          />
          <TextInput
            id="item-reference-artists"
            label="Художники"
            value={itemForm.artists}
            onChange={(value) => updateItemForm("artists", value)}
            className="sm:col-span-2"
          />
          <TextInput
            id="item-reference-publishers"
            label="Издатели"
            value={itemForm.publishers}
            onChange={(value) => updateItemForm("publishers", value)}
            className="sm:col-span-2"
          />

          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" disabled={savingSection === "item"}>
              <Save className="h-4 w-4" />
              {savingSection === "item" ? "Сохраняем" : "Сохранить Item"}
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">Ссылки и материалы</h2>
        </div>
        <div className="grid gap-6 p-4 xl:grid-cols-3">
          <MaterialColumn title="Внешние ID">
            <form onSubmit={saveReference} className="grid gap-3">
              <Label>Provider</Label>
              <Select
                value={referenceForm.provider}
                onValueChange={(value) =>
                  updateReferenceForm("provider", value as ProviderCode)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {providerCodes.map((provider) => (
                    <SelectItem key={provider} value={provider}>
                      {provider}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={referenceForm.externalId}
                onChange={(event) =>
                  updateReferenceForm("externalId", event.target.value)
                }
                placeholder="External ID"
                required
              />
              <Input
                value={referenceForm.url}
                onChange={(event) =>
                  updateReferenceForm("url", event.target.value)
                }
                placeholder="https://..."
              />
              <FormActions
                editing={Boolean(editingReferenceId)}
                saving={savingSection === "reference"}
                onCancel={resetReferenceForm}
              />
            </form>
            <MaterialList
              items={details.externalReferences.map((reference) => ({
                id: reference.id,
                title: `${reference.provider}: ${reference.externalId}`,
                subtitle: reference.url ?? "Без URL",
                onEdit: () => startReferenceEdit(reference),
                onDelete: () => deleteReference(reference.id),
              }))}
            />
          </MaterialColumn>

          <MaterialColumn title="Изображения">
            <form onSubmit={saveImage} className="grid gap-3">
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={imageForm.type}
                  onValueChange={(value) =>
                    updateImageForm("type", value as ImageDto["type"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">user</SelectItem>
                    <SelectItem value="reference">reference</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  value={imageForm.sortOrder}
                  onChange={(event) =>
                    updateImageForm("sortOrder", event.target.value)
                  }
                  placeholder="Порядок"
                />
              </div>
              <Input
                value={imageForm.url}
                onChange={(event) => updateImageForm("url", event.target.value)}
                placeholder="https://example.com/image.jpg"
                required
              />
              <Input
                value={imageForm.caption}
                onChange={(event) =>
                  updateImageForm("caption", event.target.value)
                }
                placeholder="Подпись"
              />
              <FormActions
                editing={Boolean(editingImageId)}
                saving={savingSection === "image"}
                onCancel={resetImageForm}
              />
            </form>
            <MaterialList
              items={details.images.map((image) => ({
                id: image.id,
                title: image.caption ?? image.url ?? "Изображение",
                subtitle: image.url ?? image.path ?? "Без URL",
                onEdit: () => startImageEdit(image),
                onDelete: () => deleteImage(image.id),
              }))}
            />
          </MaterialColumn>

          <MaterialColumn title="Ссылки">
            <form onSubmit={saveLink} className="grid gap-3">
              <Select
                value={linkForm.type}
                onValueChange={(value) =>
                  updateLinkForm("type", value as LinkType)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {linkTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={linkForm.url}
                onChange={(event) => updateLinkForm("url", event.target.value)}
                placeholder="https://..."
                required
              />
              <Input
                value={linkForm.title}
                onChange={(event) =>
                  updateLinkForm("title", event.target.value)
                }
                placeholder="Название"
              />
              <FormActions
                editing={Boolean(editingLinkId)}
                saving={savingSection === "link"}
                onCancel={resetLinkForm}
              />
            </form>
            <MaterialList
              items={details.links.map((link) => ({
                id: link.id,
                title: link.title ?? link.type,
                subtitle: link.url,
                onEdit: () => startLinkEdit(link),
                onDelete: () => deleteLink(link.id),
              }))}
            />
          </MaterialColumn>
        </div>
      </section>
    </div>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function displayList(values: string[]) {
  return values.length ? values.join(", ") : "Не указано";
}

function displayValue(value?: number | null) {
  return value === null || value === undefined ? "Не указано" : String(value);
}

function TextInput({
  id,
  label,
  value,
  onChange,
  type = "text",
  step,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  step?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2"
      />
    </div>
  );
}

function MaterialColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid content-start gap-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function FormActions({
  editing,
  saving,
  onCancel,
}: {
  editing: boolean;
  saving: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="flex gap-2">
      <Button type="submit" size="sm" disabled={saving}>
        {editing ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        {editing ? "Сохранить" : "Добавить"}
      </Button>
      {editing ? (
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          <X className="h-4 w-4" />
          Отмена
        </Button>
      ) : null}
    </div>
  );
}

function MaterialList({
  items,
}: {
  items: {
    id: string;
    title: string;
    subtitle: string;
    onEdit: () => void;
    onDelete: () => void;
  }[];
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Пока пусто.</p>;
  }

  return (
    <div className="grid gap-2">
      {items.map((item) => (
        <div key={item.id} className="rounded-md border p-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{item.title}</div>
            <div className="mt-1 truncate text-xs text-muted-foreground">
              {item.subtitle}
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={item.onEdit}
              aria-label="Редактировать"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={item.onDelete}
              aria-label="Удалить"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function toItemForm(details: ItemDetailsDto): ItemFormState {
  return {
    typeId: details.item.type.id,
    title: details.item.title,
    originalTitle: details.item.originalTitle ?? "",
    description: details.item.description ?? "",
    year: stringValue(details.item.year),
    minPlayers: stringValue(details.item.minPlayers),
    maxPlayers: stringValue(details.item.maxPlayers),
    minPlayTime: stringValue(details.item.minPlayTime),
    maxPlayTime: stringValue(details.item.maxPlayTime),
    minAge: stringValue(details.item.minAge),
    complexity: stringValue(details.item.complexity),
    rating: stringValue(details.item.rating),
    categories: details.item.categories.join(", "),
    mechanics: details.item.mechanics.join(", "),
    designers: details.item.designers.join(", "),
    artists: details.item.artists.join(", "),
    publishers: details.item.publishers.join(", "),
  };
}

function stringValue(value?: number | null) {
  return value === null || value === undefined ? "" : String(value);
}

function nullableText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function nullableNumber(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? Number(trimmed) : null;
}

function parseList(value: string) {
  return uniqueValues(
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values));
}

function showSaveError(
  toast: ReturnType<typeof useToast>["toast"],
  error: unknown,
) {
  toast({
    title: "Не удалось сохранить",
    description:
      error instanceof Error
        ? error.message
        : "Проверьте поля и попробуйте еще раз.",
    variant: "error",
  });
}
