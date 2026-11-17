"use client";

import {
  preorderDeliveryLabels,
  preorderDeliveryMethods,
  type PreorderDeliveryMethod,
} from "@/shared/lib/preorder-delivery";
import { Dropdown } from "./ui/dropdown";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export function PreorderDeliveryMethodField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: PreorderDeliveryMethod;
  onChange: (value: PreorderDeliveryMethod) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>Способ доставки</Label>
      <Dropdown
        id={id}
        className="mt-2"
        value={value}
        onValueChange={(value) => onChange(value as PreorderDeliveryMethod)}
      >
        {preorderDeliveryMethods.map((method) => (
          <option key={method} value={method}>
            {preorderDeliveryLabels[method]}
          </option>
        ))}
      </Dropdown>
    </div>
  );
}

export function PreorderDeliveryCostField({
  id,
  value,
  currency,
  onChange,
}: {
  id: string;
  value: string;
  currency: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>Стоимость доставки, {currency}</Label>
      <Input
        id={id}
        className="mt-2"
        type="number"
        min={0}
        step="0.01"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Не указана"
        aria-describedby={`${id}-help`}
      />
      <p id={`${id}-help`} className="mt-1 text-xs text-muted-foreground">
        Необязательно. Укажите 0, если доставка бесплатная.
      </p>
    </div>
  );
}
