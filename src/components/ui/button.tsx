import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap outline-none select-none transition-[transform,box-shadow,background-color,border-color,color,opacity] duration-[180ms] ease-out will-change-transform focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:scale-[1.03] hover:shadow-[0_10px_22px_-14px_rgba(255,255,255,0.55)] active:scale-[0.97] active:duration-100 motion-reduce:transform-none motion-reduce:transition-none disabled:pointer-events-none disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none disabled:active:scale-100 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary:
          "border border-white/15 bg-linear-to-r from-zinc-800 to-zinc-700 text-white shadow-[0_10px_22px_-14px_rgba(0,0,0,0.7)] hover:from-zinc-700 hover:to-zinc-600",

        default:
          "border border-white/15 bg-linear-to-r from-zinc-800 to-zinc-700 text-white shadow-[0_10px_22px_-14px_rgba(0,0,0,0.7)] hover:from-zinc-700 hover:to-zinc-600",

        outline:
          "border border-white/15 bg-transparent text-white/85 hover:bg-white/8 hover:text-white",

        secondary:
          "border border-white/12 bg-white/4 text-white/90 hover:bg-white/8",

        ghost: "border border-transparent text-white/75 shadow-none hover:bg-white/6 hover:text-white hover:shadow-none",

        destructive:
          "border border-red-500/25 bg-red-500/12 text-red-300 hover:bg-red-500/20",

        link: "text-primary underline-offset-4 hover:underline",

        green:
          "border border-emerald-500/50 bg-emerald-500/20 text-emerald-200 shadow-[0_10px_20px_-14px_rgba(16,185,129,0.45)] hover:bg-emerald-500/28",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
