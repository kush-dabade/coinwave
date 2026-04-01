/* eslint-disable react-hooks/set-state-in-effect */
import { Button } from "../components/ui/button"
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

import { useEffect, useState, useCallback } from "react"

import { COIN_MAP } from "@/lib/portfolio"

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
    <g style={{ transition: "all 0.2s ease, cursor: pointer" }}>
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
          <XAxis dataKey="date" hide />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Area
            dataKey="value"
            type="monotone"
            fill="hsl(142, 76%, 36%)"
            fillOpacity={0.15}
            stroke="hsl(142, 76%, 36%)"
            strokeWidth={2}
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

  const heatmapData = portfolioCoins.map((coin: CoinWithAmount) => {
    const value = coin.amount * coin.current_price

    return {
      name: coin.symbol.toUpperCase(),
      symbol: coin.symbol.toUpperCase(),
      size: (value / totalValue) * 100,
      change: coin.price_change_percentage_24h,
    }
  })

  return (
    <div className="my-6 space-y-6 p-2">
      <Card className="border-white/10 bg-linear-to-b from-white/3 to-white/1 px-5 py-5 shadow-lg shadow-black/20 backdrop-blur-xl">
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
          <div className="flex items-center gap-2 rounded-md bg-white/5 p-1">
            <Button
              variant="secondary"
              className="rounded-md bg-white/10 px-4 py-1.5 text-sm font-medium"
            >
              Portfolio
            </Button>
            <Button
              variant="green"
              className="rounded-md px-4 py-1.5 text-sm font-medium text-white"
            >
              P&L
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-3 gap-4">
            {/* Market Cap */}
            <Card className="border-white/10 bg-white/5 p-4 transition-all duration-200 hover:scale-[1.01] hover:bg-white/10">
              <p className="text-xs tracking-wide text-white/50 uppercase">
                Market Cap
              </p>
              <h2 className="text-xl font-semibold tracking-tight">
                {globalData ? (
                  `$${(globalData.total_market_cap.usd / 1e12).toFixed(2)}T`
                ) : (
                  <div className="h-6 w-24 animate-pulse rounded bg-white/10" />
                )}
              </h2>
              {marketChart.length > 0 && <MiniChart data={marketChart} />}
            </Card>

            {/* Volume */}
            <Card className="border-white/10 bg-white/5 p-4 transition-all duration-200 hover:scale-[1.01] hover:bg-white/10">
              <p className="text-xs tracking-wide text-white/50 uppercase">
                24h Volume
              </p>
              <h2 className="text-xl font-semibold tracking-tight">
                {globalData
                  ? `$${(globalData.total_volume.usd / 1e9).toFixed(2)}B`
                  : "Loading..."}
              </h2>
              {volumeChart.length > 0 && <MiniChart data={volumeChart} />}
            </Card>

            {/* Trending */}
            <Card className="border-white/10 bg-white/5 p-4 transition-all duration-200 hover:scale-[1.01] hover:bg-white/10">
              <p className="text-xs tracking-wide text-white/50 uppercase">
                Trending Currencies
              </p>
              <div className="mt-1 text-sm font-medium">
                {coins.length > 0 ? (
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
                              ${coin.current_price.toFixed(2)}
                            </p>

                            <div
                              className={`flex items-center gap-1 ${
                                isUp ? "text-emerald-400" : "text-red-400"
                              }`}
                            >
                              <span>{isUp ? "▲" : "▼"}</span>
                              <span>
                                {Math.abs(
                                  coin.price_change_percentage_24h
                                ).toFixed(2)}
                                %
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex h-40 items-center justify-center text-sm text-white/40">
                    No portfolio data yet
                  </div>
                )}
              </div>
            </Card>
          </div>
        </CardContent>
      </Card>
      <Card className="border-white/10 bg-linear-to-b from-white/3 to-white/1 px-5 py-5 shadow-lg shadow-black/20 backdrop-blur-xl">
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
            <Card className="border-white/10 bg-white/5 p-4 transition-all duration-200 hover:scale-[1.01] hover:bg-white/10">
              <p className="mb-3 text-sm text-white/60">Portfolio Heatmap</p>

              {portfolioCoins.length > 0 ? (
                <PortfolioHeatmap data={heatmapData} />
              ) : (
                "Loading..."
              )}
            </Card>

            {/* ALL COINS TABLE */}
            <Card className="border-white/10 bg-white/5 p-4 transition-all duration-200 hover:scale-[1.01] hover:bg-white/10">
              <p className="mb-3 text-sm text-white/60">All Coins</p>
              <div className="max-h-72 overflow-y-auto pr-2">
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
                      const change = Math.abs(
                        coin.price_change_percentage_24h
                      ).toFixed(2)

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
                                ${coin.current_price.toLocaleString()}
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
                                {change}%
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
              </div>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default Dashboard
