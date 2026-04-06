import { useMemo } from "react"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip } from "recharts"

import { AnimatedNumber } from "@/components/ui/animated-number"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { safeNumber } from "@/lib/number"
import type { MarketCoin } from "@/services/markets"

type TopMoversProps = {
  loading: boolean
  coins: MarketCoin[]
}

function sparklineData(coin: MarketCoin) {
  const source = coin.sparkline_in_7d?.price ?? []
  const values =
    source.length > 10
      ? source.slice(-20)
      : Array.from({ length: 20 }, (_, index) => {
          const progress = index / 19
          return coin.current_price * (1 + (coin.price_change_percentage_24h / 100) * progress * 0.35)
        })

  return values.map((value, index) => ({ index, value }))
}

function formatPrice(value: number) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: value > 1000 ? 0 : 2 })}`
}

function Sparkline({ coin }: { coin: MarketCoin }) {
  const data = useMemo(() => sparklineData(coin), [coin])
  const positive = coin.price_change_percentage_24h >= 0

  return (
    <div className="h-10 w-28">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid vertical={false} horizontal={false} />
          <Tooltip
            cursor={false}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="rounded-md border border-white/10 bg-neutral-900/95 px-2 py-1 text-[11px] text-white/80">
                  ${safeNumber(Number(payload[0].value), 2)}
                </div>
              ) : null
            }
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={positive ? "#34d399" : "#f87171"}
            strokeWidth={2}
            dot={false}
            isAnimationActive
            animationDuration={900}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function MoverList({ title, coins }: { title: string; coins: MarketCoin[] }) {
  return (
    <Card
      interactive
      className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_20px_45px_-30px_rgba(0,0,0,0.9)] backdrop-blur-md"
    >
      <h3 className="text-sm font-semibold tracking-wide text-white">{title}</h3>
      <div className="mt-4 space-y-3">
        {coins.map((coin) => {
          const positive = coin.price_change_percentage_24h >= 0
          return (
            <div
              key={coin.id}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5"
            >
              <div>
                <p className="text-sm font-medium text-white">{coin.name}</p>
                <p className="text-xs text-white/55">{formatPrice(coin.current_price)}</p>
              </div>
              <p className={`text-xs font-semibold ${positive ? "text-emerald-300" : "text-red-300"}`}>
                <AnimatedNumber
                  value={coin.price_change_percentage_24h}
                  flash
                  className="text-current"
                  format={(value) => `${value > 0 ? "+" : ""}${safeNumber(value)}%`}
                />
              </p>
              <Sparkline coin={coin} />
            </div>
          )
        })}
      </div>
    </Card>
  )
}

export function TopMovers({ loading, coins }: TopMoversProps) {
  const { gainers, losers } = useMemo(() => {
    const sorted = [...coins].sort(
      (a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h
    )
    return {
      gainers: sorted.filter((coin) => coin.price_change_percentage_24h >= 0).slice(0, 5),
      losers: sorted
        .filter((coin) => coin.price_change_percentage_24h < 0)
        .sort((a, b) => a.price_change_percentage_24h - b.price_change_percentage_24h)
        .slice(0, 5),
    }
  }, [coins])

  return (
    <section className="space-y-3">
      <p className="text-xs tracking-[0.14em] text-white/45 uppercase">Top Movers</p>
      {loading ? (
        <div className="grid gap-6 xl:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <Card key={index} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <Skeleton className="h-5 w-32 rounded-lg" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: 5 }).map((_, row) => (
                  <div
                    key={row}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5"
                  >
                    <Skeleton className="h-9 w-full rounded-lg" />
                    <Skeleton className="h-4 w-12 rounded-full" />
                    <Skeleton className="h-10 w-28 rounded-lg" />
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      ) : gainers.length > 0 || losers.length > 0 ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <MoverList title="Top Gainers" coins={gainers} />
          <MoverList title="Top Losers" coins={losers} />
        </div>
      ) : (
        <Card className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/65">
          No movers available right now. Check back after the next market refresh.
        </Card>
      )}
    </section>
  )
}

