"use client";
import * as React from "react";
import {
  ExpansionSelection,
  expansionPayload,
  type ExpansionDraft,
} from "./expansion-selection";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { usePendingCommand } from "@/shared/hooks/use-pending-command";
export function AddExpansionsDialog({
  itemId,
  existingIds,
  onClose,
  onSaved,
}: {
  itemId: string;
  existingIds: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [items, setItems] = React.useState<ExpansionDraft[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const busy = React.useRef(false);
  const command = usePendingCommand(
    `attach-expansions:${itemId}`,
    `/api/items/${itemId}/expansions`,
  );
  async function save() {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      await command.run({ expansions: expansionPayload(items, false) });
      onSaved();
      onClose();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось добавить дополнения",
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Добавить дополнения</DialogTitle>
          <DialogDescription>
            Выберите дополнения из каталога игры или создайте новые карточки по
            названию. Связь с игрой сохранится; наличие в коллекции можно
            указать в карточке дополнения.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {command.pending ? (
            <p>Подтвердите сохранение предыдущего набора дополнений.</p>
          ) : (
            <fieldset disabled={saving}>
              <ExpansionSelection
                value={items}
                onChange={setItems}
                excludeIds={existingIds}
                baseItemId={itemId}
              />
            </fieldset>
          )}
          {error ? (
            <p role="alert" className="mt-3 text-destructive">
              {error}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={saving}
            onClick={onClose}
          >
            Закрыть
          </Button>
          <Button
            type="button"
            disabled={saving || (!command.pending && !items.length)}
            onClick={() => void save()}
          >
            {saving
              ? "Сохраняем…"
              : command.pending
                ? "Подтвердить сохранение"
                : "Сохранить дополнения"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
