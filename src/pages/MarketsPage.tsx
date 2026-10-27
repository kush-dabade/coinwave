import { memo, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Columns3, Search, X } from "lucide-react"
import {
  Link,
  useLocation,
  useNavigate,
  useNavigationType,
  useSearchParams,
} from "react-router-dom"

import { AssetIcon } from "@/components/data/AssetIcon"
import { Change } from "@/components/data/Change"
import { Sparkline } from "@/components/data/Sparkline"
import { EmptyState, ErrorNotice, Skeleton } from "@/components/data/states"
import { SortHeader } from "@/components/data/table"
import { WatchButton } from "@/components/data/WatchButton"
import { Page, PageHeader } from "@/components/layout/Page"
import { Button } from "@/components/ui/button"
import { Segmented, Select, Switch } from "@/components/ui/controls"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  isFailing,
  useAssetSearch,
  useCategories,
  useCategoryAssets,
  useQuotes,
  useSparklines,
  useStablecoinIds,
  useUniverse,
} from "@/hooks/queries"
import { useDebounced, useNow, usePageTitle, useTick } from "@/hooks/use-ui"
import {
  formatAge,
  formatCompactMoney,
  formatPercent,
  formatPrice,
  formatSupply,
  isNum,
} from "@/lib/format"
import { searchLocalAssets } from "@/lib/search"
import { T, nextSort } from "@/lib/table"
import { cn } from "@/lib/utils"
import {
  MARKET_COLUMN_LABELS,
  MARKET_COLUMNS,
  type MarketColumn,
} from "@/lib/workspace"
import { updateSettings, useSettings, useWatchlists } from "@/stores"
import type { Asset } from "@/services/coingecko"

type SortKey =
  | "rank"
  | "name"
  | "price"
  | "change1h"
  | "change24h"
  | "change7d"
  | "change30d"
  | "change1y"
  | "marketCap"
  | "fdv"
  | "volume24h"
  | "volToMcap"
  | "athChange"
  | "circulatingSupply"

const volToMcap = (a: Asset) =>
  isNum(a.volume24h) && a.marketCap ? (a.volume24h / a.marketCap) * 100 : null

const GET: Record<SortKey, (a: Asset) => number | string | null> = {
  rank: (a) => a.rank,
  name: (a) => a.name.toLowerCase(),
  price: (a) => a.price,
  change1h: (a) => a.change1h,
  change24h: (a) => a.change24h,
  change7d: (a) => a.change7d,
  change30d: (a) => a.change30d,
  change1y: (a) => a.change1y,
  marketCap: (a) => a.marketCap,
  fdv: (a) => a.fdv,
  volume24h: (a) => a.volume24h,
  volToMcap,
  athChange: (a) => a.athChange,
  circulatingSupply: (a) => a.circulatingSupply,
}

const COLUMNS: Record<
  MarketColumn,
  {
    label: string
    sr?: string
    sort?: SortKey
    cls: string
    render: (a: Asset, spark: number[]) => React.ReactNode
  }
