import { useId } from "react"
import { Area, AreaChart, Line, ResponsiveContainer, Tooltip } from "recharts"

import { Skeleton } from "@/components/ui/skeleton"
import { toSafeNumber } from "@/lib/number"

type MarketSparklineProps = {
  prices?: Array<number | null | undefined>
  positive?: boolean
  loading?: boolean
}

export function MarketSparkline({
  prices,
  positive = true,
  loading = false,
}: MarketSparklineProps) {
  const lineColor = positive ? "#34d399" : "#f87171"
  const areaColor = positive ? "#10b981" : "#ef4444"
  const gradientId = useId().replace(/:/g, "")

  const chartData =
    prices
      ?.map((value, index) => {
        const numericValue = Number(value)
        if (!Number.isFinite(numericValue)) return null
        return { index, value: numericValue }
      })
      .filter((item): item is { index: number; value: number } => item !== null) ?? []

  return (
    <div className="h-[60px] min-w-[110px] w-full">
      {loading || chartData.length === 0 ? (
        <Skeleton className="h-full w-full rounded-md bg-white/[0.04]" />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 0, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id={`spark-line-${gradientId}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={lineColor} stopOpacity={0.35} />
                <stop offset="100%" stopColor={lineColor} stopOpacity={1} />
              </linearGradient>
              <linearGradient id={`spark-area-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={areaColor} stopOpacity={0.3} />
                <stop offset="100%" stopColor={areaColor} stopOpacity={0.02} />
              </linearGradient>
              <filter id={`spark-glow-${gradientId}`} x="-20%" y="-80%" width="140%" height="240%">
                <feDropShadow dx="0" dy="0" stdDeviation="1.8" floodColor={lineColor} floodOpacity="0.5" />
              </filter>
              <filter id={`spark-dot-${gradientId}`} x="-60%" y="-60%" width="220%" height="220%">
                <feDropShadow dx="0" dy="0" stdDeviation="1.3" floodColor={lineColor} floodOpacity="0.9" />
              </filter>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke="none"
              fill={`url(#spark-area-${gradientId})`}
              fillOpacity={1}
              isAnimationActive
              animationDuration={650}
              animationEasing="ease-out"
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={`url(#spark-line-${gradientId})`}
              strokeWidth={2.2}
              filter={`url(#spark-glow-${gradientId})`}
              dot={false}
              activeDot={{
                r: 3.5,
                fill: lineColor,
                stroke: "rgba(255,255,255,0.94)",
                strokeWidth: 1.4,
                filter: `url(#spark-dot-${gradientId})`,
              }}
              isAnimationActive
              animationDuration={650}
              animationEasing="ease-out"
            />
            <Tooltip
              cursor={false}
              wrapperStyle={{ pointerEvents: "none", transition: "transform 120ms ease-out" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                return (
                  <div className="rounded-lg border border-white/15 bg-neutral-900/95 px-2 py-1 text-[10px] text-white shadow-[0_10px_24px_-14px_rgba(0,0,0,0.95)] backdrop-blur-md">
                    ${toSafeNumber(payload[0].value as number).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                )
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
