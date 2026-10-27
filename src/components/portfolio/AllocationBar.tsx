import { formatMoney, formatShare } from "@/lib/format"
import {
  sortTransactions,
  type Position,
  type Transaction,
} from "@/lib/portfolio"

const SLOTS = 6

/**
 * Colour follows the asset, not its rank: slots are assigned in order of
 * first purchase, so a price move never repaints the chart. Assets beyond the
 * sixth slot fold into "Other".
 */
function assignSlots(transactions: Transaction[], positions: Position[]) {
  const open = new Set(positions.map((p) => p.assetId))
  const order: string[] = []
  for (const tx of sortTransactions(transactions)) {
    if (open.has(tx.assetId) && !order.includes(tx.assetId))
      order.push(tx.assetId)
  }
  return new Map(order.map((id, i) => [id, i < SLOTS ? i + 1 : null]))
}

export function AllocationBar({
  positions,
  transactions,
  effectivePositions,
}: {
  positions: Position[]
  transactions: Transaction[]
  effectivePositions: number | null
}) {
  const priced = positions.filter((p) => p.weight !== null && p.weight > 0)
  const slots = assignSlots(transactions, priced)
  const named = priced.filter((p) => slots.get(p.assetId) !== null)
  const other = priced.filter((p) => slots.get(p.assetId) === null)
  const otherWeight = other.reduce((s, p) => s + (p.weight ?? 0), 0)
  const otherValue = other.reduce((s, p) => s + (p.value ?? 0), 0)

  const segments = [
    ...named.map((p) => ({
      key: p.assetId,
      label: p.name,
      symbol: p.symbol,
      weight: p.weight ?? 0,
      value: p.value,
      color: `var(--series-${slots.get(p.assetId)})`,
    })),
    ...(other.length
      ? [
          {
            key: "other",
            label: `Other (${other.length})`,
            symbol: "",
            weight: otherWeight,
            value: otherValue,
            color: "var(--series-other)",
          },
        ]
      : []),
  ]

  if (segments.length === 0) return null
  const largest = priced[0] ?? null

  return (
    <figure>
      <div
        className="flex h-4 w-full gap-[2px] overflow-hidden rounded-[4px]"
        aria-hidden="true"
      >
        {segments.map((s) => (
          <span
            key={s.key}
            style={{
              flexGrow: s.weight,
              flexBasis: 0,
              background: s.color,
              minWidth: 2,
            }}
          />
        ))}
      </div>
      <figcaption className="sr-only">
        Allocation by value:{" "}
        {segments.map((s) => `${s.label} ${formatShare(s.weight)}`).join(", ")}.
      </figcaption>
      <ul className="mt-4 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
        {segments.map((s) => (
          <li
            key={s.key}
            className="flex items-center gap-2.5 border-b border-rule py-2 text-sm"
          >
            <span
              className="size-2.5 shrink-0 rounded-[2px]"
              style={{ background: s.color }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate text-ink">
              {s.label}{" "}
              {s.symbol && <span className="text-ink-3">{s.symbol}</span>}
            </span>
            <span className="num w-14 text-right text-ink">
              {formatShare(s.weight)}
            </span>
            <span className="num hidden w-28 text-right text-ink-3 sm:inline">
              {formatMoney(s.value)}
            </span>
          </li>
        ))}
      </ul>
      {largest && effectivePositions !== null && priced.length > 1 && (
        <p className="mt-3 text-xs leading-5 text-ink-3">
          Largest position: {largest.name} at {formatShare(largest.weight)}.
          Your allocation behaves like {effectivePositions.toFixed(1)} equally
          sized positions.
        </p>
      )}
    </figure>
  )
}
