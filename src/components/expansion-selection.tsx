"use client";
import { Dropdown } from "@/components/ui/dropdown";
import * as React from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { apiRequest } from "@/shared/api/client";
import type {
  ExpansionExternalSource,
  ExpansionOptionDto,
  ExpansionOptionsResponse,
} from "@/shared/api";

export type ExpansionDraft = {
  key: string;
  itemId?: string;
  external?: ExpansionExternalSource;
  title: string;
  russianTitle?: string | null;
  year?: number | null;
  price: string;
};
export function expansionLabel(
  item: Pick<ExpansionOptionDto, "title" | "russianTitle" | "year">,
) {
  const names = [item.title];
  if (
    item.russianTitle &&
    item.russianTitle.trim().toLocaleLowerCase("ru") !==
      item.title.trim().toLocaleLowerCase("ru")
  )
    names.push(item.russianTitle);
  return `${names.join(" / ")} — ${item.year && item.year > 0 ? `год выхода: ${item.year}` : "дата выхода не указана"}`;
}
export function expansionPayload(items: ExpansionDraft[], prices: boolean) {
  return items.map((item) => ({
    ...(item.itemId
      ? { itemId: item.itemId }
      : item.external
        ? { external: item.external }
        : { title: item.title }),
    ...(prices ? { price: Number(item.price) } : {}),
  }));
}
export async function loadExpansionOptions(
  baseItemId?: string,
  externalBase?: ExpansionExternalSource,
  kind: "expansion" | "accessory" = "expansion",
): Promise<ExpansionOptionsResponse> {
  if (baseItemId)
    return apiRequest<ExpansionOptionsResponse>(
      `/api/items/${baseItemId}/expansions${kind === "accessory" ? "?kind=accessory" : ""}`,
    );
  if (externalBase)
    return apiRequest<ExpansionOptionsResponse>(
      `/api/external/expansions?provider=${encodeURIComponent(externalBase.provider)}&externalId=${encodeURIComponent(externalBase.externalId)}${kind === "accessory" ? "&kind=accessory" : ""}`,
    );
  return {
    data: [],
    warnings: [
      {
        message:
          "Для загрузки списка из каталога добавьте ссылку BoardGameGeek в справочные данные игры. Дополнение можно создать по названию.",
      },
    ],
  };
}
export function ExpansionSelection({
  value,
  onChange,
  prices = false,
  currency = "RUB",
  baseItemId,
  excludeIds = [],
  externalBase,
  kind = "expansion",
}: {
  value: ExpansionDraft[];
  onChange: (value: ExpansionDraft[]) => void;
  prices?: boolean;
  currency?: string;
  baseItemId?: string;
  excludeIds?: string[];
  externalBase?: ExpansionExternalSource;
  kind?: "expansion" | "accessory";
}) {
  const accessory = kind === "accessory";
  const [title, setTitle] = React.useState("");
  const selectId = React.useId();
  const [retry, setRetry] = React.useState(0);
  const provider = externalBase?.provider;
  const externalId = externalBase?.externalId;
  const source = `${baseItemId ?? ""}:${provider ?? ""}:${externalId ?? ""}:${kind}:${retry}`;
  const [loaded, setLoaded] = React.useState<{
    source: string;
    options: ExpansionOptionDto[];
    warnings: { message: string }[];
    error: string | null;
  }>({ source: "", options: [], warnings: [], error: null });
  const loading = loaded.source !== source;
  React.useEffect(() => {
    let active = true;
    loadExpansionOptions(
      baseItemId,
      provider && externalId ? { provider, externalId } : undefined,
      kind,
    )
      .then((result) => {
        if (active)
          setLoaded({
            source,
            options: result.data,
            warnings: result.warnings ?? [],
            error: null,
          });
      })
      .catch(() => {
        if (active)
          setLoaded({
            source,
            options: [],
            warnings: [],
            error:
              kind === "accessory"
                ? "Не удалось загрузить список аксессуаров."
                : "Не удалось загрузить список дополнений.",
          });
      });
    return () => {
      active = false;
    };
  }, [baseItemId, provider, externalId, kind, source]);
  const excluded = [
    ...excludeIds,
    ...(baseItemId ? [baseItemId] : []),
    ...value.flatMap((item) =>
      item.itemId
        ? [item.itemId]
        : item.external
          ? [`${item.external.provider}:${item.external.externalId}`]
          : [],
    ),
  ];
  function add(item: ExpansionOptionDto) {
    if (!excluded.includes(item.id))
      onChange([
        ...value,
        {
          key: crypto.randomUUID(),
          itemId: item.itemId,
          external: item.itemId ? undefined : item.external,
          title: item.title,
          russianTitle: item.russianTitle,
          year: item.year,
          price: "",
        },
      ]);
  }
  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <Label htmlFor={selectId}>
          {accessory ? "Аксессуары к этой игре" : "Дополнения к этой игре"}
        </Label>
        <Dropdown
          id={selectId}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-50"
          value=""
          disabled={
            loading ||
            Boolean(loaded.error) ||
            !loaded.options.some((item) => !excluded.includes(item.id))
          }
          onValueChange={(selectedValue) => {
            const item = loaded.options.find(
              (item) => item.id === selectedValue,
            );
            if (item) add(item);
          }}
        >
          <option value="">
            {loading
              ? "Загружаем список…"
              : accessory
                ? "Выберите аксессуар"
                : "Выберите дополнение"}
          </option>
          {!loading
            ? loaded.options
                .filter((item) => !excluded.includes(item.id))
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {expansionLabel(item)}
                  </option>
                ))
            : null}
        </Dropdown>
        {!loading && loaded.warnings.length ? (
          <div className="text-sm text-muted-foreground">
            {loaded.warnings.map((warning, index) => (
              <p key={index}>{warning.message}</p>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => setRetry((value) => value + 1)}
            >
              Обновить список
            </Button>
          </div>
        ) : null}
        {!loading && loaded.error ? (
          <div role="alert" className="text-sm">
            <p>{loaded.error}</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRetry((value) => value + 1)}
            >
              Повторить загрузку
            </Button>
          </div>
        ) : null}
        {!loading &&
        !loaded.error &&
        !loaded.options.some((item) => !excluded.includes(item.id)) ? (
          <p className="text-sm text-muted-foreground">
            {value.length
              ? "Все доступные позиции уже выбраны."
              : "Позиции не найдены. Можно добавить новую по названию ниже."}
          </p>
        ) : null}
      </div>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label htmlFor={`${selectId}-new-title`}>
            {accessory
              ? "Название нового аксессуара"
              : "Название нового дополнения"}
          </Label>
          <Input
            id={`${selectId}-new-title`}
            value={title}
            maxLength={500}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={!title.trim()}
          onClick={() => {
            onChange([
              ...value,
              { key: crypto.randomUUID(), title: title.trim(), price: "" },
            ]);
            setTitle("");
          }}
        >
          Добавить новое
        </Button>
      </div>
      {value.map((item) => (
        <div
          key={item.key}
          className="flex flex-wrap items-end gap-3 rounded-lg border p-3"
        >
          <span className="flex-1">
            {expansionLabel(item)}
            {item.external
              ? " · BoardGameGeek"
              : !item.itemId
                ? " · новое"
                : ""}
          </span>
          {prices ? (
            <div>
              <Label htmlFor={`price-${item.key}`}>
                Цена {accessory ? "аксессуара" : "дополнения"} ({currency})
              </Label>
              <Input
                id={`price-${item.key}`}
                type="number"
                min={0}
                step="0.01"
                required
                value={item.price}
                onChange={(e) =>
                  onChange(
                    value.map((row) =>
                      row.key === item.key
                        ? { ...row, price: e.target.value }
                        : row,
                    ),
                  )
                }
              />
            </div>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            aria-label={`Убрать ${accessory ? "аксессуар" : "дополнение"} ${item.title}`}
            onClick={() =>
              onChange(value.filter((row) => row.key !== item.key))
            }
          >
            Убрать
          </Button>
        </div>
      ))}
    </div>
  );
}
