import { useEffect, useMemo, useState } from "react"
import {
  BellPlus,
  CandlestickChart,
  ChevronRight,
  GitCompareArrows,
} from "lucide-react"
import { Link, useParams } from "react-router-dom"

import { AlertDialog } from "@/components/alerts/AlertDialog"
import {
  About,
  AlertsPane,
  AssetNews,
  MarketFacts,
  PerformanceTable,
  PositionPane,
  RelatedPane,
  ResearchPane,
  Venues,
  WatchlistsPane,
} from "@/components/asset/sections"
import { AssetIcon } from "@/components/data/AssetIcon"
import { Change } from "@/components/data/Change"
import { PriceChart } from "@/components/data/PriceChart"
import { EmptyState, ErrorNotice, Skeleton } from "@/components/data/states"
import { WatchButton } from "@/components/data/WatchButton"
import { Page, Pane } from "@/components/layout/Page"
import { Button } from "@/components/ui/button"
import { Badge, Segmented } from "@/components/ui/controls"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAsset, useAssetProfile, useHistory } from "@/hooks/queries"
import { useNow, usePageTitle, useTick } from "@/hooks/use-ui"
import { formatAge, formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"
import { HISTORY_RANGES, type HistoryRange } from "@/services/coingecko"
import { rememberAsset } from "@/stores"

export default function AssetPage() {
  const { id = "" } = useParams()
  // Remount per asset so range, price tick and chart state never leak across.
  return <AssetView key={id} id={id} />
}

function AssetView({ id }: { id: string }) {
  const { asset, isLoading, notFound, error, refetch, updatedAt } = useAsset(id)
  const profile = useAssetProfile(asset ? id : null)
  const [range, setRange] = useState<HistoryRange>("7D")
  const [alertOpen, setAlertOpen] = useState(false)
  const history = useHistory(id, range)
  const now = useNow(15_000)
  const tick = useTick(asset?.price)
  usePageTitle(
    asset
      ? `${asset.name} (${asset.symbol})`
      : notFound
        ? "Asset not found"
        : "Asset"
  )

  useEffect(() => {
    if (asset) rememberAsset(asset.id)
  }, [asset])

  const stats = useMemo(() => {
    const pts = history.data ?? []
    if (pts.length < 2) return null
    let high = -Infinity
    let low = Infinity
    for (const p of pts) {
      high = Math.max(high, p.p)
      low = Math.min(low, p.p)
    }
    const open = pts[0].p
    const last = pts[pts.length - 1].p
    return { high, low, change: open > 0 ? (last / open - 1) * 100 : null }
  }, [history.data])

  const rangeLabel = HISTORY_RANGES.find((r) => r.key === range)?.label ?? range
  const placeholder = history.isPlaceholderData

  if (notFound) {
    return (
      <Page>
        <EmptyState
          title="We couldn’t find that asset"
          action={
            <Button asChild variant="primary" size="sm">
              <Link to="/markets">Browse markets</Link>
            </Button>
          }
        >
          CoinGecko has no market data for “{id}”. It may have been delisted or
          the link may be mistyped.
        </EmptyState>
      </Page>
    )
  }

  return (
    <Page>
      <nav aria-label="Breadcrumb" className="mb-2 text-xs text-ink-3">
        <ol className="flex items-center gap-1">
          <li>
            <Link to="/markets" className="hover:text-ink">
              Markets
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="size-3" />
          </li>
          <li aria-current="page" className="truncate text-ink-2">
            {asset?.name ?? id}
          </li>
        </ol>
      </nav>

      {!asset && isLoading ? (
        <div aria-busy="true">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="mt-4 h-[360px] w-full" />
        </div>
      ) : !asset ? (
        <>
          <h1 className="sr-only">{id}</h1>
          <ErrorNotice
            error={error}
            onRetry={refetch}
            title="Couldn’t load this asset"
          />
        </>
      ) : (
        <>
          <header className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <AssetIcon src={asset.image} symbol={asset.symbol} size={28} />
                <h1 className="text-[1.375rem] leading-8 font-semibold tracking-[-0.01em] text-ink">
                  {asset.name}
                </h1>
                <span className="mono text-[0.8125rem] text-ink-3">
                  {asset.symbol}
                </span>
                {asset.rank && <Badge>#{asset.rank}</Badge>}
              </div>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p
                  key={tick.key}
                  className={cn(
                    "figure rounded-sm text-[2rem] leading-10 text-ink",
                    tick.cls
                  )}
                >
                  {formatPrice(asset.price)}
                </p>
                <p className="text-[0.8125rem]">
                  <Change value={asset.priceChange24h} kind="money" />{" "}
                  <Change value={asset.change24h} />{" "}
                  <span className="text-ink-3">24h</span>
                </p>
              </div>
              <p className="text-[0.6875rem] text-ink-3">
                {updatedAt ? `Updated ${formatAge(updatedAt, now)}` : ""}
                {asset.lastUpdated
                  ? ` · CoinGecko price from ${formatAge(asset.lastUpdated, now)}`
                  : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <WatchButton id={asset.id} name={asset.name} variant="labeled" />
              <Button size="sm" onClick={() => setAlertOpen(true)}>
                <BellPlus aria-hidden="true" /> Alert
              </Button>
              <Button size="sm" asChild>
                <Link to={`/chart?asset=${asset.id}`}>
                  <CandlestickChart aria-hidden="true" /> Chart
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link
                  to={`/compare?ids=${asset.id === "bitcoin" ? "bitcoin,ethereum" : `${asset.id},bitcoin`}`}
                >
                  <GitCompareArrows aria-hidden="true" /> Compare
                </Link>
              </Button>
            </div>
          </header>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-3">
              <Pane
                title="Price"
                subtitle={`${rangeLabel} · shaded against the price at the start of the range`}
                actions={
                  <Segmented
                    label="Chart range"
                    size="sm"
                    value={range}
                    onChange={setRange}
                    options={HISTORY_RANGES.map((r) => ({
                      value: r.key,
                      label: r.key,
                      title: r.label,
                    }))}
                  />
                }
              >
                <dl
                  className={cn(
                    "mb-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-3 transition-opacity",
                    placeholder && "opacity-45"
                  )}
                >
                  <div className="flex gap-1.5">
                    <dt>Change</dt>
                    <dd>
                      {placeholder ? "…" : <Change value={stats?.change} />}
                    </dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt>High</dt>
                    <dd className="num text-ink-2">
                      {placeholder ? "…" : formatPrice(stats?.high)}
                    </dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt>Low</dt>
                    <dd className="num text-ink-2">
                      {placeholder ? "…" : formatPrice(stats?.low)}
                    </dd>
                  </div>
                </dl>
                {history.data && history.data.length > 1 ? (
                  <PriceChart
                    points={history.data}
                    range={range}
                    dimmed={placeholder}
                    label={`${asset.name} price in US dollars over the last ${rangeLabel}`}
                  />
                ) : history.isPending ? (
                  <Skeleton className="h-[240px] w-full sm:h-[320px]" />
                ) : history.isError ? (
                  <ErrorNotice
                    error={history.error}
                    onRetry={() => history.refetch()}
                    title="Couldn’t load price history"
                  />
                ) : (
                  <EmptyState title="No price history">
                    CoinGecko has no price history for this range.
                  </EmptyState>
                )}
                <p className="mt-2 text-[0.6875rem] text-ink-3">
                  {range === "1D"
                    ? "5-minute"
                    : range === "1Y"
                      ? "Daily"
                      : "Hourly"}{" "}
                  prices from CoinGecko.{" "}
                  <Link
                    to={`/chart?asset=${asset.id}`}
                    className="text-accent hover:underline"
                  >
                    Candles, volume and indicators in Chart Studio
                  </Link>
                </p>
              </Pane>

              <section
                className="rounded-md border border-rule bg-surface"
                aria-label="Analysis"
              >
                <Tabs defaultValue="overview">
                  <TabsList aria-label="Asset analysis">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="venues">
                      Venues &amp; liquidity
                    </TabsTrigger>
                    <TabsTrigger value="about">Profile</TabsTrigger>
                    <TabsTrigger value="news">News</TabsTrigger>
                  </TabsList>
                  <TabsContent
                    value="overview"
                    className="grid gap-4 p-3 lg:grid-cols-2"
                  >
                    <div>
                      <h3 className="eyebrow mb-1">Performance</h3>
                      <PerformanceTable asset={asset} profile={profile.data} />
                    </div>
                    <div>
                      <h3 className="eyebrow mb-1">Market data</h3>
                      <MarketFacts asset={asset} />
                    </div>
                  </TabsContent>
                  <TabsContent value="venues" className="p-3">
                    <Venues id={asset.id} />
                  </TabsContent>
                  <TabsContent value="about" className="p-3">
                    <About
                      profile={profile.data}
                      loading={profile.isPending}
                      error={profile.error}
                    />
                  </TabsContent>
                  <TabsContent value="news" className="p-3">
                    <AssetNews asset={asset} />
                  </TabsContent>
                </Tabs>
              </section>
            </div>

            <aside
              className="min-w-0 space-y-3"
              aria-label={`${asset.name} context`}
            >
              <PositionPane asset={asset} />
              <ResearchPane asset={asset} />
              <AlertsPane asset={asset} />
              <WatchlistsPane asset={asset} />
              <RelatedPane asset={asset} profile={profile.data} />
            </aside>
          </div>
          <AlertDialog
            open={alertOpen}
            onOpenChange={setAlertOpen}
            draft={{
              asset: {
                id: asset.id,
                name: asset.name,
                symbol: asset.symbol,
                image: asset.image,
              },
              threshold: asset.price ?? undefined,
            }}
          />
        </>
      )}
    </Page>
  )
}
