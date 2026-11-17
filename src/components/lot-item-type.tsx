import { Dice5, Puzzle, Wrench } from "lucide-react";

export function LotItemType({ code }: { code: string }) {
  const { Icon, label } =
    code === "accessory"
      ? { Icon: Wrench, label: "Аксессуар" }
      : code === "expansion"
        ? { Icon: Puzzle, label: "Дополнение" }
        : { Icon: Dice5, label: "Основная игра" };

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}
