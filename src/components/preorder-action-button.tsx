"use client";

import {
  CheckCircle2,
  Loader2,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "./ui/button";

export const preorderActions = {
  receive: {
    Icon: CheckCircle2,
    label: "Отметить полученным",
    pending: "Отмечаем получение…",
  },
  cancel: {
    Icon: XCircle,
    label: "Отменить предзаказ",
    pending: "Отменяем предзаказ…",
  },
  reactivate: {
    Icon: RotateCcw,
    label: "Вернуть в активные",
    pending: "Возвращаем в активные…",
  },
  delete: {
    Icon: Trash2,
    label: "Удалить предзаказ",
    pending: "Удаляем предзаказ…",
  },
};
export type PreorderAction = keyof typeof preorderActions;

export function PreorderActionButton({
  action,
  pendingAction,
  onClick,
}: {
  action: PreorderAction;
  pendingAction?: PreorderAction;
  onClick: () => void;
}) {
  const { Icon, label, pending } = preorderActions[action];
  const busy = pendingAction === action;
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      disabled={Boolean(pendingAction)}
      onClick={onClick}
      aria-label={busy ? pending : label}
      title={busy ? pending : label}
      aria-busy={busy || undefined}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <Icon className="h-4 w-4" aria-hidden="true" />
      )}
    </Button>
  );
}
