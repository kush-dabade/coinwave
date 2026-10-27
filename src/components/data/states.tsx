import type { ReactNode } from "react"
import { AlertTriangle, RotateCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { describeError } from "@/services/coingecko"
import { cn } from "@/lib/utils"

export function Skeleton({
  className,
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("skeleton block", className)}
      style={style}
    />
  )
}

/** Inline notice for a failed request. Shown in place of (not on top of) content. */
export function ErrorNotice({
  error,
  onRetry,
  title = "Couldn’t load this data",
  className,
}: {
  error: unknown
  onRetry?: () => void
  title?: string
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-start gap-3 rounded-lg border border-rule bg-surface px-4 py-4 sm:flex-row sm:items-center",
        className
      )}
    >
      <AlertTriangle className="size-5 shrink-0 text-warn" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">{title}</p>
        <p className="text-sm text-ink-2">
          {describeError(error)} It will retry automatically.
        </p>
      </div>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          <RotateCw aria-hidden="true" />
          Try again
        </Button>
      )}
    </div>
  )
}

export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  title: string
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-lg border border-dashed border-rule-strong px-6 py-10 text-center",
        className
      )}
    >
      <p className="font-serif text-lg font-medium text-ink">{title}</p>
      {children && (
        <div className="mt-1 max-w-md text-sm text-ink-2">{children}</div>
      )}
      {action && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>
      )}
    </div>
  )
}

/** Section heading: small tracked label over a hairline, optional trailing slot. */
export function SectionHeading({
  id,
  children,
  aside,
  className,
}: {
  id?: string
  children: ReactNode
  aside?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-b border-rule pb-2",
        className
      )}
    >
      <h2 id={id} className="eyebrow">
        {children}
      </h2>
      {aside && <div className="text-xs text-ink-3">{aside}</div>}
    </div>
  )
}
