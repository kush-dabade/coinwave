import { useMemo } from "react"
import {
  QueryClient,
  keepPreviousData,
  useQueries,
  useQuery,
  type QueryKey,
} from "@tanstack/react-query"

import { readJSON, writeJSON } from "@/lib/storage"
import type { Quote } from "@/lib/portfolio"
import {
  closesFromMidnightSnapshots,
  dayKey,
  toDaily,
  type DailySeries,
} from "@/lib/stats"
import { useSettings } from "@/stores"
import {
  ApiError,
  fetchAssetProfile,
  fetchAssetsByIds,
  fetchCategories,
  fetchCategoryAssets,
  fetchCoinGeckoOHLC,
  fetchDailyPrices,
  fetchGlobal,
  fetchHistory,
  fetchSparklinePage,
  fetchTickers,
  fetchUniverse,
  searchAssets,
  type Asset,
  type Candle,
  type HistoryRange,
} from "@/services/coingecko"
import {
  binancePairFor,
  fetchKlines,
  fetchUsdtPrices,
  type BinanceInterval,
} from "@/services/binance"
import { fetchDefiTvl, fetchStablecoinSupply } from "@/services/defillama"
import { fetchFearGreed } from "@/services/fear-greed"
import { fetchJson } from "@/services/http"
import type { NewsPayload } from "../../server/types"

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Back off politely: the public APIs rate-limit aggressively.
      retry: (failures, error) =>
        !(error instanceof ApiError && error.kind === "not-found") &&
        failures < 4,
      retryDelay: (attempt) =>
        Math.min(30 * SECOND, 2 * SECOND * 2 ** attempt) + Math.random() * 500,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,
      gcTime: 30 * MINUTE,
    },
  },
})

/**
 * True once a query without data has failed at least once. Retries continue
 * in the background, but the UI should say so instead of showing skeletons.
 */
export function isFailing(q: {
  data: unknown
  isError: boolean
  failureCount: number
}) {
  return q.data === undefined && (q.isError || q.failureCount > 0)
}

/** The user's refresh preference, in ms (false = manual only). */
export function useRefreshInterval(): number | false {
  const { refreshInterval } = useSettings()
  return refreshInterval === 0 ? false : refreshInterval * SECOND
}

// ---------------------------------------------------------------------------
// Last-good snapshots survive a reload, so a rate-limited first request still
// shows real (clearly timestamped) data instead of an empty page.

type Snapshot<T> = { at: number; data: T }
export const SNAPSHOT_PREFIX = "coinwave:snapshot:"

function snapshotOptions<T>(
  name: string,
  valid: (data: unknown) => data is T,
  maxAge: number
) {
  let cached: Snapshot<T> | null | undefined
  const read = () => {
    if (cached === undefined) {
      const snap = readJSON<Snapshot<unknown> | null>(
        SNAPSHOT_PREFIX + name,
        null
      )
      cached =
        snap &&
        typeof snap.at === "number" &&
        Date.now() - snap.at < maxAge &&
        valid(snap.data)
          ? (snap as Snapshot<T>)
          : null
    }
    return cached
  }
  return {
    initialData: () => read()?.data,
    initialDataUpdatedAt: () => read()?.at,
    save: (data: T) =>
      writeJSON(SNAPSHOT_PREFIX + name, { at: Date.now(), data }),
  }
}

const isUniverse = (d: unknown): d is Asset[] =>
  Array.isArray(d) &&
  d.length > 0 &&
  typeof (d[0] as Asset)?.id === "string" &&
  "change30d" in (d[0] as Asset)

const universeSnapshot = snapshotOptions("universe", isUniverse, 24 * HOUR)

export const UNIVERSE_KEY: QueryKey = ["universe"]

/** The 250 largest assets with 1h–1y changes: the live market universe. */
export function useUniverse() {
  const refetchInterval = useRefreshInterval()
  return useQuery({
    queryKey: UNIVERSE_KEY,
    queryFn: async ({ signal }) => {
      const data = await fetchUniverse(signal)
      universeSnapshot.save(data)
      return data
    },
    initialData: universeSnapshot.initialData,
    initialDataUpdatedAt: universeSnapshot.initialDataUpdatedAt,
    staleTime: MINUTE,
    refetchInterval,
  })
}

/** @deprecated name kept for older components; same as useUniverse. */
export const useTopAssets = useUniverse

