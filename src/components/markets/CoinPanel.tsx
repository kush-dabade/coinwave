import { AnimatePresence, motion } from "framer-motion"
import { X } from "lucide-react"
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts"

import { AnimatedNumber } from "@/components/ui/animated-number"
import { Skeleton } from "@/components/ui/skeleton"
import { safeNumber, toSafeNumber } from "@/lib/number"
import type { MarketCoin } from "@/services/markets"

type CoinPanelProps = {
  coin: MarketCoin | null
  onClose: () => void
}

const formatCompact = (value: number) =>
  value.toLocaleString(undefined, { maximumFractionDigits: 0 })

export function CoinPanel({ coin, onClose }: CoinPanelProps) {
  const sparklineData =
    coin?.sparkline_in_7d?.price
      ?.map((value, index) => {
        const numericValue = Number(value)
        if (!Number.isFinite(numericValue)) return null
        return { index, value: numericValue }
      })
      .filter((item): item is { index: number; value: number } => item !== null) ?? []

  return (
    <AnimatePresence>
      {coin ? (
        <>
          <motion.button
            aria-label="Close details panel"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-black/45 backdrop-blur-[1px]"
          />

          <motion.aside
            initial={{ x: "100%", opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0.5 }}
            transition={{ type: "spring", stiffness: 310, damping: 34, mass: 0.9 }}
            className="fixed top-0 right-0 z-40 h-screen w-full border-l border-white/10 bg-neutral-950/96 p-5 shadow-2xl backdrop-blur-xl md:w-[420px]"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <img src={coin.image} className="h-10 w-10 rounded-full" />
                <div>
                  <p className="text-lg font-semibold text-white">{coin.name}</p>
                  <p className="text-xs text-white/50 uppercase">{coin.symbol}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-white/70 transition hover:bg-white/[0.1] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs tracking-[0.12em] text-white/50 uppercase">Current Price</p>
              <div className="mt-2 text-3xl font-semibold text-white">
                <AnimatedNumber
                  value={coin.current_price}
                  format={(value) =>
                    `$${value.toLocaleString(undefined, {
                      minimumFractionDigits: value < 1 ? 4 : 2,
                      maximumFractionDigits: value < 1 ? 6 : 2,
                    })}`
                  }
                />
              </div>
              <div className={`mt-1 text-sm ${coin.price_change_percentage_24h >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                <AnimatedNumber
                  value={coin.price_change_percentage_24h}
                  flash={false}
                  className="text-current"
                  format={(value) => `${value > 0 ? "+" : ""}${safeNumber(value)}% (24h)`}
                />
              </div>
            </div>

            <div className="mt-5 h-40 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              {sparklineData.length === 0 ? (
                <Skeleton className="h-full w-full rounded-xl bg-white/[0.04]" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparklineData}>
                    <defs>
                      <linearGradient id="panel-area-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <Tooltip
                      cursor={{ stroke: "rgba(255,255,255,0.22)", strokeWidth: 1 }}
                      wrapperStyle={{
                        pointerEvents: "none",
                        transition: "transform 120ms ease-out",
                      }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        return (
                          <div className="rounded-lg border border-white/15 bg-neutral-900/95 px-2 py-1 text-xs text-white shadow-[0_12px_28px_-16px_rgba(0,0,0,0.95)] backdrop-blur-md">
                            ${toSafeNumber(payload[0].value as number).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </div>
                        )
                      }}
                    />
                    <Area
                      dataKey="value"
                      type="monotone"
                      stroke="#22c55e"
                      fill="url(#panel-area-fill)"
                      strokeWidth={2}
                      isAnimationActive
                      animationDuration={650}
                      animationEasing="ease-out"
                      dot={false}
                      activeDot={{
                        r: 5,
                        fill: "#22c55e",
                        stroke: "rgba(255,255,255,0.85)",
                        strokeWidth: 1.8,
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <span className="text-sm text-white/60">Market Cap</span>
                <span className="font-medium text-white">
                  <AnimatedNumber value={coin.market_cap} format={(value) => `$${formatCompact(value)}`} />
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <span className="text-sm text-white/60">24h Volume</span>
                <span className="font-medium text-white">
                  <AnimatedNumber value={coin.total_volume} format={(value) => `$${formatCompact(value)}`} />
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <span className="text-sm text-white/60">Circulating Supply</span>
                <span className="font-medium text-white">
                  <AnimatedNumber
                    value={coin.circulating_supply || 0}
                    format={(value) => `${formatCompact(value)} ${coin.symbol.toUpperCase()}`}
                  />
                </span>
              </div>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  )
}