> = {
  rank: {
    label: "#",
    sr: "Rank",
    sort: "rank",
    cls: "hidden w-10 md:table-cell",
    render: (a) => <span className="num text-ink-3">{a.rank ?? "—"}</span>,
  },
  price: {
    label: "Price",
    sort: "price",
    cls: "w-28",
    render: (a) => <PriceCell asset={a} />,
  },
  change1h: {
    label: "1h",
    sr: "1 hour change",
    sort: "change1h",
    cls: "hidden w-16 xl:table-cell",
    render: (a) => <Change value={a.change1h} />,
  },
  change24h: {
    label: "24h",
    sr: "24 hour change",
    sort: "change24h",
    cls: "hidden w-16 sm:table-cell",
    render: (a) => <Change value={a.change24h} />,
  },
  change7d: {
    label: "7d",
    sr: "7 day change",
    sort: "change7d",
    cls: "hidden w-16 md:table-cell",
    render: (a) => <Change value={a.change7d} />,
  },
  change30d: {
    label: "30d",
    sr: "30 day change",
    sort: "change30d",
    cls: "hidden w-16 lg:table-cell",
    render: (a) => <Change value={a.change30d} />,
  },
  change1y: {
    label: "1y",
    sr: "1 year change",
    sort: "change1y",
    cls: "hidden w-20 xl:table-cell",
    render: (a) => <Change value={a.change1y} />,
  },
  marketCap: {
    label: "Mkt cap",
    sr: "Market cap",
    sort: "marketCap",
    cls: "hidden w-24 lg:table-cell",
    render: (a) => (
      <span className="num text-ink-2">{formatCompactMoney(a.marketCap)}</span>
    ),
  },
  fdv: {
    label: "FDV",
    sr: "Fully diluted value",
    sort: "fdv",
    cls: "hidden w-24 xl:table-cell",
    render: (a) => (
      <span className="num text-ink-2">{formatCompactMoney(a.fdv)}</span>
    ),
  },
  volume24h: {
    label: "Vol 24h",
    sr: "24 hour volume",
    sort: "volume24h",
    cls: "hidden w-24 lg:table-cell",
    render: (a) => (
      <span className="num text-ink-2">{formatCompactMoney(a.volume24h)}</span>
    ),
  },
  volToMcap: {
    label: "Turnover",
    sr: "Volume as % of market cap",
    sort: "volToMcap",
    cls: "hidden w-20 xl:table-cell",
    render: (a) => (
      <span className="num text-ink-2">
        {formatPercent(volToMcap(a), { signed: false })}
      </span>
    ),
  },
  athChange: {
    label: "From ATH",
    sr: "Distance from all-time high",
    sort: "athChange",
    cls: "hidden w-20 xl:table-cell",
    render: (a) => <Change value={a.athChange} digits={1} />,
  },
  circulatingSupply: {
    label: "Supply",
    sr: "Circulating supply",
    sort: "circulatingSupply",
    cls: "hidden w-24 xl:table-cell",
    render: (a) => (
      <span className="num text-ink-2">
        {formatSupply(a.circulatingSupply)}
      </span>
    ),
  },
  sparkline: {
    label: "7d trend",
    cls: "hidden w-28 pl-4 md:table-cell",
    render: (_a, spark) => <Sparkline values={spark} width={96} height={24} />,
  },
}

const TIERS = [
  { value: "all", label: "All", min: 0, max: Infinity },
  { value: "large", label: ">$10B", min: 1e10, max: Infinity },
  { value: "mid", label: "$1–10B", min: 1e9, max: 1e10 },
  { value: "small", label: "$100M–1B", min: 1e8, max: 1e9 },
  { value: "micro", label: "<$100M", min: 0, max: 1e8 },
] as const

function PriceCell({ asset }: { asset: Asset }) {
  const tick = useTick(asset.price)
  return (
    <span className="flex flex-col items-end">
      <span
        key={tick.key}
        className={cn("num rounded-sm px-0.5 text-ink", tick.cls)}
      >
        {formatPrice(asset.price)}
      </span>
      <Change value={asset.change24h} className="text-[0.6875rem] sm:hidden" />
    </span>
  )
}

const Row = memo(function Row({
  asset,
  columns,
  spark,
}: {
  asset: Asset
  columns: MarketColumn[]
  spark: number[]
}) {
  const navigate = useNavigate()
  const href = `/markets/${asset.id}`
  return (
    <tr
      className={cn(T.trHover, "cursor-pointer")}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a, button, [role='menu']"))
          return
        if (e.metaKey || e.ctrlKey) window.open(href, "_blank", "noopener")
        else navigate(href)
      }}
    >
      {columns.includes("rank") && (
        <td className={cn(T.td, COLUMNS.rank.cls)}>
          {COLUMNS.rank.render(asset, spark)}
        </td>
      )}
      <td className={cn(T.td, "max-w-0 min-w-36 sm:min-w-44")}>
        <div className="flex min-w-0 items-center gap-2">
          <AssetIcon src={asset.image} symbol={asset.symbol} size={20} />
          <div className="min-w-0">
            <Link
              to={href}
              title={asset.name}
              className="block truncate font-medium text-ink hover:underline"
            >
              {asset.name}
            </Link>
            <span className="mono text-[0.6875rem] text-ink-3">
              {asset.symbol}
              <span className="md:hidden">
                {asset.rank ? ` · #${asset.rank}` : ""}
              </span>
            </span>
          </div>
        </div>
      </td>
      {columns
        .filter((c) => c !== "rank")
        .map((c) => (
          <td
            key={c}
            className={cn(
              T.td,
              c === "sparkline" ? "" : "text-right",
              COLUMNS[c].cls
            )}
          >
            {COLUMNS[c].render(asset, spark)}
          </td>
        ))}
      <td className={cn(T.td, "w-10 text-right")}>
        <WatchButton id={asset.id} name={asset.name} />
      </td>
    </tr>
  )
})

