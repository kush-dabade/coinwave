import { formatPrice, isNum } from "@/lib/format"

/** Where the current price sits within a low–high range (e.g. 24h). */
export function RangeBar({
  low,
  high,
  value,
  label,
}: {
  low: number | null
  high: number | null
  value: number | null
  label: string
}) {
  const valid = isNum(low) && isNum(high) && isNum(value) && high > low
  const pct = valid
    ? Math.min(100, Math.max(0, ((value - low) / (high - low)) * 100))
    : null
  return (
    <div>
      <div
        className="relative h-1.5 rounded-full bg-surface-2"
        aria-hidden="true"
      >
        {pct !== null && (
          <span
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-ink"
            style={{ left: `${pct}%` }}
          />
        )}
      </div>
      <div className="mt-2 flex justify-between text-xs text-ink-3">
        <span>
          Low <span className="num text-ink-2">{formatPrice(low)}</span>
        </span>
        <span>
          High <span className="num text-ink-2">{formatPrice(high)}</span>
        </span>
      </div>
      <p className="sr-only">
        {valid
          ? `${label}: low ${formatPrice(low)}, high ${formatPrice(high)}, current price ${Math.round(pct!)}% of the way from low to high.`
          : `${label} unavailable.`}
      </p>
    </div>
  )
}
