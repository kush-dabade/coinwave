import {
  Activity,
  CircleDashed,
  Gauge,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react"

import { AnimatedNumber } from "@/components/ui/animated-number"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { safeNumber } from "@/lib/number"

export type SentimentCardItem = {
  label: string
  value: string
  helper: string
  change: number
  tone: "positive" | "negative" | "neutral"
  type: "sentiment" | "fear-greed" | "dominance" | "trend"
}

type SentimentCardsProps = {
  loading: boolean
  cards: SentimentCardItem[]
}

function getToneClass(tone: SentimentCardItem["tone"]) {
  if (tone === "positive") return "bg-emerald-500/15 text-emerald-300"
  if (tone === "negative") return "bg-red-500/15 text-red-300"
  return "bg-white/10 text-white/70"
}

function getIcon(type: SentimentCardItem["type"]) {
  if (type === "sentiment") return ShieldCheck
  if (type === "fear-greed") return Gauge
  if (type === "dominance") return CircleDashed
  return Activity
}

export function SentimentCards({ loading, cards }: SentimentCardsProps) {
  return (
    <section className="space-y-3">
      <p className="text-xs tracking-[0.14em] text-white/45 uppercase">Market Sentiment</p>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {(loading ? Array.from({ length: 4 }) : cards).map((card, index) => {
          if (loading) {
            return (
              <Card
                key={index}
                interactive
                className="rounded-2xl border border-white/10 bg-white/5 p-6"
              >
                <div className="space-y-3">
                  <Skeleton className="h-3 w-24 rounded-full" />
                  <Skeleton className="h-9 w-32 rounded-lg" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                </div>
              </Card>
            )
          }

          const Icon = getIcon(card.type)
          const positive = card.change >= 0
          return (
            <Card
              key={card.label}
              interactive
              className="rounded-2xl border border-white/10 bg-white/5 p-6 transition duration-200 hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex items-start justify-between">
                <p className="text-xs tracking-[0.14em] text-white/55 uppercase">{card.label}</p>
                <span className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/60">
                  <Icon className="h-3.5 w-3.5" />
                </span>
              </div>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-white">{card.value}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-white/60">{card.helper}</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${getToneClass(
                    card.tone
                  )}`}
                >
                  {positive ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" />
                  )}
                  <AnimatedNumber
                    value={Math.abs(card.change)}
                    flash
                    className="text-current"
                    format={(value) => `${positive ? "+" : "-"}${safeNumber(value)}%`}
                  />
                </span>
              </div>
            </Card>
          )
        })}
      </div>
    </section>
  )
}

