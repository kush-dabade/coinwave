import { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"

import { AnalysisHeader, type AnalysisTimeframe } from "@/components/analysis/AnalysisHeader"
import { Heatmap } from "@/components/analysis/Heatmap"
import { InsightsPanel } from "@/components/analysis/InsightsPanel"
import { PriceChart } from "@/components/analysis/PriceChart"
import {
  SentimentCards,
  type SentimentCardItem,
} from "@/components/analysis/SentimentCards"
import { TopMovers } from "@/components/analysis/TopMovers"
import { TrendingCoins } from "@/components/analysis/TrendingCoins"
import { VolumeVsMarketCap } from "@/components/analysis/VolumeVsMarketCap"
import { Card } from "@/components/ui/card"
import type { MarketCoin, MarketGlobalData } from "@/services/markets"
import { fetchMarketSnapshot } from "@/services/markets"

function deriveSentimentCards(
  coins: MarketCoin[],
  globalData: MarketGlobalData | null
): SentimentCardItem[] {
  if (!coins.length || !globalData) return []

  const top = [...coins].sort((a, b) => b.market_cap - a.market_cap).slice(0, 20)
  const marketCapSum = top.reduce((sum, coin) => sum + coin.market_cap, 0)
  const weightedChange =
    marketCapSum > 0
      ? top.reduce((sum, coin) => sum + coin.market_cap * coin.price_change_percentage_24h, 0) /
        marketCapSum
      : 0
  const positiveCount = top.filter((coin) => coin.price_change_percentage_24h >= 0).length
  const breadthRatio = positiveCount / Math.max(top.length, 1)

  const sentiment =
    weightedChange > 1.2 && breadthRatio > 0.55
      ? "Bullish"
      : weightedChange < -1.2 && breadthRatio < 0.45
        ? "Bearish"
        : "Neutral"

  const fearGreedRaw = 50 + weightedChange * 6 + (breadthRatio - 0.5) * 30
  const fearGreed = Math.max(0, Math.min(100, fearGreedRaw))
  const fearGreedLabel = fearGreed >= 65 ? "Greed" : fearGreed <= 35 ? "Fear" : "Balanced"

  const btcDominance = globalData.market_cap_percentage.btc
  const marketTrend = globalData.market_cap_change_percentage_24h_usd

  return [
    {
      label: "Market Sentiment",
      value: sentiment,
      helper: `${positiveCount}/${top.length} leading coins in green`,
      change: weightedChange,
      tone: sentiment === "Bullish" ? "positive" : sentiment === "Bearish" ? "negative" : "neutral",
      type: "sentiment",
    },
    {
      label: "Fear & Greed Index",
      value: `${Math.round(fearGreed)}`,
      helper: fearGreedLabel,
      change: weightedChange,
      tone: fearGreed >= 55 ? "positive" : fearGreed <= 45 ? "negative" : "neutral",
      type: "fear-greed",
    },
    {
      label: "BTC Dominance",
      value: `${btcDominance.toFixed(2)}%`,
      helper: "Share of total market cap",
      change: btcDominance - 50,
      tone: btcDominance >= 52 ? "positive" : "neutral",
      type: "dominance",
    },
    {
      label: "Total Market Trend",
      value: `${marketTrend >= 0 ? "+" : ""}${marketTrend.toFixed(2)}%`,
      helper: "24h total market cap move",
      change: marketTrend,
      tone: marketTrend >= 0 ? "positive" : "negative",
      type: "trend",
    },
  ]
}

export default function Analysis() {
  const [coins, setCoins] = useState<MarketCoin[]>([])
  const [globalData, setGlobalData] = useState<MarketGlobalData | null>(null)
  const [trendingIds, setTrendingIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeframe, setTimeframe] = useState<AnalysisTimeframe>("7D")

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
      setError("Unable to fetch analysis data at the moment.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 60000)
    return () => clearInterval(interval)
  }, [loadData])

  const sentimentCards = useMemo(
    () => deriveSentimentCards(coins, globalData),
    [coins, globalData, timeframe]
  )

  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-black via-neutral-950 to-neutral-900">
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:radial-gradient(rgba(255,255,255,0.4)_0.55px,transparent_0.55px)] [background-size:3px_3px]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-cyan-500/8 to-transparent blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, ease: "easeOut" }}
        className="relative z-10 space-y-6 px-5 py-6 md:px-6"
      >
        <AnalysisHeader timeframe={timeframe} onTimeframeChange={setTimeframe} />

        {error ? (
          <Card className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </Card>
        ) : null}

        <SentimentCards loading={loading} cards={sentimentCards} />
        <TopMovers loading={loading} coins={coins} />
        <Heatmap loading={loading} coins={coins} />
        <TrendingCoins loading={loading} coins={coins} trendingIds={trendingIds} />
        <PriceChart loading={loading} coins={coins} />
        <VolumeVsMarketCap loading={loading} coins={coins} />
        <InsightsPanel loading={loading} coins={coins} globalData={globalData} />
      </motion.div>
    </div>
  )
}

