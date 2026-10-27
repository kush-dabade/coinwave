import { formatMoney, formatPercent } from "@/lib/format"
import { cn, toneClass } from "@/lib/utils"

/**
 * A signed change. Direction is carried by the sign as well as colour, so it
 * never depends on colour alone.
 */
export function Change({
  value,
  kind = "percent",
  className,
  digits,
}: {
  value: number | null | undefined
  kind?: "percent" | "money"
  className?: string
  digits?: number
}) {
  return (
    <span className={cn("num whitespace-nowrap", toneClass(value), className)}>
      {kind === "money"
        ? formatMoney(value, { signed: true })
        : formatPercent(value, { digits })}
    </span>
  )
}
