import type { ReactNode } from "react"
import { ArrowDown, ArrowUp } from "lucide-react"
import { Link } from "react-router-dom"

import { AssetIcon } from "@/components/data/AssetIcon"
import { T } from "@/lib/table"
import { cn } from "@/lib/utils"

export function SortHeader<K extends string>({
  label,
  srLabel,
  sortKey,
  sort,
  onSort,
  align = "right",
  className,
}: {
  label: ReactNode
  srLabel?: string
  sortKey: K
  sort: { key: string; dir: "asc" | "desc" }
  onSort: (key: K) => void
  align?: "left" | "right"
  className?: string
}) {
  const active = sort.key === sortKey
  return (
    <th
      scope="col"
      aria-sort={
        active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined
      }
      className={cn(
        T.th,
        align === "right" ? "text-right" : "text-left",
        className
      )}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm uppercase hover:text-ink",
          align === "right" && "flex-row-reverse",
          active && "text-ink"
        )}
      >
        {srLabel ? (
          <>
            <span aria-hidden="true">{label}</span>
            <span className="sr-only">{srLabel}</span>
          </>
        ) : (
          label
        )}
        {active &&
          (sort.dir === "asc" ? (
            <ArrowUp className="size-3" aria-hidden="true" />
          ) : (
            <ArrowDown className="size-3" aria-hidden="true" />
          ))}
      </button>
    </th>
  )
}

/** Icon + name (link to research) + ticker. */
export function AssetCell({
  id,
  name,
  symbol,
  image,
  sub,
  size = 20,
}: {
  id: string
  name: string
  symbol: string
  image: string | null
  sub?: ReactNode
  size?: number
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <AssetIcon src={image} symbol={symbol} size={size} />
      {/* Capped so a long name (some funds run to 50 characters) truncates
          instead of widening the whole table. */}
      <div className="max-w-[13rem] min-w-0">
        <Link
          to={`/markets/${id}`}
          title={name}
          className="block truncate font-medium text-ink hover:underline"
        >
          {name}
        </Link>
        {(symbol || sub) && (
          <span className="mono block truncate text-[0.6875rem] text-ink-3">
            {symbol}
            {sub}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * A horizontally (or vertically) scrolling container for a wide table. It is
 * focusable and labelled so keyboard users can scroll it too.
 */
export function ScrollRegion({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className={cn(
        "overflow-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
        className
      )}
    >
      {children}
    </div>
  )
}
