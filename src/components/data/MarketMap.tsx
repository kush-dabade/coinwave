import { useMemo, type CSSProperties, type ReactNode } from "react"
import { Link } from "react-router-dom"

import { useElementSize } from "@/hooks/use-ui"
import {
  formatCompactMoney,
  formatPercent,
  formatPrice,
  isNum,
} from "@/lib/format"
import { squarify } from "@/lib/treemap"
import { cn } from "@/lib/utils"
import type { Asset } from "@/services/coingecko"

const STEPS = [0.25, 1, 2, 4, 8]

function level(change: number | null) {
  if (!isNum(change)) return 0
  const abs = Math.abs(change)
  let l = 0
  for (const step of STEPS) if (abs >= step) l++
  return l
}

function tileColor(change: number | null) {
  const l = level(change)
  if (l === 0) return "var(--tile-0)"
  return `var(--tile-${change! > 0 ? "up" : "down"}-${l})`
}

/**
 * The largest assets as a treemap: area is market capitalisation, colour is
 * the 24h price change on a diverging scale with a neutral midpoint.
 */
export function MarketMap({
  assets,
  maxTiles = 40,
}: {
  assets: Asset[]
  maxTiles?: number
}) {
  const [ref, size] = useElementSize<HTMLDivElement>()
  const items = useMemo(
    () => assets.filter((a) => isNum(a.marketCap)).slice(0, maxTiles),
    [assets, maxTiles]
  )
  const rects = useMemo(
    () => squarify(items, (a) => a.marketCap ?? 0, size.width, size.height),
    [items, size.width, size.height]
  )

  return (
    <figure>
      <div ref={ref} className="relative h-[340px] w-full sm:h-[420px]">
        <ul aria-label="Largest assets by market cap, coloured by 24-hour price change">
          {rects.map(({ item: a, x, y, w, h }) => {
            const strong = level(a.change24h) >= 4
            const big = w >= 112 && h >= 74
            const medium = !big && w >= 44 && h >= 36
            const small = !big && !medium && w >= 30 && h >= 18
            const symbolSize = Math.max(11, Math.min(26, Math.sqrt(w * h) / 7))
            return (
              <li key={a.id}>
                <Tile
                  // Tiles too small to tap reliably (under 24px) aren't links;
                  // the asset is still described and one click away in Markets.
                  href={w >= 26 && h >= 26 ? `/markets/${a.id}` : null}
                  aria-label={`${a.name} (${a.symbol}): ${formatPercent(a.change24h)} over 24 hours, market cap ${formatCompactMoney(a.marketCap)}`}
                  title={`${a.name} · ${formatPercent(a.change24h)}`}
                  className={cn(
                    "absolute flex flex-col overflow-hidden rounded-[3px] leading-tight transition-[filter] hover:z-10 hover:brightness-[1.06] focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
                    strong ? "text-[var(--tile-fg-strong)]" : "text-ink",
                    big
                      ? "p-2.5"
                      : "items-center justify-center p-0.5 text-center"
                  )}
                  style={{
                    left: x + 1,
                    top: y + 1,
                    width: Math.max(0, w - 2),
                    height: Math.max(0, h - 2),
                    background: tileColor(a.change24h),
                  }}
                >
                  {big && (
                    <>
                      <span
                        className="font-semibold tracking-tight"
                        style={{ fontSize: symbolSize }}
                      >
                        {a.symbol}
                      </span>
                      {a.name.toUpperCase() !== a.symbol && (
                        <span className="mt-0.5 truncate text-xs opacity-80">
                          {a.name}
                        </span>
                      )}
                      <span className="mt-auto flex items-baseline justify-between gap-2 text-xs">
                        <span className="num truncate opacity-90">
                          {formatPrice(a.price)}
                        </span>
                        <span className="num font-semibold">
                          {formatPercent(a.change24h)}
                        </span>
                      </span>
                    </>
                  )}
                  {medium && (
                    <>
                      <span className="max-w-full truncate px-0.5 text-xs font-semibold">
                        {a.symbol}
                      </span>
                      {h >= 50 && (
                        <span className="num mt-0.5 text-[11px] opacity-90">
                          {formatPercent(a.change24h, { digits: 1 })}
                        </span>
                      )}
                    </>
                  )}
                  {small && (
                    <span className="max-w-full truncate text-[10px] font-semibold">
                      {a.symbol}
                    </span>
                  )}
                </Tile>
              </li>
            )
          })}
        </ul>
      </div>
      <figcaption className="mt-3 flex flex-col gap-2 text-xs text-ink-3 sm:flex-row sm:items-center sm:justify-between">
        <span>
          Area: market cap · Colour: 24h price change · {items.length} largest
          assets
        </span>
        <MapLegend />
      </figcaption>
    </figure>
  )
}

function Tile({
  href,
  ...props
}: {
  href: string | null
  "aria-label": string
  title: string
  className: string
  style: CSSProperties
  children: ReactNode
}) {
  return href ? <Link to={href} {...props} /> : <span role="img" {...props} />
}

function MapLegend() {
  const swatches = [
    ...[5, 4, 3, 2, 1].map((l) => `var(--tile-down-${l})`),
    "var(--tile-0)",
    ...[1, 2, 3, 4, 5].map((l) => `var(--tile-up-${l})`),
  ]
  return (
    <span className="flex items-center gap-2" aria-hidden="true">
      <span className="num">−8%</span>
      <span className="flex">
        {swatches.map((bg, i) => (
          <span
            key={i}
            className="h-2.5 w-3.5 first:rounded-l-sm last:rounded-r-sm"
            style={{ background: bg }}
          />
        ))}
      </span>
      <span className="num">+8%</span>
    </span>
  )
}
