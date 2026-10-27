import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/** Content column for a workspace page. Desktop uses the full width. */
export function Page({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1680px] px-3 pt-4 pb-10 sm:px-5 lg:pt-5",
        className
      )}
    >
      {children}
    </div>
  )
}

/** @deprecated kept for older call sites. */
export const Container = Page

/** Compact page title row: a workstation, not a landing page. */
export function PageHeader({
  title,
  description,
  actions,
  meta,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  meta?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="text-[1.25rem] leading-7 font-semibold tracking-[-0.01em] text-ink">
          {title}
        </h1>
        {description && (
          <p className="mt-0.5 max-w-3xl text-[0.8125rem] text-ink-3">
            {description}
          </p>
        )}
        {meta && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
            {meta}
          </div>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  )
}

/**
 * A pane: one module of a workspace. Hairline border, compact header with a
 * title, optional subtitle and right-aligned actions.
 */
export function Pane({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
  id,
  flush = false,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  id?: string
  /** Remove body padding (for tables and charts that run edge to edge). */
  flush?: boolean
}) {
  const headingId = id ? `${id}-title` : undefined
  return (
    <section
      aria-labelledby={title ? headingId : undefined}
      className={cn(
        "flex min-w-0 flex-col rounded-md border border-rule bg-surface",
        className
      )}
    >
      {(title || actions) && (
        <header className="flex min-h-10 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-rule px-3 py-1.5">
          <div className="min-w-0">
            {title && (
              <h2
                id={headingId}
                className="text-[0.8125rem] font-semibold text-ink"
              >
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-[0.6875rem] text-ink-3">{subtitle}</p>
            )}
          </div>
          {actions && (
            <div className="flex flex-wrap items-center gap-1.5">{actions}</div>
          )}
        </header>
      )}
      <div className={cn("min-h-0 flex-1", !flush && "p-3", bodyClassName)}>
        {children}
      </div>
    </section>
  )
}
