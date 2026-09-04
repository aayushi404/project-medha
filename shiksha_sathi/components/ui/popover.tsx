"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PopoverProps = {
  trigger: ReactNode;
  children: ReactNode;
  className?: string;
  triggerClassName?: string;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  onOpenChange?: (open: boolean) => void;
};

function Popover({
  trigger,
  children,
  className,
  triggerClassName,
  side = "bottom",
  align = "start",
  onOpenChange,
}: PopoverProps) {
  return (
    <PopoverPrimitive.Root onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger
        data-slot="popover-trigger"
        className={cn("outline-none", triggerClassName)}
      >
        {trigger}
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner side={side} align={align} sideOffset={6} className="z-50">
          <PopoverPrimitive.Popup
            data-slot="popover"
            className={cn(
              "min-w-40 rounded-lg border border-border bg-popover p-1 text-sm text-popover-foreground shadow-md outline-none data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 transition-opacity",
              className,
            )}
          >
            {children}
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/** A row inside a Popover menu. */
function PopoverItem({
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      data-slot="popover-item"
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Popover, PopoverItem };
