import { TrendingDown, TrendingUp } from "lucide-react"

import { AnimatedNumber } from "@/components/ui/animated-number"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { safeNumber } from "@/lib/number"

type MetricCard = {
  label: string
  value: number
  change: number
  suffix?: string
  formatter?: (value: number) => string
}

type MarketOverviewProps = {
  loading: boolean
  metrics: MetricCard[]
}

const defaultFormatter = (value: number) =>
  `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`

export function MarketOverview({ loading, metrics }: MarketOverviewProps) {
  const gridColsClass = metrics.length >= 4 ? "xl:grid-cols-4" : "xl:grid-cols-3"

  return (
    <div className={`grid gap-6 md:grid-cols-3 ${gridColsClass}`}>
      {metrics.map((metric) => {
        const positive = metric.change >= 0
        return (
          <Card
            key={metric.label}
            interactive
            className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_45px_-30px_rgba(0,0,0,0.9)] backdrop-blur-md transition duration-200 hover:-translate-y-1 hover:shadow-lg"
          >
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-3 w-28 rounded-full" />
                <Skeleton className="h-10 w-40 rounded-lg" />
                <Skeleton className="h-3 w-16 rounded-full" />
              </div>
            ) : (
              <>
                <p className="text-xs tracking-[0.14em] text-white/55 uppercase">
                  {metric.label}
                </p>
                <div className="mt-2 text-2xl leading-none font-bold tracking-tight text-white md:text-3xl">
                  <AnimatedNumber
                    value={metric.value}
                    format={(value) =>
                      metric.formatter ? metric.formatter(value) : defaultFormatter(value)
                    }
                  />
                  {metric.suffix ? (
                    <span className="ml-1 text-lg text-white/70">{metric.suffix}</span>
                  ) : null}
                </div>
                <div
                  className={`mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    positive
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-red-500/15 text-red-300"
                  }`}
                >
                  {positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  <AnimatedNumber
                    value={Math.abs(metric.change)}
                    flash
                    className="text-current"
                    format={(value) => `${positive ? "+" : "-"}${safeNumber(value)}%`}
                  />
                </div>
              </>
            )}
          </Card>
        )
      })}
    </div>
  )
}
