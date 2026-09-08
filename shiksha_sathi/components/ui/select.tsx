"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";

export type SelectOption = { value: string; label: string };

type SelectProps = {
  value: string | null;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
};

function Select({
  value,
  onValueChange,
  options,
  placeholder,
  ariaLabel,
  disabled,
  className,
}: SelectProps) {
  return (
    <SelectPrimitive.Root
      items={options}
      // always controlled: pass the string | null straight through so it never
      // flips from uncontrolled (undefined) to controlled
      value={value}
      onValueChange={(v) => {
        if (v != null) onValueChange(String(v));
      }}
      disabled={disabled || options.length === 0}
    >
      <SelectPrimitive.Trigger
        data-slot="select-trigger"
        aria-label={ariaLabel}
        className={cn(
          "inline-flex h-8 min-w-0 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm whitespace-nowrap outline-none transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-[popup-open]:bg-muted",
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} className="truncate" />
        <SelectPrimitive.Icon className="ml-auto shrink-0 text-muted-foreground">
          <ChevronsUpDown className="size-3.5" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner sideOffset={4} className="z-50">
          <SelectPrimitive.Popup className="max-h-72 min-w-32 overflow-y-auto rounded-lg border border-border bg-popover p-1 text-sm text-popover-foreground shadow-md outline-none">
            {options.map((o) => (
              <SelectPrimitive.Item
                key={o.value}
                value={o.value}
                className="flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 outline-none select-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
              >
                <span className="flex w-4 shrink-0 justify-center">
                  <SelectPrimitive.ItemIndicator>
                    <Check className="size-3.5" />
                  </SelectPrimitive.ItemIndicator>
                </span>
                <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

export { Select };
