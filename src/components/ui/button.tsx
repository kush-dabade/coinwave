import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border text-sm font-medium whitespace-nowrap transition-colors duration-150 outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary:
          "border-transparent bg-accent text-accent-ink hover:bg-accent/90 active:bg-accent/85",
        secondary:
          "border-rule-strong bg-surface text-ink hover:bg-surface-2 active:bg-surface-2/80",
        ghost:
          "border-transparent text-ink-2 hover:bg-surface-2 hover:text-ink",
        danger:
          "border-transparent bg-down text-white hover:bg-down/90 active:bg-down/85 dark:text-bg",
        link: "h-auto border-transparent px-0 text-accent underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-2.5 text-[0.8125rem]",
        md: "h-9 px-3.5",
        lg: "h-10 px-4",
        icon: "size-9",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  type,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"
  return (
    <Comp
      data-slot="button"
      // Buttons default to type="button" so they never submit a form by accident.
      type={asChild ? undefined : (type ?? "button")}
      className={cn(
        buttonVariants({ variant, size }),
        variant === "link" && "h-auto",
        className
      )}
      {...props}
    />
  )
}

export { Button }
