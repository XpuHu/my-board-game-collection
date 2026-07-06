"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Boxes,
  ExternalLink,
  ImageIcon,
  Save,
  ShoppingBag,
  Star,
} from "lucide-react";

import { ErrorState, LoadingState } from "@/components/ui-state";
import { useToast } from "@/components/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  apiClient,
  type CreatePreorderRequest,
  type PreorderStatus,
  type WishlistItemDetailsDto,
} from "@/shared/api";

type WishlistItemPageClientProps = {
  itemId: string;
};

type PreorderFormState = {
  shop: string;
  price: string;
  currency: string;
  orderDate: string;
  expectedDate: string;
  status: PreorderStatus;
  comment: string;
};

const emptyPreorderForm: PreorderFormState = {
  shop: "",
  price: "",
  currency: "RUB",
  orderDate: "",
  expectedDate: "",
  status: "planned",
  comment: "",
};

export function WishlistItemPageClient({
  itemId,
}: WishlistItemPageClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [details, setDetails] = React.useState<WishlistItemDetailsDto | null>(
    null,
  );
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [preorderDialogOpen, setPreorderDialogOpen] = React.useState(false);
  const [preorderForm, setPreorderForm] =
    React.useState<PreorderFormState>(emptyPreorderForm);

  const loadDetails = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setDetails(await apiClient.wishlist.get(itemId));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Не удалось загрузить карточку wishlist",
      );
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  React.useEffect(() => {
    let isActive = true;

    apiClient.wishlist
      .get(itemId)
      .then((response) => {
        if (!isActive) {
          return;
        }

        setDetails(response);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (!isActive) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Не удалось загрузить карточку wishlist",
        );
      })
      .finally(() => {
        if (isActive) {
          setLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [itemId]);

  function updatePreorderForm<K extends keyof PreorderFormState>(
    key: K,
    value: PreorderFormState[K],
  ) {
    setPreorderForm((current) => ({ ...current, [key]: value }));
  }

  async function addToCollection() {
    setSaving(true);

    try {
      const response = await apiClient.collection.add(itemId, {});
      toast({
        title: "Добавлено в коллекцию",
        description: "Item переиспользован, дубль не создан.",
        variant: "success",
      });
      router.push(`/collection/${response.item.id}`);
    } catch (saveError) {
      toast({
        title: "Не удалось добавить в коллекцию",
        description:
          saveError instanceof Error
            ? saveError.message
            : "Попробуйте еще раз.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  function openPreorderDialog() {
    setPreorderForm(emptyPreorderForm);
    setPreorderDialogOpen(true);
  }

  async function createPreorder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      await apiClient.preorders.create(itemId, toPreorderRequest(preorderForm));
      toast({
        title: "Предзаказ создан",
        description: "Игра осталась тем же Item в wishlist.",
        variant: "success",
      });
      setPreorderDialogOpen(false);
      await loadDetails();
    } catch (saveError) {
      toast({
        title: "Не удалось оформить предзаказ",
        description:
          saveError instanceof Error
            ? saveError.message
            : "Проверьте поля и попробуйте еще раз.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <LoadingState
          title="Загружаем wishlist"
          description="Получаем подробную справочную карточку."
        />
      </main>
    );
  }

  if (error || !details) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <ErrorState
          description={error ?? "Карточка wishlist не найдена"}
          onRetry={loadDetails}
        />
      </main>
    );
  }

  const mainImage = details.images.find((image) => image.url)?.url ?? null;
  const externalLinks = [
    ...details.externalReferences
      .filter((reference) => reference.url)
      .map((reference) => ({
        id: reference.id,
        title: providerLabel(reference.provider),
        url: reference.url as string,
      })),
    ...details.links.map((link) => ({
      id: link.id,
      title: link.title ?? linkTypeLabel(link.type),
      url: link.url,
    })),
  ];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4">
        <Button asChild variant="ghost" className="w-fit px-0">
          <Link href="/wishlist">
            <ArrowLeft className="h-4 w-4" />
            Назад к wishlist
          </Link>
        </Button>

        <section className="grid gap-5 rounded-lg border bg-card p-4 lg:grid-cols-[16rem_1fr]">
          <div className="overflow-hidden rounded-md border bg-secondary">
            {mainImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mainImage}
                alt=""
                className="h-full min-h-80 w-full object-cover"
              />
            ) : (
              <div className="flex min-h-80 items-center justify-center text-muted-foreground">
                <ImageIcon className="h-10 w-10" />
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-normal">
                  {details.item.title}
                </h1>
                <Badge variant="secondary">{details.item.type.name}</Badge>
                {details.userItem.owned ? <Badge>В коллекции</Badge> : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted-foreground">
                {details.item.originalTitle &&
                details.item.originalTitle !== details.item.title ? (
                  <span>{details.item.originalTitle}</span>
                ) : null}
                {details.item.year ? <span>{details.item.year}</span> : null}
                {details.externalReferences.length > 0 ? (
                  <span>{details.externalReferences.length} источников</span>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Рейтинг" value={formatRating(details.item.rating)} />
              <Metric label="Игроки" value={formatPlayers(details)} />
              <Metric label="Время" value={formatPlayTime(details)} />
              <Metric label="Возраст" value={formatAge(details.item.minAge)} />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={addToCollection}
                disabled={saving || details.userItem.owned}
              >
                <Boxes className="h-4 w-4" />
                {details.userItem.owned ? "Уже в коллекции" : "Добавить в коллекцию"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={openPreorderDialog}
                disabled={saving}
              >
                <ShoppingBag className="h-4 w-4" />
                Оформить предзаказ
              </Button>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="grid gap-6">
          <InfoSection title="Описание">
            {details.item.description ? (
              <p className="whitespace-pre-line text-sm leading-7 text-muted-foreground">
                {details.item.description}
              </p>
            ) : (
              <EmptyText>Описание не импортировано.</EmptyText>
            )}
          </InfoSection>

          <InfoSection title="Механики">
            <TokenList values={details.item.mechanics} empty="Механики не указаны." />
          </InfoSection>

          <InfoSection title="Категории">
            <TokenList
              values={details.item.categories}
              empty="Категории не указаны."
            />
          </InfoSection>

          <InfoSection title="Авторы и издатели">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextList label="Дизайнеры" values={details.item.designers} />
              <TextList label="Художники" values={details.item.artists} />
              <TextList label="Издатели" values={details.item.publishers} />
            </div>
          </InfoSection>
        </div>

        <aside className="grid h-fit gap-6">
          <InfoSection title="Ссылки">
            {externalLinks.length === 0 ? (
              <EmptyText>Ссылок нет.</EmptyText>
            ) : (
              <div className="grid gap-2">
                {externalLinks.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm hover:bg-secondary"
                  >
                    <span className="truncate">{link.title}</span>
                    <ExternalLink className="h-4 w-4 shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </InfoSection>

          <InfoSection title="Видео">
            <LinkList links={details.videos} empty="Видео не добавлены." />
          </InfoSection>

          <InfoSection title="Магазины">
            <LinkList links={details.shopLinks} empty="Магазинов нет." />
          </InfoSection>

          <InfoSection title="Wishlist">
            <div className="grid gap-3 text-sm">
              <Metric
                label="Интерес"
                value={
                  details.userItem.interestLevel
                    ? `${details.userItem.interestLevel}/5`
                    : "Нет"
                }
              />
              <Metric
                label="Предзаказы"
                value={String(details.preorders.length)}
              />
              {details.userItem.decisionNotes ? (
                <p className="leading-6 text-muted-foreground">
                  {details.userItem.decisionNotes}
                </p>
              ) : null}
            </div>
          </InfoSection>
        </aside>
      </div>

      <Dialog open={preorderDialogOpen} onOpenChange={setPreorderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Оформить предзаказ</DialogTitle>
            <DialogDescription>{details.item.title}</DialogDescription>
          </DialogHeader>

          <form onSubmit={createPreorder} className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="wishlist-preorder-shop">Магазин</Label>
              <Input
                id="wishlist-preorder-shop"
                value={preorderForm.shop}
                onChange={(event) =>
                  updatePreorderForm("shop", event.target.value)
                }
                className="mt-2"
                required
              />
            </div>

            <div>
              <Label>Статус</Label>
              <Select
                value={preorderForm.status}
                onValueChange={(value) =>
                  updatePreorderForm("status", value as PreorderStatus)
                }
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Планируется</SelectItem>
                  <SelectItem value="ordered">Заказан</SelectItem>
                  <SelectItem value="paid">Оплачен</SelectItem>
                  <SelectItem value="shipped">Отправлен</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="wishlist-preorder-price">Стоимость</Label>
              <Input
                id="wishlist-preorder-price"
                type="number"
                min={0}
                step="0.01"
                value={preorderForm.price}
                onChange={(event) =>
                  updatePreorderForm("price", event.target.value)
                }
                className="mt-2"
                required
              />
            </div>

            <div>
              <Label htmlFor="wishlist-preorder-currency">Валюта</Label>
              <Input
                id="wishlist-preorder-currency"
                value={preorderForm.currency}
                onChange={(event) =>
                  updatePreorderForm(
                    "currency",
                    event.target.value.toUpperCase(),
                  )
                }
                className="mt-2"
                maxLength={3}
                required
              />
            </div>

            <div>
              <Label htmlFor="wishlist-preorder-order-date">Дата заказа</Label>
              <Input
                id="wishlist-preorder-order-date"
                type="date"
                value={preorderForm.orderDate}
                onChange={(event) =>
                  updatePreorderForm("orderDate", event.target.value)
                }
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="wishlist-preorder-expected-date">
                Ожидаемая дата
              </Label>
              <Input
                id="wishlist-preorder-expected-date"
                type="date"
                value={preorderForm.expectedDate}
                onChange={(event) =>
                  updatePreorderForm("expectedDate", event.target.value)
                }
                className="mt-2"
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="wishlist-preorder-comment">Комментарий</Label>
              <Textarea
                id="wishlist-preorder-comment"
                value={preorderForm.comment}
                onChange={(event) =>
                  updatePreorderForm("comment", event.target.value)
                }
                className="mt-2"
              />
            </div>

            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPreorderDialogOpen(false)}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? "Сохраняем" : "Сохранить"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function InfoSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}

function TokenList({ values, empty }: { values: string[]; empty: string }) {
  if (values.length === 0) {
    return <EmptyText>{empty}</EmptyText>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <Badge key={value} variant="secondary">
          {value}
        </Badge>
      ))}
    </div>
  );
}

function TextList({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <div className="text-sm font-medium">{label}</div>
      {values.length === 0 ? (
        <EmptyText>Не указаны.</EmptyText>
      ) : (
        <div className="mt-2 text-sm leading-6 text-muted-foreground">
          {values.join(", ")}
        </div>
      )}
    </div>
  );
}

function LinkList({
  links,
  empty,
}: {
  links: WishlistItemDetailsDto["links"];
  empty: string;
}) {
  if (links.length === 0) {
    return <EmptyText>{empty}</EmptyText>;
  }

  return (
    <div className="grid gap-2">
      {links.map((link) => (
        <a
          key={link.id}
          href={link.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm hover:bg-secondary"
        >
          <span className="truncate">{link.title ?? linkTypeLabel(link.type)}</span>
          <ExternalLink className="h-4 w-4 shrink-0" />
        </a>
      ))}
    </div>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function toPreorderRequest(form: PreorderFormState): CreatePreorderRequest {
  return {
    shop: form.shop.trim(),
    price: Number(form.price),
    currency: form.currency.trim().toUpperCase(),
    orderDate: dateOrNull(form.orderDate),
    expectedDate: dateOrNull(form.expectedDate),
    status: form.status,
    comment: nullableText(form.comment),
  };
}

function dateOrNull(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function nullableText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatRating(value?: number | null) {
  return value ? (
    <span className="inline-flex items-center gap-1">
      <Star className="h-4 w-4 fill-primary text-primary" />
      {value.toFixed(1)}
    </span>
  ) : (
    "Нет"
  );
}

function formatPlayers(details: WishlistItemDetailsDto) {
  const { minPlayers, maxPlayers } = details.item;

  if (!minPlayers && !maxPlayers) {
    return "Не указано";
  }

  if (minPlayers && maxPlayers && minPlayers !== maxPlayers) {
    return `${minPlayers}-${maxPlayers}`;
  }

  return String(minPlayers ?? maxPlayers);
}

function formatPlayTime(details: WishlistItemDetailsDto) {
  const { minPlayTime, maxPlayTime } = details.item;

  if (!minPlayTime && !maxPlayTime) {
    return "Не указано";
  }

  if (minPlayTime && maxPlayTime && minPlayTime !== maxPlayTime) {
    return `${minPlayTime}-${maxPlayTime} мин`;
  }

  return `${minPlayTime ?? maxPlayTime} мин`;
}

function formatAge(value?: number | null) {
  return value ? `${value}+` : "Не указано";
}

function providerLabel(
  provider: WishlistItemDetailsDto["externalReferences"][number]["provider"],
) {
  if (provider === "boardgamegeek") {
    return "BoardGameGeek";
  }

  return provider;
}

function linkTypeLabel(type: WishlistItemDetailsDto["links"][number]["type"]) {
  const labels: Record<typeof type, string> = {
    official: "Официальный сайт",
    rules: "Правила",
    kickstarter: "Kickstarter",
    gamefound: "Gamefound",
    youtube: "YouTube",
    review: "Обзор",
    publisher: "Издатель",
    shop: "Магазин",
    other: "Ссылка",
  };

  return labels[type];
}
