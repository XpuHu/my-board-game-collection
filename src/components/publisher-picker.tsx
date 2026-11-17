"use client";
import * as React from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";

export function PublisherPicker({
  id,
  name,
  value,
  defaultValue = "",
  onChange,
  multiple = true,
  saveWith = "game",
  required,
  className = "mt-2",
  placeholder,
}: {
  id: string;
  name?: string;
  className?: string;
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  multiple?: boolean;
  saveWith?: "game" | "preorder";
  required?: boolean;
}) {
  const [local, setLocal] = React.useState(defaultValue);
  const text = value ?? local;
  const [result, setResult] = React.useState<{
    query: string;
    options: { id: string; name: string }[];
    error: boolean;
  } | null>(null);
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const parts = multiple ? text.split(",") : [text];
  const query = parts.at(-1)?.trim() ?? "";
  const prefix = parts.length > 1 ? parts.slice(0, -1).join(",") + ", " : "";
  const loading = result?.query !== query;
  const options = loading ? [] : (result?.options ?? []);
  const error = !loading && result?.error;
  function select(option: { name: string }) {
    const next = prefix + option.name;
    setLocal(next);
    onChange?.(next);
    setOpen(false);
    setActiveIndex(-1);
  }
  React.useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/publishers?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error();
        const options = await response.json();
        if (!controller.signal.aborted)
          setResult({ query, options, error: false });
      } catch {
        if (!controller.signal.aborted)
          setResult({ query, options: [], error: true });
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  return (
    <>
      <div className="relative">
        <Input
          id={id}
          name={name}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={`${id}-options`}
          aria-activedescendant={
            open && options[activeIndex]
              ? `${id}-option-${options[activeIndex].id}`
              : undefined
          }
          value={text}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onChange={(event) => {
            setLocal(event.target.value);
            onChange?.(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) =>
                options.length === 0
                  ? -1
                  : event.key === "ArrowDown"
                    ? (index + 1) % options.length
                    : index <= 0
                      ? options.length - 1
                      : index - 1,
              );
            } else if (event.key === "Enter" && open && options[activeIndex]) {
              event.preventDefault();
              select(options[activeIndex]);
            } else if (event.key === "Escape" && open) {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
            }
          }}
          className={`${className} pr-10`}
          required={required}
          placeholder={
            placeholder ??
            (multiple
              ? "Выберите издателя или введите нового; несколько — через запятую"
              : "Выберите издателя или введите нового")
          }
          autoComplete="off"
          aria-describedby={`${id}-help`}
        />
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute bottom-3 right-3 h-4 w-4 text-muted-foreground"
        />
        {open ? (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-md border bg-card p-1 text-card-foreground shadow-md">
            <ul
              id={`${id}-options`}
              role="listbox"
              aria-label="Издатели"
              aria-busy={loading}
            >
              {options.map((option, index) => (
                <li key={option.id} role="presentation">
                  <button
                    id={`${id}-option-${option.id}`}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    tabIndex={-1}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => select(option)}
                    className={`w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground ${index === activeIndex ? "bg-accent text-accent-foreground" : ""}`}
                  >
                    {option.name}
                  </button>
                </li>
              ))}
            </ul>
            {loading || error || !options.length ? (
              <p
                role="status"
                className="px-3 py-2 text-sm text-muted-foreground"
              >
                {loading
                  ? "Поиск издателей…"
                  : error
                    ? "Не удалось загрузить издателей. Введите название вручную."
                    : "Совпадений нет. Можно указать нового издателя."}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      <p id={`${id}-help`} className="mt-1 text-xs text-muted-foreground">
        {error
          ? "Не удалось загрузить справочник. Можно ввести название вручную."
          : `Начните вводить название. Новый издатель сохранится вместе с ${saveWith === "preorder" ? "предзаказом" : "игрой"}.`}
      </p>
    </>
  );
}