export default function MarketsPage() {
  usePageTitle("Markets")
  const [params, setParams] = useSearchParams()
  const settings = useSettings()
  const { lists, defaultList } = useWatchlists()
  const now = useNow(15_000)

  const view =
    (["all", "watchlist", "category"] as const).find(
      (v) => v === params.get("view")
    ) ?? "all"
  const listId = params.get("list") ?? defaultList?.id ?? ""
  const category = params.get("cat")
  const query = params.get("q") ?? ""
  // The field keeps its own text: URL updates are asynchronous, and binding
  // the input straight to them drops keystrokes when typing quickly. Our own
  // edits replace the history entry; any other navigation (a link, back or
  // forward) brings its query into the field.
  const location = useLocation()
  const navigationType = useNavigationType()
  const [text, setText] = useState(query)
  const [seenKey, setSeenKey] = useState(location.key)
  if (location.key !== seenKey) {
    setSeenKey(location.key)
    if (navigationType !== "REPLACE" && query !== text) setText(query)
  }
  const tier = TIERS.find((t) => t.value === params.get("tier")) ?? TIERS[0]
  const sortKey =
    (Object.keys(GET) as SortKey[]).find((k) => k === params.get("sort")) ??
    "rank"
  const sortDir =
    params.get("dir") === "asc" || params.get("dir") === "desc"
      ? (params.get("dir") as "asc" | "desc")
      : sortKey === "rank" || sortKey === "name"
        ? "asc"
        : "desc"
  const page = Math.max(1, Number(params.get("page")) || 1)

  const update = (patch: Record<string, string | null>, resetPage = true) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k)
      else next.set(k, v)
    }
    if (resetPage && !("page" in patch)) next.delete("page")
    setParams(next, { replace: true })
  }

  const universe = useUniverse()
  const categories = useCategories()
  const categoryAssets = useCategoryAssets(
    view === "category" ? category : null
  )
  const list = lists.find((l) => l.id === listId) ?? defaultList
  const watchIds = useMemo(
    () => list?.items.map((i) => i.assetId) ?? [],
    [list]
  )
  const watched = useQuotes(view === "watchlist" ? watchIds : [])
  const stablecoins = useStablecoinIds()

  const base: Asset[] = useMemo(() => {
    if (view === "watchlist")
      return watchIds
        .map((id) => watched.assets.get(id))
        .filter((a): a is Asset => !!a)
    if (view === "category") return categoryAssets.data ?? []
    return universe.data ?? []
  }, [view, watchIds, watched.assets, categoryAssets.data, universe.data])

  const q = query.trim()
  const rows = useMemo(() => {
    let list = q ? searchLocalAssets(base, q, Infinity) : base
    list = list.filter(
      (a) => (a.marketCap ?? 0) >= tier.min && (a.marketCap ?? 0) < tier.max
    )
    if (settings.hideStablecoins)
      list = list.filter((a) => !stablecoins.has(a.id))
    const get = GET[sortKey]
    const f = sortDir === "asc" ? 1 : -1
    return [...list].sort((a, b) => {
      const av = get(a)
      const bv = get(b)
      if (av === null && bv === null) return 0
      if (av === null) return 1
      if (bv === null) return -1
      return typeof av === "string"
        ? f * av.localeCompare(bv as string)
        : f * (av - (bv as number))
    })
  }, [base, q, tier, settings.hideStablecoins, stablecoins, sortKey, sortDir])

  const pageSize = settings.marketPageSize
  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const current = Math.min(page, pages)
  const visible = rows.slice((current - 1) * pageSize, current * pageSize)
  const sparks = useSparklines(
    settings.marketColumns.includes("sparkline") ? visible.map((a) => a.id) : []
  )

  const debounced = useDebounced(q, 350)
  const remote = useAssetSearch(view === "all" ? debounced : "")
  const shownIds = new Set(rows.map((r) => r.id))
  const remoteHits =
    q.length >= 2
      ? (remote.data ?? []).filter((h) => !shownIds.has(h.id)).slice(0, 8)
      : []

  const loading =
    view === "all"
      ? universe.isPending && !isFailing(universe)
      : view === "category"
        ? !!category && categoryAssets.isPending && !isFailing(categoryAssets)
        : watched.isLoading && watchIds.length > 0
  const failure =
    view === "all"
      ? isFailing(universe)
        ? universe.failureReason
        : null
      : view === "category" && isFailing(categoryAssets)
        ? categoryAssets.failureReason
        : null

  const onSort = (key: SortKey) => {
    const natural = key === "rank" || key === "name" ? "asc" : "desc"
    const next = nextSort({ key: sortKey, dir: sortDir }, key, natural)
    update({
      sort: next.key === "rank" && next.dir === "asc" ? null : next.key,
      dir: next.dir === natural ? null : next.dir,
    })
  }

  const columns = MARKET_COLUMNS.filter((c) =>
    settings.marketColumns.includes(c)
  )
  const topCategories = useMemo(
    () =>
      (categories.data ?? [])
        .filter((c) => (c.marketCap ?? 0) > 1e9)
        .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0)),
    [categories.data]
  )
  const updatedAt =
    view === "category" ? categoryAssets.dataUpdatedAt : universe.dataUpdatedAt

  return (
    <Page>
      <PageHeader
        title="Markets"
        description="The 250 largest assets by market cap, CoinGecko categories and your watchlists. Search reaches every listed asset."
        meta={
          updatedAt ? <span>Updated {formatAge(updatedAt, now)}</span> : null
        }
      />

      <div className="mb-3 flex flex-col gap-2 rounded-md border border-rule bg-surface p-2 lg:flex-row lg:flex-wrap lg:items-center">
        <Segmented
          label="View"
          value={view}
          onChange={(v) => update({ view: v === "all" ? null : v })}
          options={[
            { value: "all", label: "Top 250" },
            { value: "watchlist", label: "Watchlist" },
            { value: "category", label: "Category" },
          ]}
        />
        {view === "watchlist" && (
          <Select
            aria-label="Watchlist"
            value={list?.id}
            onChange={(e) => update({ list: e.target.value })}
            className="w-44"
          >
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.items.length})
              </option>
            ))}
          </Select>
        )}
        {view === "category" && (
          <Select
            aria-label="Category"
            value={category ?? ""}
            onChange={(e) => update({ cat: e.target.value || null })}
            className="w-60"
          >
            <option value="">Choose a category…</option>
            {topCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
        <div className="relative lg:w-64">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-3"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              update({ q: e.target.value })
            }}
            placeholder="Filter by name or symbol"
            aria-label="Filter assets by name or symbol"
            className="h-8 pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden"
          />
          {text && (
            <button
              type="button"
              onClick={() => {
                setText("")
                update({ q: null })
              }}
              aria-label="Clear filter"
              className="absolute top-1/2 right-1 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded text-ink-3 hover:text-ink"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
        <Segmented
          label="Market cap tier"
          size="sm"
          value={tier.value}
          onChange={(v) => update({ tier: v === "all" ? null : v })}
          options={TIERS.map((t) => ({ value: t.value, label: t.label }))}
          className="overflow-x-auto"
        />
        <div className="flex items-center gap-3 lg:ml-auto">
          <div className="w-44">
            <Switch
              label="Hide stablecoins"
              checked={settings.hideStablecoins}
              onChange={(v) => updateSettings({ hideStablecoins: v })}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" aria-label="Choose columns">
                <Columns3 aria-hidden="true" />{" "}
                <span className="hidden sm:inline">Columns</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="max-h-[70svh] overflow-y-auto">
              <DropdownMenuLabel>Columns (wider screens)</DropdownMenuLabel>
              {MARKET_COLUMNS.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c}
                  checked={settings.marketColumns.includes(c)}
                  disabled={c === "price"}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={(on) =>
                    updateSettings({
                      marketColumns: on
                        ? [...settings.marketColumns, c]
                        : settings.marketColumns.filter((x) => x !== c),
                    })
                  }
                >
                  {MARKET_COLUMN_LABELS[c]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {failure ? (
        <ErrorNotice
          error={failure}
          onRetry={() =>
            view === "category" ? categoryAssets.refetch() : universe.refetch()
          }
          title="Market data couldn’t be loaded"
        />
      ) : view === "category" && !category ? (
        <EmptyState title="Choose a category">
          CoinGecko classifies assets into sectors and narratives such as Layer
          1, DeFi or AI. Pick one to list its assets, largest first.
        </EmptyState>
      ) : view === "watchlist" && watchIds.length === 0 ? (
        <EmptyState
          title={`${list?.name ?? "This watchlist"} is empty`}
          action={
            <Button size="sm" onClick={() => update({ view: null })}>
              Browse the top 250
            </Button>
          }
        >
          Use the star next to any asset to add it.
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-md border border-rule bg-surface">
          <div
            className="flex items-center justify-between border-b border-rule px-3 py-1.5 text-xs text-ink-3"
            aria-live="polite"
          >
            <span>
              {loading
                ? "Loading…"
                : `${rows.length} ${rows.length === 1 ? "asset" : "assets"}${rows.length > pageSize ? ` · page ${current} of ${pages}` : ""}`}
            </span>
            {settings.hideStablecoins && <span>Stablecoins hidden</span>}
          </div>
          <div className="overflow-x-auto">
            <table className={cn(T.table, "min-w-full")}>
              <caption className="sr-only">
                Markets, sorted by {sortKey}{" "}
                {sortDir === "asc" ? "ascending" : "descending"}
              </caption>
              <thead className={T.thead}>
                <tr>
                  {columns.includes("rank") && (
                    <SortHeader
                      label="#"
                      srLabel="Rank"
                      sortKey="rank"
                      sort={{ key: sortKey, dir: sortDir }}
                      onSort={onSort}
                      align="left"
                      className={COLUMNS.rank.cls}
                    />
                  )}
                  <SortHeader
                    label="Asset"
                    sortKey="name"
                    sort={{ key: sortKey, dir: sortDir }}
                    onSort={onSort}
                    align="left"
                  />
                  {columns
                    .filter((c) => c !== "rank")
                    .map((c) =>
                      COLUMNS[c].sort ? (
                        <SortHeader
                          key={c}
                          label={COLUMNS[c].label}
                          srLabel={COLUMNS[c].sr}
                          sortKey={COLUMNS[c].sort!}
                          sort={{ key: sortKey, dir: sortDir }}
                          onSort={onSort}
                          className={COLUMNS[c].cls}
                        />
                      ) : (
                        <th
                          key={c}
                          scope="col"
                          className={cn(T.th, "text-left", COLUMNS[c].cls)}
                        >
                          {COLUMNS[c].label}
                        </th>
                      )
                    )}
                  <th scope="col" className={cn(T.th, "w-10")}>
                    <span className="sr-only">Watchlists</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 14 }, (_, i) => (
                      <tr key={i} className={T.tr}>
                        <td colSpan={columns.length + 2} className="px-3 py-2">
                          <Skeleton className="h-5 w-full" />
                        </td>
                      </tr>
                    ))
                  : visible.map((a) => (
                      <Row
                        key={a.id}
                        asset={a}
                        columns={columns}
                        spark={sparks[a.id] ?? []}
                      />
                    ))}
              </tbody>
            </table>
          </div>
          {!loading && rows.length === 0 && (
            <p className="px-3 py-6 text-center text-[0.8125rem] text-ink-2">
              No assets match these filters.{" "}
              <button
                type="button"
                className="text-accent hover:underline"
                onClick={() => {
                  setText("")
                  update({ q: null, tier: null })
                }}
              >
                Clear filters
              </button>
            </p>
          )}
          {pages > 1 && (
            <nav
              aria-label="Pages"
              className="flex items-center justify-between border-t border-rule px-3 py-2"
            >
              <Button
                size="sm"
                disabled={current <= 1}
                onClick={() => update({ page: String(current - 1) }, false)}
              >
                <ChevronLeft aria-hidden="true" /> Previous
              </Button>
              <span className="text-xs text-ink-3">
                Page {current} of {pages}
              </span>
              <Button
                size="sm"
                disabled={current >= pages}
                onClick={() => update({ page: String(current + 1) }, false)}
              >
                Next <ChevronRight aria-hidden="true" />
              </Button>
            </nav>
          )}
        </div>
      )}

      {view === "all" &&
        q.length >= 2 &&
        (remoteHits.length > 0 || remote.isFetching) && (
          <section
            className="mt-4 rounded-md border border-rule bg-surface"
            aria-labelledby="beyond"
          >
            <h2
              id="beyond"
              className="border-b border-rule px-3 py-2 text-[0.8125rem] font-semibold"
            >
              Beyond the top 250
            </h2>
            {remoteHits.length === 0 ? (
              <p className="px-3 py-3 text-[0.8125rem] text-ink-3">
                Searching CoinGecko…
              </p>
            ) : (
              <ul className="grid sm:grid-cols-2">
                {remoteHits.map((hit) => (
                  <li
                    key={hit.id}
                    className="border-b border-rule last:border-0 sm:odd:border-r"
                  >
                    <Link
                      to={`/markets/${hit.id}`}
                      className="flex items-center gap-2 px-3 py-2 text-[0.8125rem] hover:bg-surface-2/60"
                    >
                      <AssetIcon
                        src={hit.thumb}
                        symbol={hit.symbol}
                        size={18}
                      />
                      <span className="min-w-0 flex-1 truncate text-ink">
                        {hit.name}{" "}
                        <span className="mono text-xs text-ink-3">
                          {hit.symbol}
                        </span>
                      </span>
                      <span className="text-xs text-ink-3">
                        {hit.rank ? `#${hit.rank}` : "Unranked"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
    </Page>
  )
}
