import { useMemo } from "react"
import { Lightbulb, TrendingDown, TrendingUp } from "lucide-react"

import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { MarketCoin, MarketGlobalData } from "@/services/markets"

type InsightsPanelProps = {
  loading: boolean
  coins: MarketCoin[]
  globalData: MarketGlobalData | null
}

export function InsightsPanel({ loading, coins, globalData }: InsightsPanelProps) {
  const insights = useMemo(() => {
    if (!coins.length || !globalData) return []

    const sorted = [...coins].sort(
      (a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h
    )
    const topFive = sorted.slice(0, 5)
    const topFiveAvg =
      topFive.reduce((sum, coin) => sum + coin.price_change_percentage_24h, 0) /
      Math.max(topFive.length, 1)
    const gainers = coins.filter((coin) => coin.price_change_percentage_24h > 0).length
    const losers = coins.length - gainers
    const btcDominance = globalData.market_cap_percentage.btc
    const marketChange = globalData.market_cap_change_percentage_24h_usd

    const lines = [
      btcDominance > 54
        ? "BTC dominance is increasing, suggesting capital is concentrating in large caps."
        : "BTC dominance is softening, giving room for selective altcoin leadership.",
      marketChange > 0
        ? `Market cap is up ${marketChange.toFixed(2)}% in 24h, signaling bullish momentum.`
        : `Market cap is down ${Math.abs(marketChange).toFixed(2)}% in 24h, risk appetite is cooling.`,
      topFiveAvg > 8
        ? "Top 5 gainers are averaging above 8%, indicating strong breakout behavior."
        : "Top gainers are mixed, favoring selective entries over broad risk-on exposure.",
      gainers > losers
        ? `${gainers} coins are green vs ${losers} red, breadth is favoring upside.`
        : `${losers} coins are red vs ${gainers} green, market breadth remains defensive.`,
    ]

    return lines
  }, [coins, globalData])

  return (
    <section className="space-y-3">
      <p className="text-xs tracking-[0.14em] text-white/45 uppercase">Insights</p>
      <Card className="rounded-2xl border border-white/10 bg-linear-to-br from-white/[0.07] to-white/[0.02] p-5">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-32 rounded-lg" />
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-4 w-full rounded-full" />
            ))}
          </div>
        ) : insights.length > 0 ? (
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">
              <Lightbulb className="h-3.5 w-3.5" />
              Generated Signals
            </div>
            <ul className="space-y-2.5">
              {insights.map((insight, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white/85"
                >
                  {index % 2 === 0 ? (
                    <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  ) : (
                    <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
                  )}
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-8 text-center text-sm text-white/65">
            We do not have enough market context to generate insights yet.
          </div>
        )}
      </Card>
    </section>
  )
}

