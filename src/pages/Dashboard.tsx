/* eslint-disable react-hooks/set-state-in-effect */
import { Button } from "@/components/ui/button"

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../components/ui/card"
import { Area, AreaChart, XAxis, Treemap, ResponsiveContainer } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  CardSkeleton,
  ChartSkeleton,
  Skeleton,
  TableSkeleton,
} from "@/components/ui/skeleton"
import { AnimatedNumber } from "@/components/ui/animated-number"

import { useCallback, useEffect, useId, useState } from "react"

import { COIN_MAP } from "@/lib/portfolio"

import { PieChart, TrendingUp } from "lucide-react"
interface ChartDataPoint {
  date: string
  value: number
}

interface Coin {
  id: string
  name: string
  symbol: string
  image: string
  current_price: number
  price_change_percentage_24h: number
}

interface GlobalData {
  total_market_cap: {
    usd: number
  }
  total_volume: {
    usd: number
  }
}

type Holding = {
  symbol: string
  amount: number
  avgPrice: number
}

interface HeatmapDataPoint {
  name: string
  symbol: string
  size: number
  change: number
  [key: string]: string | number
}

interface CustomContentProps {
  x: number
  y: number
  width: number
  height: number
  name: string
  symbol: string
  change: number
}

async function fetchDashboardData() {
  const [globalRes, coinsRes, chartRes] = await Promise.all([
    fetch("https://api.coingecko.com/api/v3/global"),
    fetch("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd"),
    fetch(
      "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=7"
    ),
  ])

  const globalJson = await globalRes.json()
  const coinsJson: Coin[] = await coinsRes.json()
  const chartJson = await chartRes.json()

  const marketFormatted: ChartDataPoint[] = chartJson.prices.map(
    (item: [number, number]) => ({
      date: new Date(item[0]).toLocaleDateString("en-US", { weekday: "short" }),
      value: item[1],
    })
  )

  const volumeFormatted: ChartDataPoint[] = chartJson.total_volumes.map(
    (item: [number, number]) => ({
      date: new Date(item[0]).toLocaleDateString("en-US", { weekday: "short" }),
      value: item[1],
    })
  )

  return {
    globalData: globalJson.data as GlobalData,
    coins: coinsJson,
    marketChart: marketFormatted,
    volumeChart: volumeFormatted,
  }
}

function getHeatmapColor(value: number = 0): string {
  const intensity = Math.min(Math.abs(value), 10)
  return value >= 0
    ? `rgba(34, 197, 94, ${0.35 + intensity / 15})`
    : `rgba(239, 68, 68, ${0.35 + intensity / 15})`
}

function CustomContent({
  x,
  y,
  width,
  height,
  symbol,
  change,
}: CustomContentProps) {
  const area = width * height

  return (
    <g style={{ transition: "all 0.2s ease", cursor: "pointer" }}>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={6}
        style={{
          fill: getHeatmapColor(change),
          stroke: "rgba(0,0,0,0.4)",
          strokeWidth: 1,
          cursor: "pointer",
        }}
      />
      {area > 2500 && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 - 5}
            textAnchor="middle"
            fill="white"
            fontSize={13}
            fontWeight={700}
            stroke="none"
          >
            {symbol}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + 12}
            textAnchor="middle"
            fill="white"
            fontSize={10}
            opacity={0.8}
            stroke="none"
          >
            {typeof change === "number"
              ? `${change > 0 ? "+" : ""}${change.toFixed(2)}%`
              : ""}
          </text>
        </>
      )}
      {area > 800 && area <= 2500 && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          fill="white"
          fontSize={10}
          fontWeight={600}
          stroke="none"
        >
          {symbol}
        </text>
      )}
      {area > 300 && area <= 800 && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          fill="white"
          fontSize={8}
          opacity={0.7}
          stroke="none"
        >
          {symbol}
        </text>
      )}
    </g>
  )
}

