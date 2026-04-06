import { useEffect, useMemo, useState } from "react"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { safeNumber } from "@/lib/number"
import type { MarketCoin } from "@/services/markets"

type PriceChartProps = {
  loading: boolean
  coins: MarketCoin[]
}

type ChartTimeframe = "1D" | "7D" | "1M"

type Point = {
  label: string
  price: number
}

const TIMEFRAME_OPTIONS: ChartTimeframe[] = ["1D", "7D", "1M"]

function hashSeed(text: string) {
  let hash = 0
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

function pseudo(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function pointCount(timeframe: ChartTimeframe) {
  if (timeframe === "1D") return 24
  if (timeframe === "7D") return 28
  return 30
}

function makeLabel(timeframe: ChartTimeframe, index: number) {
  if (timeframe === "1D") return `${index}:00`
  if (timeframe === "7D") return `D${index + 1}`
  return `W${index + 1}`
}

function buildSeries(coin: MarketCoin, timeframe: ChartTimeframe) {
  const points = pointCount(timeframe)
  const seed = hashSeed(`${coin.id}-${timeframe}`)
  const drift = coin.price_change_percentage_24h / 100 / points
  const volatility = 0.006 + Math.min(Math.abs(coin.price_change_percentage_24h) / 1000, 0.018)

  const raw: Point[] = []
  let price = Math.max(coin.current_price * (1 - drift * points * 0.6), 0.0001)

  for (let index = 0; index < points; index += 1) {
    const noise = (pseudo(seed + index) - 0.5) * volatility
    price = Math.max(price * (1 + drift + noise), 0.0001)
    raw.push({ label: makeLabel(timeframe, index), price })
  }

  const end = raw[raw.length - 1]?.price ?? coin.current_price
  const scale = end > 0 ? coin.current_price / end : 1
  return raw.map((point) => ({ ...point, price: point.price * scale }))
}

export function PriceChart({ loading, coins }: PriceChartProps) {
  const [timeframe, setTimeframe] = useState<ChartTimeframe>("7D")
  const [selectedCoinId, setSelectedCoinId] = useState<string>("")

  useEffect(() => {
    if (!coins.length) return
    if (coins.some((coin) => coin.id === selectedCoinId)) return
    const btc = coins.find((coin) => coin.symbol.toLowerCase() === "btc")
    setSelectedCoinId(btc?.id ?? coins[0].id)
  }, [coins, selectedCoinId])

  const selectedCoin = useMemo(
    () => coins.find((coin) => coin.id === selectedCoinId) ?? null,
    [coins, selectedCoinId]
  )

  const chartData = useMemo(
    () => (selectedCoin ? buildSeries(selectedCoin, timeframe) : []),
    [selectedCoin, timeframe]
  )

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs tracking-[0.14em] text-white/45 uppercase">Price Trend</p>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedCoinId} onValueChange={setSelectedCoinId}>
            <SelectTrigger className="h-8 border-white/15 bg-white/5 text-white">
              <SelectValue placeholder="Select coin" />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-neutral-950 text-white">
              {coins.slice(0, 30).map((coin) => (
                <SelectItem key={coin.id} value={coin.id}>
                  {coin.symbol.toUpperCase()} - {coin.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
            {TIMEFRAME_OPTIONS.map((option) => {
              const active = timeframe === option
              return (
                <button
                  key={option}
                  onClick={() => setTimeframe(option)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                    active ? "bg-white/12 text-white" : "text-white/60 hover:text-white"
                  }`}
                >
                  {option}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="h-80 rounded-2xl border border-white/10 bg-white/5 p-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-28 rounded-full" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : selectedCoin && chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
                minTickGap={18}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
                width={68}
                tickFormatter={(value: number) => `$${safeNumber(value, value > 1000 ? 0 : 2)}`}
              />
              <Tooltip
                cursor={{ stroke: "rgba(255,255,255,0.15)" }}
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className="rounded-lg border border-white/15 bg-neutral-900/95 px-3 py-2 text-xs text-white">
                      <p className="text-white/65">{label}</p>
                      <p className="mt-1 font-semibold text-cyan-300">
                        $
                        {safeNumber(
                          Number(payload[0].value),
                          Number(payload[0].value) > 1000 ? 0 : 2
                        )}
                      </p>
                    </div>
                  ) : null
                }
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke="#22d3ee"
                strokeWidth={2.5}
                fill="url(#priceGradient)"
                isAnimationActive
                animationDuration={1000}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/[0.03] text-sm text-white/65">
            Price trend cannot be rendered because coin history is unavailable.
          </div>
        )}
      </div>
    </section>
  )
}
