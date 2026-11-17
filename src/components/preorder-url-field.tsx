"use client";
import { Input } from "@/components/ui/input";
export function PreorderUrlField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm">
      Ссылка на предзаказ
      <Input
        type="url"
        placeholder="https://…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
