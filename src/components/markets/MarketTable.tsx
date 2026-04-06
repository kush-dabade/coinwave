import { Skeleton } from "@/components/ui/skeleton"
import type { MarketCoin } from "@/services/markets"

import { MarketRow } from "./MarketRow"

type MarketTableProps = {
  coins: MarketCoin[]
  loading: boolean
  error: string | null
  selectedCoinId: string | null
  watchlist: Set<string>
  onRetry: () => void
  onSelectCoin: (coin: MarketCoin) => void
  onToggleWatchlist: (coinId: string) => void
  onResetFilters: () => void
}

export function MarketTable({
  coins,
  loading,
  error,
  selectedCoinId,
  watchlist,
  onRetry,
  onSelectCoin,
  onToggleWatchlist,
  onResetFilters,
}: MarketTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-[0_26px_46px_-36px_rgba(0,0,0,0.95)] backdrop-blur-md">
      <div className="max-h-[500px] overflow-y-auto">
        <table className="w-full table-fixed text-sm">
          <thead className="sticky top-0 z-10 bg-black/40 backdrop-blur-md">
            <tr className="border-b border-white/10 text-left text-xs tracking-[0.12em] text-white/45 uppercase">
              <th className="w-[64px] py-3 pl-4">#</th>
              <th className="w-[220px] py-3 px-2">Coin</th>
              <th className="w-[140px] py-3 px-2">Price</th>
              <th className="w-[110px] py-3 px-2">24h</th>
              <th className="w-[170px] py-3 px-2">Market Cap</th>
              <th className="w-[170px] py-3 px-2">Volume</th>
              <th className="w-[130px] py-3 px-2">7D Chart</th>
              <th className="w-[70px] py-3 pr-3 text-right">Watch</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 12 }).map((_, index) => (
                  <tr key={index} className={`h-[74px] border-b border-white/6 ${index % 2 === 1 ? "bg-white/[0.015]" : ""}`}>
                    <td className="pl-4">
                      <Skeleton className="h-3 w-8 rounded-full" />
                    </td>
                    <td className="px-2">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-3 w-24 rounded-full" />
                          <Skeleton className="h-2.5 w-14 rounded-full" />
                        </div>
                      </div>
                    </td>
                    <td className="px-2">
                      <Skeleton className="h-3 w-20 rounded-full" />
                    </td>
                    <td className="px-2">
                      <Skeleton className="h-3 w-14 rounded-full" />
                    </td>
                    <td className="px-2">
                      <Skeleton className="h-3 w-24 rounded-full" />
                    </td>
                    <td className="px-2">
                      <Skeleton className="h-3 w-24 rounded-full" />
                    </td>
                    <td className="px-2">
                      <Skeleton className="h-[60px] w-[110px] rounded-md" />
                    </td>
                    <td className="pr-3">
                      <Skeleton className="ml-auto h-7 w-7 rounded-md" />
                    </td>
                  </tr>
                ))
              : null}

            {!loading && !error
              ? coins.map((coin, index) => (
                  <MarketRow
                    key={coin.id}
                    coin={coin}
                    index={index}
                    selected={selectedCoinId === coin.id}
                    watchlisted={watchlist.has(coin.id)}
                    onClick={onSelectCoin}
                    onToggleWatchlist={onToggleWatchlist}
                  />
                ))
              : null}
          </tbody>
        </table>

        {!loading && error ? (
          <div className="flex h-[260px] flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-lg font-semibold text-white">Unable to load market data</p>
            <p className="max-w-md text-sm text-white/55">
              We could not reach the market feed. Check your connection and retry.
            </p>
            <button
              onClick={onRetry}
              className="rounded-lg border border-white/15 bg-white/[0.08] px-4 py-2 text-sm text-white transition duration-200 hover:scale-[1.03] hover:bg-white/[0.14] active:scale-[0.97]"
            >
              Retry
            </button>
          </div>
        ) : null}

        {!loading && !error && coins.length === 0 ? (
          <div className="flex h-[260px] flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-lg font-semibold text-white">No coins match your current filters</p>
            <p className="max-w-md text-sm text-white/55">
              Adjust search terms or clear the active tab and sort settings to restore the full list.
            </p>
            <button
              onClick={onResetFilters}
              className="rounded-lg border border-white/15 bg-white/[0.08] px-4 py-2 text-sm text-white transition duration-200 hover:scale-[1.03] hover:bg-white/[0.14] active:scale-[0.97]"
            >
              Reset Filters
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
