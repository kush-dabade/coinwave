import { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Flame, Sparkles } from "lucide-react"

import { CoinPanel } from "@/components/markets/CoinPanel"
import {
  MarketFilters,
  type MarketSort,
  type MarketTab,
} from "@/components/markets/MarketFilters"
import { MarketOverview } from "@/components/markets/MarketOverview"
import { MarketTable } from "@/components/markets/MarketTable"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { safeNumber } from "@/lib/number"
import type { MarketCoin } from "@/services/markets"
import { fetchMarketSnapshot, type MarketGlobalData } from "@/services/markets"

function useDebouncedValue<T>(value: T, delay = 260) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timeout)
  }, [value, delay])

  return debounced
}

function getSortedCoins(coins: MarketCoin[], sortBy: MarketSort) {
  const list = [...coins]
  if (sortBy === "price") {
    list.sort((a, b) => b.current_price - a.current_price)
  } else if (sortBy === "change_24h") {
    list.sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h)
  } else {
    list.sort((a, b) => b.market_cap - a.market_cap)
  }
  return list
}

export default function Markets() {
  const [coins, setCoins] = useState<MarketCoin[]>([])
  const [globalData, setGlobalData] = useState<MarketGlobalData | null>(null)
  const [trendingIds, setTrendingIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search, 250)
  const [activeTab, setActiveTab] = useState<MarketTab>("all")
  const [sortBy, setSortBy] = useState<MarketSort>("market_cap")
  const [selectedCoinId, setSelectedCoinId] = useState<string | null>(null)
  const [watchlist, setWatchlist] = useState<string[]>([])

  useEffect(() => {
    const stored = localStorage.getItem("coinwave_watchlist")
    if (stored) {
      try {
        setWatchlist(JSON.parse(stored))
      } catch {
        setWatchlist([])
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem("coinwave_watchlist", JSON.stringify(watchlist))
  }, [watchlist])

  const loadData = useCallback(async () => {
    try {
      if (document.hidden) return
      const snapshot = await fetchMarketSnapshot()
      setCoins(snapshot.coins)
      setGlobalData(snapshot.global)
      setTrendingIds(snapshot.trendingIds)
      setError(null)
    } catch (err) {
      console.error(err)
      setError("Unable to fetch market data.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 45000)
    return () => clearInterval(interval)
  }, [loadData])

  const filteredCoins = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase()
    const trendingSet = new Set(trendingIds)

    let list = coins.filter((coin) => {
      const matchesSearch =
        !query ||
        coin.name.toLowerCase().includes(query) ||
        coin.symbol.toLowerCase().includes(query)
      if (!matchesSearch) return false

      if (activeTab === "gainers") return coin.price_change_percentage_24h > 0
      if (activeTab === "losers") return coin.price_change_percentage_24h < 0
      if (activeTab === "trending") {
        if (trendingSet.size > 0) return trendingSet.has(coin.id)
        return coin.total_volume > 0
      }

      return true
    })

    if (activeTab === "trending" && trendingSet.size === 0) {
      list = list.sort((a, b) => b.total_volume - a.total_volume).slice(0, 20)
    }

    return getSortedCoins(list, sortBy).slice(0, 100)
  }, [activeTab, coins, debouncedSearch, sortBy, trendingIds])

  const selectedCoin = useMemo(
    () => coins.find((coin) => coin.id === selectedCoinId) ?? null,
    [coins, selectedCoinId]
  )

  const topGainer = useMemo(
    () =>
      coins.reduce<MarketCoin | null>((best, current) => {
        if (!best) return current
        return current.price_change_percentage_24h > best.price_change_percentage_24h
          ? current
          : best
      }, null),
    [coins]
  )

  const trendingStrip = useMemo(() => {
    if (!coins.length) return []
    const trendingSet = new Set(trendingIds)
    const pick = coins.filter((coin) => trendingSet.has(coin.id))
    if (pick.length > 0) return pick.slice(0, 10)
    return [...coins].sort((a, b) => b.total_volume - a.total_volume).slice(0, 10)
  }, [coins, trendingIds])

  const metrics = useMemo(() => {
    const totalVolume = coins.reduce((sum, coin) => sum + coin.total_volume, 0)
    const volumeWeightedChange =
      totalVolume > 0
        ? coins.reduce(
            (sum, coin) => sum + coin.total_volume * coin.price_change_percentage_24h,
            0
          ) / totalVolume
        : 0

    const btcCoin = coins.find((coin) => coin.symbol.toLowerCase() === "btc")
    const marketCapChange = globalData?.market_cap_change_percentage_24h_usd ?? 0
    const btcChange = btcCoin?.price_change_percentage_24h ?? marketCapChange

    const currentDominance = globalData?.market_cap_percentage.btc ?? 0
    const previousDominance =
      currentDominance * ((1 + marketCapChange / 100) / (1 + btcChange / 100))
    const dominanceChange = currentDominance - previousDominance

    return [
      {
        label: "Total Market Cap",
        value: globalData?.total_market_cap.usd ?? 0,
        change: marketCapChange,
        formatter: (value: number) =>
          `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      },
      {
        label: "24h Volume",
        value: globalData?.total_volume.usd ?? 0,
        change: volumeWeightedChange,
        formatter: (value: number) =>
          `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      },
      {
        label: "BTC Dominance",
        value: currentDominance,
        change: dominanceChange,
        suffix: "%",
        formatter: (value: number) => safeNumber(value),
      },
    ]
  }, [coins, globalData])

  const watchlistSet = useMemo(() => new Set(watchlist), [watchlist])

  const toggleWatchlist = useCallback((coinId: string) => {
    setWatchlist((prev) =>
      prev.includes(coinId) ? prev.filter((id) => id !== coinId) : [...prev, coinId]
    )
  }, [])

  const resetFilters = useCallback(() => {
    setSearch("")
    setActiveTab("all")
    setSortBy("market_cap")
  }, [])

  return (
    <>
      <div className="relative overflow-hidden bg-gradient-to-b from-black via-neutral-950 to-neutral-900">
        <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:radial-gradient(rgba(255,255,255,0.4)_0.55px,transparent_0.55px)] [background-size:3px_3px]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-cyan-500/8 to-transparent blur-2xl" />

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, ease: "easeOut" }}
          className="relative z-10 space-y-6 px-5 py-6 md:px-6"
        >
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-semibold tracking-tight text-white">Markets</h1>
            <p className="text-sm text-white/55">
              Live crypto market intelligence with premium real-time interactions.
            </p>
          </div>

          <section className="space-y-3">
            <p className="text-xs tracking-[0.14em] text-white/45 uppercase">Overview</p>
            <MarketOverview loading={loading} metrics={metrics} />
          </section>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card
              interactive
              className="rounded-2xl border border-white/10 bg-linear-to-br from-emerald-500/14 to-emerald-500/[0.03] p-5 backdrop-blur-sm lg:col-span-1"
            >
              <p className="inline-flex items-center gap-2 text-xs tracking-[0.12em] text-emerald-200/85 uppercase">
                <Flame className="h-3.5 w-3.5" /> Top Gainer
              </p>
              {loading ? (
                <div className="mt-3 space-y-2">
                  <Skeleton className="h-8 w-40 rounded-lg" />
                  <Skeleton className="h-4 w-24 rounded-full" />
                </div>
              ) : topGainer ? (
                <div className="mt-3">
                  <div className="flex items-center gap-3">
                    <img src={topGainer.image} className="h-9 w-9 rounded-full" />
                    <p className="text-xl font-semibold text-white">{topGainer.name}</p>
                  </div>
                  <div className="mt-2 text-emerald-300">
                    <AnimatedNumber
                      value={topGainer.price_change_percentage_24h}
                      flash
                      className="text-current text-base font-semibold"
                      format={(value) => `+${safeNumber(Math.abs(value))}% in 24h`}
                    />
                  </div>
                </div>
              ) : null}
            </Card>

            <Card
              interactive
              className="rounded-2xl border border-white/10 bg-linear-to-r from-white/[0.06] to-white/[0.02] p-5 backdrop-blur-sm lg:col-span-2"
            >
              <p className="inline-flex items-center gap-2 text-xs tracking-[0.12em] text-white/60 uppercase">
                <Sparkles className="h-3.5 w-3.5" /> Trending Coins
              </p>
              <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
                {loading
                  ? Array.from({ length: 8 }).map((_, index) => (
                      <div
                        key={index}
                        className="min-w-[155px] rounded-xl border border-white/10 bg-white/[0.03] p-3"
                      >
                        <Skeleton className="h-4 w-24 rounded-full" />
                        <Skeleton className="mt-2 h-3 w-20 rounded-full" />
                      </div>
                    ))
                  : trendingStrip.map((coin) => (
                      <button
                        key={coin.id}
                        onClick={() => setSelectedCoinId(coin.id)}
                        className="min-w-[155px] rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition duration-200 hover:-translate-y-1 hover:scale-[1.02] hover:bg-white/[0.08] active:scale-[0.98]"
                      >
                        <div className="flex items-center gap-2">
                          <img src={coin.image} className="h-5 w-5 rounded-full" />
                          <p className="truncate text-sm font-medium text-white">{coin.symbol.toUpperCase()}</p>
                        </div>
                        <p className="mt-1 text-xs font-semibold text-white/90">
                          <AnimatedNumber
                            value={coin.current_price}
                            format={(value) => `$${safeNumber(value)}`}
                          />
                        </p>
                        <p
                          className={`text-xs ${
                            coin.price_change_percentage_24h >= 0
                              ? "text-emerald-300"
                              : "text-red-300"
                          }`}
                        >
                          <AnimatedNumber
                            value={coin.price_change_percentage_24h}
                            flash
                            className="text-current"
                            format={(value) => `${value > 0 ? "+" : ""}${safeNumber(value)}%`}
                          />
                        </p>
                      </button>
                    ))}
              </div>
            </Card>
          </div>

          <section className="space-y-3">
            <p className="text-xs tracking-[0.14em] text-white/45 uppercase">Filters</p>
            <MarketFilters
              search={search}
              onSearchChange={setSearch}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              sortBy={sortBy}
              onSortChange={setSortBy}
            />
          </section>

          <section className="space-y-3">
            <p className="text-xs tracking-[0.14em] text-white/45 uppercase">Market Table</p>
            <MarketTable
              coins={filteredCoins}
              loading={loading}
              error={error}
              selectedCoinId={selectedCoinId}
              watchlist={watchlistSet}
              onRetry={loadData}
              onSelectCoin={(coin) => setSelectedCoinId(coin.id)}
              onToggleWatchlist={toggleWatchlist}
              onResetFilters={resetFilters}
            />
          </section>
        </motion.div>
      </div>

      <CoinPanel coin={selectedCoin} onClose={() => setSelectedCoinId(null)} />
    </>
  )
}