function PortfolioHeatmap({ data }: { data: HeatmapDataPoint[] }) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-xs text-white/40">
        <span>Allocation</span>
        <span>24h Change</span>
      </div>
      <div className="h-72 w-full min-w-0 overflow-hidden rounded-xl">
        <ResponsiveContainer>
          <Treemap
            data={data}
            dataKey="size"
            content={
              <CustomContent
                x={0}
                y={0}
                width={0}
                height={0}
                name=""
                symbol=""
                change={0}
              />
            }
          />
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function MiniChart({ data }: { data: ChartDataPoint[] }) {
  const gradientId = useId().replace(/:/g, "")
  const glowId = useId().replace(/:/g, "")

  return (
    <div className="mt-3 h-32">
      <ChartContainer
        config={{
          value: {
            label: "Value",
            color: "hsl(142, 76%, 36%)",
          },
        }}
      >
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`mini-fill-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(142 76% 36%)" stopOpacity={0.4} />
              <stop
                offset="100%"
                stopColor="hsl(142 76% 36%)"
                stopOpacity={0.04}
              />
            </linearGradient>
            <filter
              id={`mini-glow-${glowId}`}
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
              <feDropShadow
                dx="0"
                dy="0"
                stdDeviation="2"
                floodColor="hsl(142 76% 36%)"
                floodOpacity="0.35"
              />
            </filter>
          </defs>
          <XAxis dataKey="date" hide />
          <ChartTooltip
            cursor={{ stroke: "rgba(255,255,255,0.22)", strokeWidth: 1 }}
            wrapperStyle={{
              transition: "transform 120ms ease-out",
              pointerEvents: "none",
            }}
            content={
              <ChartTooltipContent
                className="border-white/15 bg-neutral-900/95 text-white shadow-[0_14px_30px_-16px_rgba(0,0,0,0.9)] backdrop-blur-md"
                indicator="line"
              />
            }
          />
          <Area
            dataKey="value"
            type="monotone"
            fill={`url(#mini-fill-${gradientId})`}
            stroke="hsl(142 76% 36%)"
            strokeWidth={2}
            filter={`url(#mini-glow-${glowId})`}
            isAnimationActive
            animationDuration={720}
            animationEasing="ease-out"
            dot={false}
            activeDot={{
              r: 4.5,
              stroke: "rgba(255,255,255,0.9)",
              strokeWidth: 1.5,
              fill: "hsl(142 76% 36%)",
            }}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  )
}

const Dashboard = () => {
  const [globalData, setGlobalData] = useState<GlobalData | null>(null)
  const [coins, setCoins] = useState<Coin[]>([])
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [marketChart, setMarketChart] = useState<ChartDataPoint[]>([])
  const [volumeChart, setVolumeChart] = useState<ChartDataPoint[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  console.log(lastUpdated)

  const loadData = useCallback(async () => {
    try {
      const data = await fetchDashboardData()
      setGlobalData(data.globalData)
      setCoins(data.coins)
      setMarketChart(data.marketChart)
      setVolumeChart(data.volumeChart)
      setLastUpdated(new Date())
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err)
    }
  }, [])

  useEffect(() => {
    const fetchSafe = () => {
      if (document.hidden) return
      loadData()
    }

    fetchSafe()

    const interval = setInterval(fetchSafe, 30000)

    return () => clearInterval(interval)
  }, [loadData])

  useEffect(() => {
    const stored = localStorage.getItem("coinwave_holdings")
    if (stored) {
      setHoldings(JSON.parse(stored))
    }
  }, [])

  interface CoinWithAmount extends Coin {
    amount: number
  }

  const portfolioCoins = holdings.flatMap((h) => {
    const coinId = COIN_MAP[h.symbol]
    const coin = coins.find((c) => c.id === coinId)

    return coin ? [{ ...coin, amount: h.amount }] : []
  })

  const totalValue = portfolioCoins.reduce(
    (sum, c: CoinWithAmount) => sum + c.amount * c.current_price,
    0
  )

  const totalPnL = portfolioCoins.reduce((sum, c: CoinWithAmount) => {
    const holding = holdings.find((h) => COIN_MAP[h.symbol] === c.id)

    if (!holding) return sum

    const pnl = (c.current_price - holding.avgPrice) * holding.amount
    return sum + pnl
  }, 0)

  const heatmapData = portfolioCoins.map((coin: CoinWithAmount) => {
    const value = coin.amount * coin.current_price

    return {
      name: coin.symbol.toUpperCase(),
      symbol: coin.symbol.toUpperCase(),
      size: (value / totalValue) * 100,
      change: coin.price_change_percentage_24h,
    }
  })

  const isDashboardLoading =
    !globalData ||
    coins.length === 0 ||
    marketChart.length === 0 ||
    volumeChart.length === 0

  return (
    <div className="my-6 space-y-6 p-2">
      <Card
        interactive
        className="border-white/10 bg-linear-to-b from-white/3 to-white/1 px-5 py-5 shadow-lg shadow-black/20 backdrop-blur-xl"
      >
        <CardHeader className="mb-4 flex flex-row items-start justify-between p-0">
          {/* LEFT */}
          <div>
            <CardTitle className="text-lg font-semibold tracking-tight">
              Market Overview
            </CardTitle>

            <CardDescription className="mt-1 text-sm text-white/60">
              Welcome back, Admin. Here's what's happening today.
            </CardDescription>
          </div>
          {/* RIGHT */}
          <div className="flex items-center gap-2">
            <HoverCard>
              <HoverCardTrigger asChild>
                <Button className="group relative rounded-lg border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-white/80 backdrop-blur-md transition-all duration-200 hover:border-white/20 hover:bg-white/10 hover:text-white">
                  Portfolio
                  <PieChart className="h-4 w-4 opacity-70" />
                </Button>
              </HoverCardTrigger>

              <HoverCardContent className="w-72 border-white/10 bg-neutral-900/90 shadow-xl backdrop-blur-xl transition-all duration-200 data-[state=open]:animate-in data-[state=open]:zoom-in-95 data-[state=open]:fade-in">
                <div className="space-y-4 text-sm">
                  {/* HEADER */}
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-white/50">Portfolio</p>
                    <span className="text-[10px] text-white/40">Live</span>
                  </div>

                  {/* VALUE */}
                  <div>
                    <p className="text-xs text-white/50">Total Value</p>
                    <p className="text-xl font-semibold tabular-nums">
                      <AnimatedNumber
                        value={totalValue}
                        format={(v) => `$${v.toLocaleString()}`}
                      />
                    </p>
                  </div>

                  {/* STATS */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-md bg-white/5 p-2">
                      <p className="text-white/50">Assets</p>
                      <p className="font-medium">{portfolioCoins.length}</p>
                    </div>

                    <div className="rounded-md bg-white/5 p-2">
                      <p className="text-white/50">Top Holding</p>
                      <p className="font-medium">
                        {portfolioCoins.length > 0
                          ? portfolioCoins.reduce(
                              (a: CoinWithAmount, b: CoinWithAmount) =>
                                a.amount * a.current_price >
                                b.amount * b.current_price
                                  ? a
                                  : b
                            ).name
                          : "-"}
                      </p>
                    </div>
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>

            <HoverCard>
              <HoverCardTrigger asChild>
                <Button className="group relative rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-300 transition-all duration-200 hover:bg-emerald-500/20 hover:text-emerald-200">
                  P&L <TrendingUp className="h-4 w-4 opacity-70" />
                </Button>
              </HoverCardTrigger>

              <HoverCardContent className="w-72 border-white/10 bg-neutral-900/90 shadow-xl backdrop-blur-xl transition-all duration-200 data-[state=open]:animate-in data-[state=open]:zoom-in-95 data-[state=open]:fade-in">
                <div className="space-y-4 text-sm">
                  {/* HEADER */}
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-white/50">Performance</p>
                    <span className="text-[10px] text-white/40">24h</span>
                  </div>

                  {/* TOTAL PNL */}
                  <div>
                    <p className="text-xs text-white/50">Total P&L</p>
                    <p
                      className={`text-xl font-semibold tabular-nums ${
                        totalPnL >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      <AnimatedNumber
                        value={totalPnL}
                        format={(v) => `$${v.toLocaleString()}`}
                      />
                    </p>
                  </div>

                  {/* BEST / WORST */}
                  {portfolioCoins.length > 0 &&
                    (() => {
                      type EnrichedCoin = {
                        name: string
                        symbol: string
                        pnl: number
                      }

                      const enriched: EnrichedCoin[] = portfolioCoins
                        .map((coin: CoinWithAmount) => {
                          const h = holdings.find(
                            (h) => COIN_MAP[h.symbol] === coin.id
                          )
                          if (!h) return null

                          const pnl =
                            (coin.current_price - h.avgPrice) * h.amount

                          return {
                            name: coin.name,
                            symbol: coin.symbol.toUpperCase(),
                            pnl,
                          }
                        })
                        .filter((c): c is EnrichedCoin => c !== null)

                      if (enriched.length === 0) return null

                      const best = enriched.reduce((a, b) =>
                        a.pnl > b.pnl ? a : b
                      )

                      const worst = enriched.reduce((a, b) =>
                        a.pnl < b.pnl ? a : b
                      )

                      return (
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          {/* BEST */}
                          <div className="rounded-md bg-emerald-500/10 p-2">
                            <p className="text-emerald-300">Best</p>
                            <p className="font-semibold text-white">
                              {best.name}
                            </p>
                            <p className="text-[10px] text-white/40">
                              {best.symbol}
                            </p>
                          </div>

                          {/* WORST */}
                          <div className="rounded-md bg-red-500/10 p-2">
                            <p className="text-red-300">Worst</p>
                            <p className="font-semibold text-white">
                              {worst.name}
                            </p>
                            <p className="text-[10px] text-white/40">
                              {worst.symbol}
                            </p>
                          </div>
                        </div>
                      )
                    })()}
                </div>
              </HoverCardContent>
            </HoverCard>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-3 gap-4">
            {/* Market Cap */}
            <Card interactive className="border-white/10 bg-white/5 p-4">
              <p className="text-xs tracking-wide text-white/50 uppercase">
                Market Cap
              </p>
              {isDashboardLoading ? (
                <ChartSkeleton className="mt-2" />
              ) : (
                <>
                  <h2 className="text-xl font-semibold tracking-tight">
                    <AnimatedNumber
                      value={(globalData?.total_market_cap.usd || 0) / 1e12}
                      format={(v) => `$${v.toFixed(2)}T`}
                    />
                  </h2>
                  <MiniChart data={marketChart} />
                </>
              )}
            </Card>

            {/* Volume */}
            <Card interactive className="border-white/10 bg-white/5 p-4">
              <p className="text-xs tracking-wide text-white/50 uppercase">
                24h Volume
              </p>
              {isDashboardLoading ? (
                <ChartSkeleton className="mt-2" />
              ) : (
                <>
                  <h2 className="text-xl font-semibold tracking-tight">
                    <AnimatedNumber
                      value={(globalData?.total_volume.usd || 0) / 1e9}
                      format={(v) => `$${v.toFixed(2)}B`}
                    />
                  </h2>
                  <MiniChart data={volumeChart} />
                </>
              )}
            </Card>

            {/* Trending */}
            <Card interactive className="border-white/10 bg-white/5 p-4">
              <p className="text-xs tracking-wide text-white/50 uppercase">
                Trending Currencies
              </p>
              <div className="mt-1 text-sm font-medium">
                {isDashboardLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded-md py-2"
                      >
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-6 w-6 rounded-full" />
                          <Skeleton className="h-3 w-28 rounded-full" />
                        </div>
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-3 w-16 rounded-full" />
                          <Skeleton className="h-3 w-12 rounded-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : coins.length > 0 ? (
                  <div className="divide-y divide-white/10">
                    {coins.slice(0, 5).map((coin) => {
                      const isUp = coin.price_change_percentage_24h >= 0

                      return (
                        <div
                          key={coin.id}
                          className="flex items-center justify-between rounded-md py-2 transition-all duration-150 first:pt-0 last:pb-0 hover:translate-x-0.5 hover:bg-white/5"
                        >
                          {/* LEFT */}
                          <div className="flex items-center gap-3">
                            <img
                              src={coin.image}
                              className="h-6 w-6 rounded-full"
                            />
                            <p className="text-white/90">{coin.name}</p>
                          </div>

                          {/* RIGHT */}
                          <div className="flex items-center gap-2 text-sm">
                            <p className="text-white/80">
                              <AnimatedNumber
                                value={coin.current_price}
                                format={(v) => `$${v.toFixed(2)}`}
                              />
                            </p>

                            <div
                              className={`flex items-center gap-1 ${
                                isUp ? "text-emerald-400" : "text-red-400"
                              }`}
                            >
                              <span>{isUp ? "▲" : "▼"}</span>
                              <span>
                                <AnimatedNumber
                                  value={Math.abs(coin.price_change_percentage_24h)}
                                  flash={false}
                                  format={(v) => `${v.toFixed(2)}%`}
                                />
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex h-40 items-center justify-center text-sm text-white/40">
                    Market data unavailable
                  </div>
                )}
              </div>
            </Card>
          </div>
        </CardContent>
      </Card>
      <Card
        interactive
        className="border-white/10 bg-linear-to-b from-white/3 to-white/1 px-5 py-5 shadow-lg shadow-black/20 backdrop-blur-xl"
      >
        <CardHeader className="mb-4 p-0">
          <CardTitle className="text-xl font-semibold tracking-tight">
            Portfolio & Market
          </CardTitle>
          <CardDescription className="text-sm text-white/60">
            Allocation heatmap & full market list
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          <div className="grid grid-cols-2 gap-4">
            {/* HEATMAP */}
            <Card interactive className="border-white/10 bg-white/5 p-4">
              <p className="mb-3 text-sm text-white/60">Portfolio Heatmap</p>

              {portfolioCoins.length > 0 ? (
                <PortfolioHeatmap data={heatmapData} />
              ) : isDashboardLoading ? (
                <CardSkeleton lines={4} className="border-0 bg-transparent p-0" />
              ) : (
                <div className="py-8 text-center text-sm text-white/40">
                  Add assets to view allocation heatmap
                </div>
              )}
            </Card>

            {/* ALL COINS TABLE */}
            <Card interactive className="border-white/10 bg-white/5 p-4">
              <p className="mb-3 text-sm text-white/60">All Coins</p>
              <div className="max-h-72 overflow-y-auto pr-2">
                {isDashboardLoading ? (
                  <TableSkeleton rows={7} columns={3} />
                ) : (
                  <Table>
                    <TableHeader className="sticky top-0 bg-black/10 backdrop-blur">
                      <TableRow className="border-white/10 transition even:bg-white/2 hover:bg-white/5">
                        <TableHead className="text-xs tracking-wide text-white/50 uppercase">
                          Coin
                        </TableHead>
                        <TableHead className="text-xs tracking-wide text-white/50 uppercase">
                          Price
                        </TableHead>
                        <TableHead className="text-right text-xs tracking-wide text-white/50 uppercase">
                          24h
                        </TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {coins.map((coin) => {
                        const isUp = coin.price_change_percentage_24h >= 0

                        return (
                          <TableRow
                            key={coin.id}
                            className="border-white/10 transition even:bg-white/2 hover:bg-white/5"
                          >
                            {/* COIN */}
                            <TableCell className="font-medium">
                              <div className="flex min-w-0 items-center gap-3">
                                <img
                                  src={coin.image}
                                  className="h-6 w-6 shrink-0 rounded-full"
                                />

                                <div className="flex min-w-0 flex-col">
                                  {/* NAME (truncate) */}
                                  <span className="max-w-30 truncate text-white/90">
                                    {coin.name}
                                  </span>

                                  {/* SYMBOL */}
                                  <span className="max-w-30 truncate text-xs text-white/50 uppercase">
                                    {coin.id}
                                  </span>
                                </div>
                              </div>
                            </TableCell>
                            {/* PRICE */}
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-white/90">
                                  <AnimatedNumber
                                    value={coin.current_price}
                                    format={(v) => `$${v.toLocaleString()}`}
                                  />
                                </span>

                                {/* subtle secondary info */}
                                <span className="text-xs text-white/50">USD</span>
                              </div>
                            </TableCell>

                            {/* 24H CHANGE */}
                            <TableCell className="text-right">
                              <div className="flex flex-col items-end gap-1">
                                {/* % VALUE */}
                                <span
                                  className={`text-sm font-medium ${
                                    isUp ? "text-emerald-400" : "text-red-400"
                                  }`}
                                >
                                  {isUp ? "+" : "-"}
                                  <AnimatedNumber
                                    value={Math.abs(
                                      coin.price_change_percentage_24h
                                    )}
                                    flash={false}
                                    format={(v) => `${v.toFixed(2)}%`}
                                  />
                                </span>

                                {/* MINI BAR (visual strength) */}
                                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
                                  <div
                                    className={`h-full ${
                                      isUp ? "bg-emerald-400" : "bg-red-400"
                                    }`}
                                    style={{
                                      width: `${Math.min(
                                        Math.abs(
                                          coin.price_change_percentage_24h
                                        ),
                                        100
                                      )}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default Dashboard
