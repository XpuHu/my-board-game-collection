"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  DatabaseZap,
  ExternalLink,
  RotateCcw,
  Save,
  Settings,
} from "lucide-react";

import { useToast } from "@/components/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient, type SyncBggPlaysResponse } from "@/shared/api";

const BGG_USERNAME_KEY = "board-game-collection:bgg-username";
const BGG_LAST_SYNC_KEY = "board-game-collection:bgg-last-sync";

export function SettingsPageClient() {
  const { toast } = useToast();
  const [username, setUsername] = React.useState(() =>
    getLocalStorageValue<string>(BGG_USERNAME_KEY, ""),
  );
  const [since, setSince] = React.useState("");
  const [lastSync, setLastSync] = React.useState<string | null>(() =>
    getLocalStorageValue<string | null>(BGG_LAST_SYNC_KEY, null),
  );
  const [syncing, setSyncing] = React.useState(false);
  const [report, setReport] = React.useState<SyncBggPlaysResponse | null>(
    null,
  );

  function saveLocalSettings() {
    const trimmedUsername = username.trim();

    if (trimmedUsername) {
      window.localStorage.setItem(BGG_USERNAME_KEY, trimmedUsername);
    } else {
      window.localStorage.removeItem(BGG_USERNAME_KEY);
    }

    toast({
      title: "Настройки сохранены",
      description: "BGG username сохранен локально в браузере.",
      variant: "success",
    });
  }

  async function runSync(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedUsername = username.trim();

    if (!trimmedUsername) {
      toast({
        title: "Укажите BGG username",
        description: "Без username нельзя получить партии BoardGameGeek.",
        variant: "error",
      });
      return;
    }

    setSyncing(true);

    try {
      const response = await apiClient.bggSync.syncPlays({
        username: trimmedUsername,
        since: since ? new Date(since).toISOString() : undefined,
      });

      window.localStorage.setItem(BGG_USERNAME_KEY, trimmedUsername);
      window.localStorage.setItem(BGG_LAST_SYNC_KEY, response.syncedAt);
      setLastSync(response.syncedAt);
      setReport(response);
      toast({
        title: "BGG sync завершен",
        description: `Импортировано партий: ${response.imported}`,
        variant: "success",
      });
    } catch (syncError) {
      toast({
        title: "BGG sync не выполнен",
        description:
          syncError instanceof Error
            ? syncError.message
            : "Проверьте username и попробуйте еще раз.",
        variant: "error",
      });
    } finally {
      setSyncing(false);
    }
  }

  function useLastSyncAsSince() {
    if (lastSync) {
      setSince(lastSync.slice(0, 10));
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Настройки</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Провайдеры, синхронизация и локальные параметры приложения.
        </p>
      </div>

      <section className="rounded-lg border bg-card">
        <div className="flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">BoardGameGeek sync</h2>
            <p className="text-sm text-muted-foreground">
              Импорт партий по внешним идентификаторам BGG.
            </p>
          </div>
          <Badge variant="secondary">boardgamegeek</Badge>
        </div>

        <form onSubmit={runSync} className="grid gap-4 p-4">
          <div className="grid gap-4 md:grid-cols-[1fr_12rem_auto] md:items-end">
            <div>
              <Label htmlFor="bgg-username">BGG username</Label>
              <Input
                id="bgg-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="mt-2"
                placeholder="username"
              />
            </div>

            <div>
              <Label htmlFor="bgg-since">Партии с даты</Label>
              <Input
                id="bgg-since"
                type="date"
                value={since}
                onChange={(event) => setSince(event.target.value)}
                className="mt-2"
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={saveLocalSettings}
                title="Сохранить username"
              >
                <Save className="h-4 w-4" />
                <span className="sr-only">Сохранить username</span>
              </Button>
              <Button type="submit" disabled={syncing}>
                <DatabaseZap className="h-4 w-4" />
                {syncing ? "Синхронизация" : "Запустить"}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-md border bg-background px-3 py-2 text-sm">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              Последняя синхронизация:
            </span>
            <span className="font-medium">{formatDateTime(lastSync)}</span>
            {lastSync ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={useLastSyncAsSince}
              >
                <CalendarClock className="h-4 w-4" />
                Использовать дату
              </Button>
            ) : null}
          </div>
        </form>
      </section>

      {report ? <SyncReport report={report} /> : null}
    </main>
  );
}

function SyncReport({ report }: { report: SyncBggPlaysResponse }) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 className="text-base font-semibold">Отчет BGG sync</h2>
          <p className="text-sm text-muted-foreground">
            {formatDateTime(report.syncedAt)}
          </p>
        </div>
        <CheckCircle2 className="h-5 w-5 text-primary" />
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-3">
        <ReportMetric label="Импортировано" value={report.imported} />
        <ReportMetric label="Обновлено" value={report.updated} />
        <ReportMetric label="Дубли" value={report.skippedDuplicates} />
      </div>

      {report.unmatched.length > 0 ? (
        <div className="border-t px-4 py-3">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            Не сопоставлены с локальными Item
          </div>
          <div className="grid gap-2">
            {report.unmatched.map((item) => (
              <div
                key={item.bggThingId}
                className="flex flex-col gap-2 rounded-md border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-medium">{item.title}</div>
                  <div className="text-muted-foreground">
                    BGG ID {item.bggThingId}, партий: {item.playsCount}
                  </div>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={`https://boardgamegeek.com/boardgame/${encodeURIComponent(
                      item.bggThingId,
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                    BGG
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {report.warnings?.length ? (
        <div className="border-t px-4 py-3">
          <div className="grid gap-2">
            {report.warnings.map((warning) => (
              <div
                key={`${warning.provider}:${warning.code}`}
                className="rounded-md border px-3 py-2 text-sm"
              >
                <div className="font-medium">{warning.code}</div>
                <div className="text-muted-foreground">{warning.message}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex justify-end border-t px-4 py-3">
        <Button asChild variant="outline">
          <Link href="/plays">
            <RotateCcw className="h-4 w-4" />
            Открыть партии
          </Link>
        </Button>
      </div>
    </section>
  );
}

function ReportMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Не было";
  }

  return new Intl.DateTimeFormat("ru", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getLocalStorageValue<T extends string | null>(
  key: string,
  fallback: T,
) {
  if (typeof window === "undefined") {
    return fallback;
  }

  return (window.localStorage.getItem(key) ?? fallback) as T;
}