/**
 * 7-day sparklines for the given assets. Fetched one page of 100 at a time
 * (by market-cap rank), only for pages that contain a requested asset.
 */
export function useSparklines(ids: string[]) {
  const universe = useUniverse()
  const pages = useMemo(() => {
    const rankOf = new Map((universe.data ?? []).map((a) => [a.id, a.rank]))
    const set = new Set<number>()
    for (const id of ids) {
      const rank = rankOf.get(id)
      if (rank) set.add(Math.min(3, Math.ceil(rank / 100)))
    }
    return [...set].sort()
  }, [ids, universe.data])
  const results = useQueries({
    queries: pages.map((page) => ({
      queryKey: ["sparklines", page],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchSparklinePage(page, signal),
      staleTime: 15 * MINUTE,
      refetchInterval: 30 * MINUTE,
    })),
  })
  const stamp = results.map((r) => r.dataUpdatedAt).join(",")
  return useMemo(() => {
    const map: Record<string, number[]> = {}
    for (const r of results) if (r.data) Object.assign(map, r.data)
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `results` changes identity every render; `stamp` tracks its data
  }, [stamp])
}

/** Assets outside the top-250 universe, fetched by id. */
export function useAssetsByIds(ids: string[], enabled = true) {
  const key = useMemo(() => [...new Set(ids)].sort(), [ids])
  const refetchInterval = useRefreshInterval()
  return useQuery({
    queryKey: ["assets", "ids", key],
    queryFn: ({ signal }) => fetchAssetsByIds(key, signal),
    enabled: enabled && key.length > 0,
    staleTime: MINUTE,
    refetchInterval,
    placeholderData: keepPreviousData,
  })
}

/** One asset: from the shared universe when possible, otherwise by id. */
export function useAsset(id: string) {
  const top = useUniverse()
  const fromTop = top.data?.find((a) => a.id === id)
  const needsOwn = !fromTop && (top.isSuccess || top.isError)
  const own = useAssetsByIds([id], needsOwn)
  const asset = fromTop ?? own.data?.find((a) => a.id === id) ?? null
  const source = fromTop ? top : own
  const failing = isFailing(top) && (!needsOwn || isFailing(own))
  return {
    asset,
    updatedAt: source.dataUpdatedAt || null,
    isLoading:
      !asset &&
      !failing &&
      (top.isPending || own.isFetching || (needsOwn && own.isPending)),
    notFound: !asset && needsOwn && own.isSuccess,
    error: !asset ? (own.failureReason ?? top.failureReason) : null,
    refetch: () => (fromTop ? top.refetch() : own.refetch()),
  }
}

/**
 * Live data for an arbitrary set of assets (portfolio, watchlists, alerts):
 * universe data where available, plus one batched request for the rest.
 */
export function useQuotes(ids: string[]) {
  const top = useUniverse()
  const topMap = useMemo(
    () => new Map((top.data ?? []).map((a) => [a.id, a])),
    [top.data]
  )
  const missing = useMemo(
    () => (top.isPending ? [] : ids.filter((id) => !topMap.has(id))),
    [ids, topMap, top.isPending]
  )
  const extra = useAssetsByIds(missing, !top.isPending)

  return useMemo(() => {
    const assets = new Map<string, Asset>()
    for (const id of ids) {
      const asset = topMap.get(id) ?? extra.data?.find((a) => a.id === id)
      if (asset) assets.set(id, asset)
    }
    const quotes = new Map<string, Quote>()
    for (const [id, a] of assets) {
      quotes.set(id, {
        price: a.price,
        change24h: a.change24h,
        priceChange24h: a.priceChange24h,
        name: a.name,
        symbol: a.symbol,
        image: a.image,
      })
    }
    const oldest = Math.min(
      top.dataUpdatedAt || Infinity,
      missing.length > 0 ? extra.dataUpdatedAt || Infinity : Infinity
    )
    return {
      assets,
      quotes,
      isLoading:
        (top.isPending && !isFailing(top)) ||
        (missing.length > 0 && extra.isPending && !isFailing(extra)),
      /** Timestamp of the oldest data contributing to these quotes. */
      updatedAt: Number.isFinite(oldest) ? oldest : null,
    }
  }, [ids, topMap, extra, missing.length, top])
}

const isGlobal = (d: unknown): d is Awaited<ReturnType<typeof fetchGlobal>> =>
  !!d && typeof d === "object" && "totalMarketCap" in d && "dominance" in d
