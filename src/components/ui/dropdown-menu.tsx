import * as React from "react"
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"
import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

const DropdownMenu = DropdownMenuPrimitive.Root
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

function DropdownMenuContent({
  className,
  align = "end",
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        className={cn(
          "z-50 min-w-44 overflow-hidden rounded-lg border border-rule bg-surface p-1 text-ink shadow-pop data-open:animate-in data-open:fade-in-0 data-open:zoom-in-97 data-closed:animate-out data-closed:fade-out-0",
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

const itemClass =
  "relative flex min-h-9 cursor-default items-center gap-2 rounded-md px-2.5 text-sm text-ink outline-none select-none data-highlighted:bg-surface-2 data-disabled:pointer-events-none data-disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-ink-3"

function DropdownMenuItem({
  className,
  tone,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  tone?: "danger"
}) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        itemClass,
        tone === "danger" && "text-down [&_svg]:text-down",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      className={cn(itemClass, "pr-8", className)}
      {...props}
    >
      {children}
      <span className="absolute right-2.5 flex items-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon className="text-ink!" strokeWidth={2.5} />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
    </DropdownMenuPrimitive.RadioItem>
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      className={cn(itemClass, "pr-8", className)}
      {...props}
    >
      {children}
      <span className="absolute right-2.5 flex items-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon className="text-ink!" strokeWidth={2.5} />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn("eyebrow px-2.5 pt-2 pb-1", className)}
      {...props}
    />
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn("-mx-1 my-1 h-px bg-rule", className)}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
}
