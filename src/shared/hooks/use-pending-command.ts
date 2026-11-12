"use client";
import * as React from "react";
import { apiRequest, ApiClientError } from "@/shared/api/client";
type Pending = { operationId: string; [key: string]: unknown };
export function usePendingCommand(key: string, path: string, method = "POST") {
  const [pending, setPending] = React.useState<Pending | null>(null);
  const current = React.useRef<Pending | null>(null);
  React.useEffect(() => {
    try {
      const stored = sessionStorage.getItem(key);
      if (stored) {
        current.current = JSON.parse(stored);
        setPending(current.current);
      }
    } catch {
      /* Storage is optional; the live command still has a stable key. */
    }
  }, [key]);
  async function run<T>(payload?: Record<string, unknown>): Promise<T> {
    const command =
      current.current ??
      (payload ? { ...payload, operationId: crypto.randomUUID() } : null);
    if (!command) throw new Error("Нет сохранённой операции");
    current.current = command;
    setPending(command);
    try {
      sessionStorage.setItem(key, JSON.stringify(command));
    } catch {
      /* Browser may disable storage. */
    }
    try {
      const result = await apiRequest<T>(path, {
        method,
        body: JSON.stringify(command),
      });
      clear();
      return result;
    } catch (error) {
      // Rejected transactions cannot have committed; keep uncertain network/server failures for replay.
      if (
        error instanceof ApiClientError &&
        error.status >= 400 &&
        error.status < 500
      )
        clear();
      throw error;
    }
  }
  function clear() {
    current.current = null;
    setPending(null);
    try {
      sessionStorage.removeItem(key);
    } catch {}
  }
  return { pending, run };
}
