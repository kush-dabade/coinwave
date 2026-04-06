import { memo } from "react"
import { ArrowDownRight, ArrowUpRight, Star } from "lucide-react"

import { AnimatedNumber } from "@/components/ui/animated-number"
import { Button } from "@/components/ui/button"
import { safeNumber } from "@/lib/number"
import type { MarketCoin } from "@/services/markets"

import { MarketSparkline } from "./MarketSparkline"

type MarketRowProps = {
  coin: MarketCoin
  index: number
  selected: boolean
  watchlisted: boolean
  onClick: (coin: MarketCoin) => void
  onToggleWatchlist: (coinId: string) => void
}

function MarketRowComponent({
  coin,
  index,
  selected,
  watchlisted,
  onClick,
  onToggleWatchlist,
}: MarketRowProps) {
  const isUp = coin.price_change_percentage_24h >= 0

  return (
    <tr
      onClick={() => onClick(coin)}
      className={`h-[74px] cursor-pointer border-b border-white/6 transition-[transform,background-color,box-shadow] duration-150 ease-out hover:scale-[1.01] hover:bg-white/[0.06] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] active:scale-[0.996] ${
        index % 2 === 0 ? "bg-transparent" : "bg-white/[0.015]"
      } ${selected ? "bg-white/[0.11]" : ""}`}
    >
      <td className="pl-4 text-white/50">{coin.market_cap_rank || index + 1}</td>

      <td className="px-2">
        <div className="flex items-center gap-3">
          <img src={coin.image} className="h-8 w-8 rounded-full" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{coin.name}</p>
            <p className="mt-0.5 text-xs tracking-wide text-white/45 uppercase">{coin.symbol}</p>
          </div>
        </div>
      </td>

      <td className="px-2 text-base font-semibold text-white">
        <AnimatedNumber
          value={coin.current_price}
          format={(value) =>
            `$${value.toLocaleString(undefined, {
              minimumFractionDigits: value < 1 ? 4 : 2,
              maximumFractionDigits: value < 1 ? 6 : 2,
            })}`
          }
        />
      </td>

      <td className={`px-2 ${isUp ? "text-emerald-300" : "text-red-300"}`}>
        <div className="inline-flex items-center gap-1 font-semibold">
          {isUp ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
          <AnimatedNumber
            value={coin.price_change_percentage_24h}
            flash
            className="text-current"
            upClassName="text-emerald-200"
            downClassName="text-red-200"
            format={(value) => `${value > 0 ? "+" : ""}${safeNumber(value)}%`}
          />
        </div>
      </td>

      <td className="px-2 text-white/80">
        <AnimatedNumber
          value={coin.market_cap}
          format={(value) => `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
        />
      </td>

      <td className="px-2 text-white/65">
        <AnimatedNumber
          value={coin.total_volume}
          format={(value) => `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
        />
      </td>

      <td className="px-2">
        <MarketSparkline prices={coin.sparkline_in_7d?.price} positive={isUp} />
      </td>

      <td className="pr-3 text-right">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation()
            onToggleWatchlist(coin.id)
          }}
          className="text-white/55 hover:text-amber-300"
        >
          <Star className={`h-4 w-4 ${watchlisted ? "fill-amber-300 text-amber-300" : ""}`} />
        </Button>
      </td>
    </tr>
  )
}

export const MarketRow = memo(MarketRowComponent)
