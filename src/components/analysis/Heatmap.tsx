import { useMemo, useState } from "react"

import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { safeNumber } from "@/lib/number"
import type { MarketCoin } from "@/services/markets"

type HeatmapProps = {
  loading: boolean
  coins: MarketCoin[]
}

function tileColor(change: number) {
  const intensity = Math.min(Math.abs(change) / 14, 1)
  if (change >= 0) {
    return `rgba(16, 185, 129, ${0.18 + intensity * 0.46})`
  }
  return `rgba(239, 68, 68, ${0.18 + intensity * 0.46})`
}

function capSpan(index: number) {
  if (index < 2) return "sm:col-span-2 sm:row-span-2"
  if (index < 6) return "sm:col-span-2"
  return ""
}

export function Heatmap({ loading, coins }: HeatmapProps) {
  const [selectedCoin, setSelectedCoin] = useState<MarketCoin | null>(null)

  const heatmapCoins = useMemo(() => {
    return [...coins].sort((a, b) => b.market_cap - a.market_cap).slice(0, 24)
  }, [coins])

  return (
    <section className="space-y-3">
      <p className="text-xs tracking-[0.14em] text-white/45 uppercase">Market Heatmap</p>
      <Card className="rounded-2xl border border-white/10 bg-white/5 p-5">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 12 }).map((_, index) => (
              <Skeleton key={index} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : heatmapCoins.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {heatmapCoins.map((coin, index) => {
              const positive = coin.price_change_percentage_24h >= 0
              return (
                <button
                  key={coin.id}
                  onClick={() => setSelectedCoin(coin)}
                  className={`group rounded-xl border border-white/10 p-3 text-left transition duration-200 hover:scale-[1.04] hover:border-white/20 ${capSpan(
                    index
                  )}`}
                  style={{ backgroundColor: tileColor(coin.price_change_percentage_24h) }}
                >
                  <p className="text-sm font-semibold text-white">{coin.symbol.toUpperCase()}</p>
                  <p className={`mt-1 text-xs font-medium ${positive ? "text-emerald-100" : "text-red-100"}`}>
                    {positive ? "+" : ""}
                    {safeNumber(coin.price_change_percentage_24h)}%
                  </p>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-8 text-center text-sm text-white/65">
            Heatmap is currently unavailable. We will populate it as soon as coin data loads.
          </div>
        )}
      </Card>

      <Dialog open={Boolean(selectedCoin)} onOpenChange={(open) => !open && setSelectedCoin(null)}>
        <DialogContent className="max-w-md border border-white/10 bg-neutral-950 text-white">
          <DialogHeader>
            <DialogTitle>{selectedCoin?.name ?? "Coin details"}</DialogTitle>
            <DialogDescription className="text-white/60">
              Quick market snapshot for the selected heatmap tile.
            </DialogDescription>
          </DialogHeader>
          {selectedCoin ? (
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-white/60">Price</span>
                <span className="font-medium text-white">
                  $
                  {selectedCoin.current_price.toLocaleString(undefined, {
                    maximumFractionDigits: selectedCoin.current_price > 1000 ? 0 : 2,
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">24h Change</span>
                <span
                  className={`font-medium ${
                    selectedCoin.price_change_percentage_24h >= 0
                      ? "text-emerald-300"
                      : "text-red-300"
                  }`}
                >
                  {selectedCoin.price_change_percentage_24h >= 0 ? "+" : ""}
                  {safeNumber(selectedCoin.price_change_percentage_24h)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Market Cap</span>
                <span className="font-medium text-white">
                  ${Math.round(selectedCoin.market_cap).toLocaleString()}
                </span>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  )
}