const globalSnapshot = snapshotOptions("global", isGlobal, 24 * HOUR)

export function useGlobalMarket() {
  return useQuery({
    queryKey: ["global"],
    queryFn: async ({ signal }) => {
      const data = await fetchGlobal(signal)
      globalSnapshot.save(data)
      return data
    },
    initialData: globalSnapshot.initialData,
    initialDataUpdatedAt: globalSnapshot.initialDataUpdatedAt,
    staleTime: 3 * MINUTE,
    refetchInterval: 5 * MINUTE,
  })
}

export function useFearGreed() {
  return useQuery({
    queryKey: ["fear-greed"],
    queryFn: ({ signal }) => fetchFearGreed(signal),
    staleTime: HOUR,
    retry: 2,
  })
}

const HISTORY_STALE: Record<HistoryRange, number> = {
  "1D": 2 * MINUTE,
  "7D": 10 * MINUTE,
  "30D": 30 * MINUTE,
  "90D": HOUR,
  "1Y": HOUR,
}

export function useHistory(id: string, range: HistoryRange) {
  return useQuery({
    queryKey: ["history", id, range],
    queryFn: ({ signal }) => fetchHistory(id, range, signal),
    staleTime: HISTORY_STALE[range],
    // Keep the previous range on screen (dimmed) while the next one loads.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === id ? previous : undefined,
  })
}

export function useAssetSearch(query: string) {
  const q = query.trim()
  return useQuery({
    queryKey: ["search", q.toLowerCase()],
    queryFn: ({ signal }) => searchAssets(q, signal),
    enabled: q.length >= 2,
    staleTime: 10 * MINUTE,
    retry: 1,
    placeholderData: keepPreviousData,
  })
}

// ---------------------------------------------------------------------------
// Categories, profiles, venues

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: ({ signal }) => fetchCategories(signal),
    staleTime: 30 * MINUTE,
  })
}

export function useCategoryAssets(category: string | null) {
  return useQuery({
    queryKey: ["category-assets", category],
    queryFn: ({ signal }) => fetchCategoryAssets(category!, signal),
    enabled: !!category,
    staleTime: 10 * MINUTE,
    placeholderData: keepPreviousData,
  })
}

const stableSnapshot = snapshotOptions(
  "stablecoin-ids",
  (d): d is string[] =>
    Array.isArray(d) && d.every((x) => typeof x === "string"),
  7 * 24 * HOUR
)

/** Ids CoinGecko classifies as stablecoins (used to hide or group them). */
export function useStablecoinIds() {
  const q = useQuery({
    queryKey: ["stablecoin-ids"],
    queryFn: async ({ signal }) => {
      const ids = (await fetchCategoryAssets("stablecoins", signal)).map(
        (a) => a.id
      )
      stableSnapshot.save(ids)
      return ids
    },
    initialData: stableSnapshot.initialData,
    initialDataUpdatedAt: stableSnapshot.initialDataUpdatedAt,
    staleTime: 6 * HOUR,
  })
  return useMemo(() => new Set(q.data ?? []), [q.data])
}

export function useAssetProfile(id: string | null) {
  return useQuery({
    queryKey: ["profile", id],
    queryFn: ({ signal }) => fetchAssetProfile(id!, signal),
    enabled: !!id,
    staleTime: 6 * HOUR,
    gcTime: 24 * HOUR,
  })
}

export function useTickers(id: string | null) {
  return useQuery({
    queryKey: ["tickers", id],
    queryFn: ({ signal }) => fetchTickers(id!, signal),
    enabled: !!id,
    staleTime: 10 * MINUTE,
  })
}

// ---------------------------------------------------------------------------
// Candles and daily closes (Binance first, CoinGecko fallback)

export function useBinancePrices() {
  return useQuery({
    queryKey: ["binance-prices"],
    queryFn: ({ signal }) => fetchUsdtPrices(signal),
    staleTime: 10 * MINUTE,
    retry: 2,
  })
}

export type CandleSource =
  | { kind: "binance"; pair: string }
  | { kind: "coingecko"; granularity: string }

const CG_FALLBACK: Record<
  BinanceInterval,
  { days: number; granularity: string }
> = {
  "15m": { days: 1, granularity: "30-minute" },
  "1h": { days: 2, granularity: "30-minute" },
  "4h": { days: 30, granularity: "4-hour" },
  "1d": { days: 365, granularity: "4-day" },
  "1w": { days: 365, granularity: "4-day" },
}

