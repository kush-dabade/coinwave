import * as React from "react"
import { Popover as PopoverPrimitive } from "radix-ui"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

/** A row of mutually exclusive options (aria-pressed toggle buttons). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
  className,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: React.ReactNode; title?: string }[]
  label: string
  size?: "sm" | "md"
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        // Wraps rather than widening the page on narrow screens.
        "inline-flex max-w-full flex-wrap rounded-md border border-rule bg-surface p-0.5",
        className
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-[4px] font-medium whitespace-nowrap transition-colors",
            size === "sm" ? "h-6 px-2 text-xs" : "h-7 px-2.5 text-[0.8125rem]",
            value === o.value
              ? "bg-surface-2 text-ink shadow-[inset_0_0_0_1px_var(--rule-strong)]"
              : "text-ink-3 hover:text-ink"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Select({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <span className={cn("relative inline-flex", className)}>
      <select
        className="h-8 w-full appearance-none rounded-md border border-rule-strong bg-surface pr-7 pl-2.5 text-[0.8125rem] text-ink outline-none focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent/30"
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-ink-3"
        aria-hidden="true"
      />
    </span>
  )
}

export function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "w-full rounded-md border border-rule-strong bg-surface px-3 py-2 text-[0.875rem] leading-6 text-ink outline-none placeholder:text-ink-3 focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent/30",
        className
      )}
      {...props}
    />
  )
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: React.ReactNode
  disabled?: boolean
}) {
  const id = React.useId()
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="text-[0.8125rem] font-medium text-ink">
          {label}
        </label>
        {description && (
          <p className="mt-0.5 text-xs text-ink-3">{description}</p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-45",
          checked ? "bg-accent" : "bg-rule-strong"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-4.5" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  )
}

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: "neutral" | "up" | "down" | "warn" | "accent"
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-[4px] px-1.5 text-[0.6875rem] font-semibold whitespace-nowrap",
        {
          neutral: "bg-surface-2 text-ink-2",
          up: "bg-up-soft text-up",
          down: "bg-down-soft text-down",
          warn: "bg-warn-soft text-warn",
          accent: "bg-accent-soft text-accent",
        }[tone],
        className
      )}
    >
      {children}
    </span>
  )
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mono inline-flex h-5 min-w-5 items-center justify-center rounded border border-rule-strong bg-surface-2 px-1 text-[10px] text-ink-2">
      {children}
    </kbd>
  )
}

export function Popover(
  props: React.ComponentProps<typeof PopoverPrimitive.Root>
) {
  return <PopoverPrimitive.Root {...props} />
}

export function PopoverTrigger(
  props: React.ComponentProps<typeof PopoverPrimitive.Trigger>
) {
  return <PopoverPrimitive.Trigger {...props} />
}

export function PopoverContent({
  className,
  align = "end",
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(
          "z-50 rounded-lg border border-rule bg-surface p-3 text-ink shadow-pop data-open:animate-in data-open:fade-in-0",
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}

/** Label + control pair used in forms. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: React.ReactNode
  htmlFor?: string
  hint?: React.ReactNode
  error?: string | null
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="mb-1 block text-xs font-medium text-ink-2"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-down" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink-3">{hint}</p>
      ) : null}
    </div>
  )
}
