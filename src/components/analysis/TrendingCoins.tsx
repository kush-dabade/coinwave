import { useMemo } from "react"

import { AnimatedNumber } from "@/components/ui/animated-number"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { safeNumber } from "@/lib/number"
import type { MarketCoin } from "@/services/markets"

type TrendingCoinsProps = {
  loading: boolean
  coins: MarketCoin[]
  trendingIds: string[]
}

export function TrendingCoins({ loading, coins, trendingIds }: TrendingCoinsProps) {
  const trending = useMemo(() => {
    const trendingSet = new Set(trendingIds)
    const picks = coins.filter((coin) => trendingSet.has(coin.id))
    if (picks.length > 0) return picks.slice(0, 12)
    return [...coins].sort((a, b) => b.total_volume - a.total_volume).slice(0, 12)
  }, [coins, trendingIds])

  return (
    <section className="space-y-3">
      <p className="text-xs tracking-[0.14em] text-white/45 uppercase">Trending Coins</p>
      <Card className="rounded-2xl border border-white/10 bg-white/5 p-5">
        {loading ? (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="min-w-[180px] rounded-xl border border-white/10 bg-white/[0.03] p-3"
              >
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="mt-3 h-4 w-24 rounded-full" />
                <Skeleton className="mt-2 h-3 w-20 rounded-full" />
              </div>
            ))}
          </div>
        ) : trending.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto pb-1 scroll-smooth">
            {trending.map((coin) => {
              const positive = coin.price_change_percentage_24h >= 0
              return (
                <article
                  key={coin.id}
                  className="min-w-[180px] rounded-xl border border-white/10 bg-white/[0.03] p-3 transition duration-200 hover:scale-[1.03] hover:bg-white/[0.07]"
                >
                  <div className="flex items-center gap-2">
                    <img src={coin.image} alt={coin.name} className="h-6 w-6 rounded-full" />
                    <div>
                      <p className="text-sm font-medium text-white">{coin.name}</p>
                      <p className="text-xs uppercase text-white/50">{coin.symbol}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-white">
                    <AnimatedNumber
                      value={coin.current_price}
                      format={(value) => `$${safeNumber(value, value > 1000 ? 0 : 2)}`}
                    />
                  </p>
                  <p className={`mt-1 text-xs font-medium ${positive ? "text-emerald-300" : "text-red-300"}`}>
                    <AnimatedNumber
                      value={coin.price_change_percentage_24h}
                      flash
                      className="text-current"
                      format={(value) => `${value > 0 ? "+" : ""}${safeNumber(value)}%`}
                    />
                  </p>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-8 text-center text-sm text-white/65">
            No trending assets at the moment. Please try again shortly.
          </div>
        )}
      </Card>
    </section>
  )
}

