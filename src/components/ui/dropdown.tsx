"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

type Option = { value: string; label: React.ReactNode; disabled?: boolean };

function optionsFromChildren(children: React.ReactNode): Option[] {
  return React.Children.toArray(children).flatMap((child) => {
    if (
      !React.isValidElement<{
        value?: string | number;
        disabled?: boolean;
        children?: React.ReactNode;
      }>(child)
    )
      return [];
    if (child.type === React.Fragment)
      return optionsFromChildren(child.props.children);
    if (child.type !== "option") return [];
    return [
      {
        value: String(child.props.value ?? ""),
        label: child.props.children,
        disabled: child.props.disabled,
      },
    ];
  });
}

type DropdownProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "value" | "defaultValue" | "onChange"
> & {
  value?: string | number;
  defaultValue?: string | number;
  required?: boolean;
  onValueChange?: (value: string) => void;
};

// Share Status's Select while preserving option lists, named form fields and
// numeric quarter values. Radix items need a nonempty value for the clear item.
export function Dropdown({
  children,
  value,
  defaultValue,
  onValueChange,
  name,
  form,
  disabled,
  required,
  ...triggerProps
}: DropdownProps) {
  const options = optionsFromChildren(children);
  const [localValue, setLocalValue] = React.useState(
    defaultValue === undefined ? undefined : String(defaultValue),
  );
  const selectedValue = String(
    value ??
      localValue ??
      options.find((option) => !option.disabled)?.value ??
      "",
  );
  const selected = options.find((option) => option.value === selectedValue);
  let emptyOptionValue = "__dropdown_empty__";
  while (options.some((option) => option.value === emptyOptionValue))
    emptyOptionValue += "_";

  return (
    <Select
      value={selectedValue}
      onValueChange={(value) => {
        const next = value === emptyOptionValue ? "" : value;
        setLocalValue(next);
        onValueChange?.(next);
      }}
      disabled={disabled}
      required={required}
      form={form}
      name={name}
    >
      <SelectTrigger {...triggerProps} disabled={disabled}>
        <span className="min-w-0 flex-1 truncate">
          <SelectValue
            placeholder={selectedValue === "" ? selected?.label : undefined}
          >
            {selected?.label}
          </SelectValue>
        </span>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value === "" ? emptyOptionValue : option.value}
            disabled={option.disabled}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
