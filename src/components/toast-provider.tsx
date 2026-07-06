"use client";

import * as React from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/shared/lib/utils";

type ToastVariant = "default" | "success" | "error";

type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
};

type Toast = ToastInput & {
  id: string;
};

type ToastContextValue = {
  toast: (input: ToastInput) => void;
  dismiss: (id: string) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = React.useCallback(
    (input: ToastInput) => {
      const id = crypto.randomUUID();
      setToasts((current) => [
        ...current,
        { id, variant: "default", ...input },
      ]);
      window.setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );

  const value = React.useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-20 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
        {toasts.map((item) => (
          <ToastItem key={item.id} toast={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }

  return context;
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const Icon = toast.variant === "error" ? XCircle : toast.variant === "success" ? CheckCircle2 : Info;

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 text-card-foreground shadow-lg",
        toast.variant === "error" && "border-destructive/50",
      )}
      role="status"
    >
      <div className="flex gap-3">
        <Icon
          className={cn(
            "mt-0.5 h-5 w-5 shrink-0 text-primary",
            toast.variant === "error" && "text-destructive",
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{toast.title}</div>
          {toast.description ? (
            <div className="mt-1 text-sm leading-5 text-muted-foreground">
              {toast.description}
            </div>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onDismiss(toast.id)}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Закрыть уведомление</span>
        </Button>
      </div>
    </div>
  );
}
