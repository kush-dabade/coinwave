import { useMemo } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { MarketCoin } from "@/services/markets"

type VolumeVsMarketCapProps = {
  loading: boolean
  coins: MarketCoin[]
}

export function VolumeVsMarketCap({ loading, coins }: VolumeVsMarketCapProps) {
  const data = useMemo(
    () =>
      [...coins]
        .sort((a, b) => b.market_cap - a.market_cap)
        .slice(0, 10)
        .map((coin) => ({
          symbol: coin.symbol.toUpperCase(),
          marketCapB: coin.market_cap / 1_000_000_000,
          volumeB: coin.total_volume / 1_000_000_000,
        })),
    [coins]
  )

  return (
    <section className="space-y-3">
      <p className="text-xs tracking-[0.14em] text-white/45 uppercase">Volume vs Market Cap</p>
      <Card className="h-80 rounded-2xl border border-white/10 bg-white/5 p-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-36 rounded-full" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis
                dataKey="symbol"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
              />
              <YAxis
                yAxisId="left"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
                tickFormatter={(value: number) => `${value.toFixed(0)}B`}
                width={48}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
                tickFormatter={(value: number) => `${value.toFixed(0)}B`}
                width={48}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className="rounded-lg border border-white/15 bg-neutral-900/95 px-3 py-2 text-xs text-white">
                      <p className="font-medium">{label}</p>
                      <p className="mt-1 text-cyan-300">
                        Mkt Cap: ${Number(payload[0].value).toFixed(2)}B
                      </p>
                      <p className="text-emerald-300">
                        Volume: ${Number(payload[1].value).toFixed(2)}B
                      </p>
                    </div>
                  ) : null
                }
              />
              <Bar yAxisId="left" dataKey="marketCapB" fill="#22d3ee" radius={[6, 6, 0, 0]} />
              <Bar yAxisId="right" dataKey="volumeB" fill="#34d399" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/[0.03] text-sm text-white/65">
            Not enough data to compare volume and market cap right now.
          </div>
        )}
      </Card>
    </section>
  )
}