/**
 * Genuine OHLC candles for an asset. Uses the Binance USDT pair when one
 * exists (and its price matches CoinGecko's); otherwise CoinGecko's coarser
 * OHLC without volume, reported via `source`.
 */
export type CandleData = { candles: Candle[]; source: CandleSource }

export function useCandles(asset: Asset | null, interval: BinanceInterval) {
  const prices = useBinancePrices()
  const pair = asset && prices.data ? binancePairFor(asset, prices.data) : null
  const decided = !!asset && (prices.isSuccess || prices.isError)
  const fast = interval === "15m" || interval === "1h"
  return useQuery<CandleData>({
    queryKey: ["candles", asset?.id, interval, pair],
    enabled: decided,
    staleTime: fast ? MINUTE : 5 * MINUTE,
    refetchInterval: fast ? MINUTE : 5 * MINUTE,
    placeholderData: (prev, prevQuery) =>
      prevQuery?.queryKey[1] === asset?.id ? prev : undefined,
    queryFn: async ({ signal }) => {
      if (pair) {
        return {
          candles: await fetchKlines(pair, interval, 1000, signal),
          source: { kind: "binance", pair },
        }
      }
      const fb = CG_FALLBACK[interval]
      return {
        candles: await fetchCoinGeckoOHLC(asset!.id, fb.days, signal),
        source: { kind: "coingecko", granularity: fb.granularity },
      }
    },
  })
}

export type DailyCloses = {
  series: Map<string, DailySeries>
  sources: Map<string, "binance" | "coingecko">
  loading: string[]
  failed: string[]
}

/** About a year of final daily closes for each asset, keyed by UTC day. */
export function useDailyCloses(
  assets: Pick<Asset, "id" | "symbol" | "price">[]
) {
  const prices = useBinancePrices()
  const decided = prices.isSuccess || prices.isError
  const results = useQueries({
    queries: assets.map((a) => {
      const pair = prices.data ? binancePairFor(a, prices.data) : null
      return {
        queryKey: ["daily-closes", a.id, pair],
        enabled: decided,
        staleTime: HOUR,
        queryFn: async ({ signal }: { signal: AbortSignal }) => {
          // Drop today's still-forming day: closes must be final.
          const today = dayKey(Date.now())
          if (pair) {
            const candles = await fetchKlines(pair, "1d", 400, signal)
            return {
              source: "binance" as const,
              points: candles
                .filter((c) => dayKey(c.t) < today)
                .map((c) => ({ t: c.t, p: c.c })),
            }
          }
          const points = await fetchDailyPrices(a.id, 365, signal)
          return {
            source: "coingecko" as const,
            points: closesFromMidnightSnapshots(points).filter(
              (p) => dayKey(p.t) < today
            ),
          }
        },
      }
    }),
  })
  const stamp = results
    .map((r) => `${r.dataUpdatedAt}:${r.status}:${r.failureCount}`)
    .join(",")
  const idKey = assets.map((a) => a.id).join(",")
  return useMemo<DailyCloses>(() => {
    const series = new Map<string, DailySeries>()
    const sources = new Map<string, "binance" | "coingecko">()
    const loading: string[] = []
    const failed: string[] = []
    results.forEach((r, i) => {
      const id = assets[i]?.id
      if (!id) return
      if (r.data) {
        series.set(id, toDaily(r.data.points))
        sources.set(id, r.data.source)
      } else if (isFailing(r)) failed.push(id)
      else loading.push(id)
    })
    return { series, sources, loading, failed }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `results` changes identity every render; `stamp` tracks its data
  }, [stamp, idKey])
}

// ---------------------------------------------------------------------------
// Market context and news

export function useStablecoinSupply() {
  return useQuery({
    queryKey: ["stablecoin-supply"],
    queryFn: ({ signal }) => fetchStablecoinSupply(signal),
    staleTime: 6 * HOUR,
  })
}

export function useDefiTvl() {
  return useQuery({
    queryKey: ["defi-tvl"],
    queryFn: ({ signal }) => fetchDefiTvl(signal),
    staleTime: 6 * HOUR,
  })
}

export function useNews() {
  return useQuery({
    queryKey: ["news"],
    queryFn: ({ signal }) => fetchJson<NewsPayload>("/api/news", signal),
    staleTime: 5 * MINUTE,
    refetchInterval: 10 * MINUTE,
    retry: 1,
  })
}
