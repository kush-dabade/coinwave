import { useMemo, useState } from "react"
import {
  BellPlus,
  ExternalLink,
  FilePlus2,
  NotebookPen,
  Plus,
} from "lucide-react"
import { Link, useNavigate } from "react-router-dom"

import { AlertDialog } from "@/components/alerts/AlertDialog"
import { Change } from "@/components/data/Change"
import { RangeBar } from "@/components/data/RangeBar"
import { ErrorNotice, Skeleton } from "@/components/data/states"
import { AssetCell } from "@/components/data/table"
import { Pane } from "@/components/layout/Page"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/controls"
import {
  isFailing,
  useCategories,
  useCategoryAssets,
  useNews,
  useTickers,
  useUniverse,
} from "@/hooks/queries"
import { usePortfolioValuation } from "@/hooks/use-portfolio-valuation"
import { useNow } from "@/hooks/use-ui"
import { describeAlert } from "@/lib/alerts"
import {
  formatAge,
  formatCompactMoney,
  formatDate,
  formatMoney,
  formatPercent,
  formatPrice,
  formatQuantity,
  formatShare,
  formatSupply,
  isNum,
} from "@/lib/format"
import { buildMatchers, groupStories, tagAssets } from "@/lib/news"
import { median } from "@/lib/stats"
import { T } from "@/lib/table"
import { cn, toneClass } from "@/lib/utils"
import {
  alertActions,
  journalActions,
  researchActions,
  useAlerts,
  useJournal,
  useResearch,
  useWatchlists,
} from "@/stores"
import type { Asset, AssetProfile } from "@/services/coingecko"

function Fact({
  label,
  value,
  note,
}: {
  label: string
  value: React.ReactNode
  note?: React.ReactNode
}) {
  return (
    <div className="border-b border-rule py-2">
      <dt className="text-[0.6875rem] text-ink-3">{label}</dt>
      <dd className="num mt-0.5 text-[0.8125rem] text-ink">{value}</dd>
      {note && <dd className="text-[0.6875rem] text-ink-3">{note}</dd>}
    </div>
  )
}

/** Returns over every period CoinGecko reports, and the same versus Bitcoin. */
export function PerformanceTable({
  asset,
  profile,
}: {
  asset: Asset
  profile?: AssetProfile
}) {
  const universe = useUniverse()
  const btc = universe.data?.find((a) => a.id === "bitcoin")
  const rows: { label: string; value: number | null; btc: number | null }[] = [
    { label: "1 hour", value: asset.change1h, btc: btc?.change1h ?? null },
    { label: "24 hours", value: asset.change24h, btc: btc?.change24h ?? null },
    { label: "7 days", value: asset.change7d, btc: btc?.change7d ?? null },
    { label: "14 days", value: asset.change14d, btc: btc?.change14d ?? null },
    { label: "30 days", value: asset.change30d, btc: btc?.change30d ?? null },
    { label: "60 days", value: profile?.change60d ?? null, btc: null },
    {
      label: "200 days",
      value: asset.change200d,
      btc: btc?.change200d ?? null,
    },
    { label: "1 year", value: asset.change1y, btc: btc?.change1y ?? null },
  ]
  const isBtc = asset.id === "bitcoin"
  return (
    <table className={T.table}>
      <caption className="sr-only">
        Price change by period{isBtc ? "" : " and relative to Bitcoin"}
      </caption>
      <thead>
        <tr>
          <th scope="col" className={cn(T.th, "text-left")}>
            Period
          </th>
          <th scope="col" className={cn(T.th, "text-right")}>
            {asset.symbol}
          </th>
          {!isBtc && (
            <th scope="col" className={cn(T.th, "text-right")}>
              BTC
            </th>
          )}
          {!isBtc && (
            <th
              scope="col"
              className={cn(T.th, "text-right")}
              title="Percentage points: positive means outperforming Bitcoin"
            >
              vs BTC (pp)
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const rel =
            !isBtc && isNum(r.value) && isNum(r.btc) ? r.value - r.btc : null
          return (
            <tr key={r.label} className={T.tr}>
              <th
                scope="row"
                className={cn(T.td, "text-left font-normal text-ink-2")}
              >
                {r.label}
              </th>
              <td className={cn(T.td, "text-right")}>
                <Change value={r.value} />
              </td>
              {!isBtc && (
                <td className={cn(T.td, "text-right")}>
                  <Change value={r.btc} />
                </td>
              )}
              {!isBtc && (
                <td className={cn(T.td, "num text-right", toneClass(rel))}>
                  {rel === null
                    ? "—"
                    : `${rel > 0 ? "+" : rel < 0 ? "−" : ""}${Math.abs(rel).toFixed(2)}`}
                </td>
              )}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export function MarketFacts({ asset }: { asset: Asset }) {
  return (
    <div>
      <dl className="grid grid-cols-2 gap-x-5 sm:grid-cols-3">
        <Fact
          label="Market cap"
          value={formatCompactMoney(asset.marketCap)}
          note={asset.rank ? `Rank #${asset.rank}` : undefined}
        />
        <Fact
          label="Fully diluted value"
          value={formatCompactMoney(asset.fdv)}
          note={
            isNum(asset.fdv) && isNum(asset.marketCap)
              ? `${(asset.fdv / asset.marketCap).toFixed(2)}× market cap`
              : undefined
          }
        />
        <Fact label="Volume, 24h" value={formatCompactMoney(asset.volume24h)} />
        <Fact
          label="Turnover"
          value={
            isNum(asset.volume24h) && asset.marketCap
              ? formatShare((asset.volume24h / asset.marketCap) * 100, 2)
              : "—"
          }
          note="24h volume / market cap"
        />
        <Fact
          label="Circulating supply"
          value={formatSupply(asset.circulatingSupply)}
        />
        <Fact
          label="Max supply"
          value={
            asset.maxSupply ? formatSupply(asset.maxSupply) : "No fixed cap"
          }
          note={
            isNum(asset.circulatingSupply) && isNum(asset.maxSupply)
              ? `${formatShare((asset.circulatingSupply / asset.maxSupply) * 100)} circulating`
              : undefined
          }
        />
      </dl>
      <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_1fr]">
        <div>
          <p className="mb-1.5 text-[0.6875rem] text-ink-3">24h range</p>
          <RangeBar
            low={asset.low24h}
            high={asset.high24h}
            value={asset.price}
            label="24 hour range"
          />
        </div>
        <dl className="grid grid-cols-2 gap-x-4 text-[0.8125rem]">
          <div>
            <dt className="text-[0.6875rem] text-ink-3">All-time high</dt>
            <dd className="num text-ink">{formatPrice(asset.ath)}</dd>
            <dd className="text-[0.6875rem] text-ink-3">
              {formatDate(asset.athDate)} ·{" "}
              <span className={toneClass(asset.athChange)}>
                {formatPercent(asset.athChange, { digits: 1 })}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-[0.6875rem] text-ink-3">All-time low</dt>
            <dd className="num text-ink">{formatPrice(asset.atl)}</dd>
            <dd className="text-[0.6875rem] text-ink-3">
              {formatDate(asset.atlDate)}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}

export function About({
  profile,
  loading,
  error,
}: {
  profile?: AssetProfile
  loading: boolean
  error: unknown
}) {
  const [expanded, setExpanded] = useState(false)
  if (loading) return <Skeleton className="h-28" />
  if (!profile)
    return (
      <p className="text-[0.8125rem] text-ink-3">
        {error
          ? "The asset profile is unavailable right now."
          : "No profile available."}
      </p>
    )
  const paragraphs = profile.description.split(/\n{2,}/).filter(Boolean)
  const long = paragraphs.length > 2 || profile.description.length > 600
  return (
    <div className="space-y-3 text-[0.8125rem]">
      {paragraphs.length > 0 ? (
        <div
          className={cn(
            "space-y-2 leading-6 text-ink-2",
            !expanded && long && "line-clamp-5"
          )}
        >
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      ) : (
        <p className="text-ink-3">
          CoinGecko has no description for this asset.
        </p>
      )}
      {long && (
        <button
          type="button"
          className="text-xs font-medium text-accent hover:underline"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
      {profile.categories.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {profile.categories.slice(0, 10).map((c) => (
            <Badge key={c}>{c}</Badge>
          ))}
        </div>
      )}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {profile.genesisDate && (
          <>
            <dt className="text-ink-3">Launched</dt>
            <dd className="text-ink-2">{formatDate(profile.genesisDate)}</dd>
          </>
        )}
        {profile.hashingAlgorithm && (
          <>
            <dt className="text-ink-3">Algorithm</dt>
            <dd className="text-ink-2">{profile.hashingAlgorithm}</dd>
          </>
        )}
      </dl>
      {profile.links.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {profile.links.map((l) => (
            <li key={l.label}>
              <a
                href={l.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
              >
                {l.label} <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      )}
      {profile.platforms.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-ink-2">
            Contract addresses ({profile.platforms.length})
          </summary>
          <ul className="mt-1 space-y-0.5">
            {profile.platforms.map((p) => (
              <li key={p.chain} className="flex gap-2">
                <span className="w-28 shrink-0 truncate text-ink-3">
                  {p.chain}
                </span>
                <span className="mono truncate text-ink-2">{p.address}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="text-[0.6875rem] text-ink-3">
        Profile and classification from CoinGecko.
      </p>
    </div>
  )
}

const TRUST = { green: "up", yellow: "warn", red: "down" } as const

/** Where the asset trades, how much, and how tightly (bid-ask spread). */
export function Venues({ id }: { id: string }) {
  const tickers = useTickers(id)
  const rows = useMemo(
    () =>
      (tickers.data ?? [])
        .filter((t) => !t.stale && isNum(t.volumeUsd))
        .slice(0, 25),
    [tickers.data]
  )
  const total = rows.reduce((s, t) => s + (t.volumeUsd ?? 0), 0)
  const spreads = rows
    .slice(0, 10)
    .map((t) => t.spreadPct)
    .filter(isNum)
  if (tickers.isPending) return <Skeleton className="h-48" />
  if (isFailing(tickers))
    return (
      <ErrorNotice
        error={tickers.failureReason}
        onRetry={() => tickers.refetch()}
        title="Couldn’t load trading venues"
      />
    )
  if (rows.length === 0)
    return (
      <p className="text-[0.8125rem] text-ink-3">
        CoinGecko reports no active trading venues for this asset.
      </p>
    )
  return (
    <div>
      <dl className="mb-3 grid grid-cols-3 gap-3 text-[0.8125rem]">
        <div>
          <dt className="text-[0.6875rem] text-ink-3">Venues shown</dt>
          <dd className="num text-ink">{rows.length}</dd>
        </div>
        <div>
          <dt className="text-[0.6875rem] text-ink-3">Largest venue share</dt>
          <dd className="num text-ink">
            {total
              ? formatShare(((rows[0].volumeUsd ?? 0) / total) * 100)
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[0.6875rem] text-ink-3">Median spread, top 10</dt>
          <dd className="num text-ink">
            {spreads.length
              ? formatPercent(median(spreads), { signed: false, digits: 3 })
              : "—"}
          </dd>
        </div>
      </dl>
      <div className="overflow-x-auto rounded-md border border-rule">
        <table className={T.table}>
          <caption className="sr-only">Trading venues by 24h volume</caption>
          <thead className={T.thead}>
            <tr>
              <th scope="col" className={cn(T.th, "text-left")}>
                Venue
              </th>
              <th scope="col" className={cn(T.th, "text-left")}>
                Pair
              </th>
              <th scope="col" className={cn(T.th, "text-right")}>
                Price
              </th>
              <th scope="col" className={cn(T.th, "text-right")}>
                Volume 24h
              </th>
              <th
                scope="col"
                className={cn(T.th, "hidden text-right sm:table-cell")}
              >
                Share
              </th>
              <th
                scope="col"
                className={cn(T.th, "hidden text-right sm:table-cell")}
              >
                Spread
              </th>
              <th
                scope="col"
                className={cn(T.th, "hidden text-right md:table-cell")}
              >
                Trust
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => (
              <tr key={`${t.exchange}-${t.pair}-${i}`} className={T.tr}>
                <td className={T.td}>
                  {t.url ? (
                    <a
                      href={t.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-ink hover:underline"
                    >
                      {t.exchange}
                    </a>
                  ) : (
                    <span className="text-ink">{t.exchange}</span>
                  )}
                </td>
                <td className={cn(T.td, "mono text-ink-2")}>{t.pair}</td>
                <td className={cn(T.td, "num text-right text-ink")}>
                  {formatPrice(t.priceUsd)}
                </td>
                <td className={cn(T.td, "num text-right text-ink-2")}>
                  {formatCompactMoney(t.volumeUsd)}
                </td>
                <td
                  className={cn(
                    T.td,
                    "num hidden text-right text-ink-2 sm:table-cell"
                  )}
                >
                  {total
                    ? formatShare(((t.volumeUsd ?? 0) / total) * 100)
                    : "—"}
                </td>
                <td
                  className={cn(
                    T.td,
                    "num hidden text-right text-ink-2 sm:table-cell"
                  )}
                >
                  {formatPercent(t.spreadPct, { signed: false, digits: 3 })}
                </td>
                <td className={cn(T.td, "hidden text-right md:table-cell")}>
                  {t.trust ? (
                    <Badge tone={TRUST[t.trust]}>{t.trust}</Badge>
                  ) : (
                    <span className="text-ink-3">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[0.6875rem] text-ink-3">
        Exchange tickers from CoinGecko, excluding stale or anomalous ones.
        Spread is the bid-ask spread CoinGecko reports; trust score is
        CoinGecko’s venue rating. Order-book depth is not available from free
        sources.
      </p>
    </div>
  )
}

export function AssetNews({ asset }: { asset: Asset }) {
  const news = useNews()
  const now = useNow(60_000)
  const navigate = useNavigate()
  const matcher = useMemo(() => buildMatchers([asset]), [asset])
  const items = useMemo(
    () =>
      groupStories(
        (news.data?.items ?? []).filter(
          (n) => tagAssets(`${n.title} ${n.summary}`, matcher).length > 0
        )
      ).slice(0, 12),
    [news.data, matcher]
  )
  if (news.isPending) return <Skeleton className="h-32" />
  if (news.isError || !news.data)
    return (
      <p className="text-[0.8125rem] text-ink-3">
        The news service is unavailable right now.
      </p>
    )
  if (items.length === 0)
    return (
      <p className="text-[0.8125rem] text-ink-3">
        No headlines from the last 7 days mention {asset.name}.
      </p>
    )
  return (
    <ul className="divide-y divide-rule">
      {items.map(({ lead, related }) => (
        <li key={lead.id} className="py-2">
          <a
            href={lead.link}
            target="_blank"
            rel="noreferrer noopener"
            className="text-[0.8125rem] text-ink hover:underline"
          >
            {lead.title}
          </a>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.6875rem] text-ink-3">
            <span>{lead.source}</span>
            <span>{formatAge(lead.publishedAt, now)}</span>
            {related.length > 0 && (
              <span>also {related.map((r) => r.source).join(", ")}</span>
            )}
            <button
              type="button"
              className="text-accent hover:underline"
              onClick={() => {
                const note = researchActions.createNote({
                  kind: "article",
                  title: lead.title,
                  body: lead.summary,
                  assetIds: [asset.id],
                  source: {
                    name: lead.source,
                    url: lead.link,
                    publishedAt: lead.publishedAt,
                  },
                })
                navigate(`/research?note=${note.id}`)
              }}
            >
              Save to research
            </button>
          </p>
        </li>
      ))}
    </ul>
  )
}

export function PositionPane({ asset }: { asset: Asset }) {
  const navigate = useNavigate()
  const { positions, closed, sample } = usePortfolioValuation()
  const pos =
    positions.find((p) => p.assetId === asset.id) ??
    closed.find((p) => p.assetId === asset.id)
  return (
    <Pane
      title="Your position"
      subtitle={sample ? "Sample portfolio, not real holdings" : undefined}
    >
      {!pos ? (
        <div className="text-[0.8125rem] text-ink-2">
          <p>You don’t hold {asset.name}.</p>
          <Button
            size="sm"
            className="mt-2"
            onClick={() =>
              navigate("/portfolio", {
                state: {
                  addTransaction: true,
                  asset: {
                    id: asset.id,
                    name: asset.name,
                    symbol: asset.symbol,
                    image: asset.image,
                  },
                },
              })
            }
          >
            <Plus aria-hidden="true" /> Record a transaction
          </Button>
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-x-4">
            <Fact label="Quantity" value={formatQuantity(pos.quantity)} />
            <Fact
              label="Value"
              value={formatMoney(pos.value)}
              note={
                pos.weight !== null
                  ? `${formatShare(pos.weight)} of portfolio`
                  : undefined
              }
            />
            <Fact label="Average cost" value={formatPrice(pos.avgCost)} />
            <Fact
              label="Unrealised P&L"
              value={
                <span className={toneClass(pos.unrealizedPnL)}>
                  {formatMoney(pos.unrealizedPnL, { signed: true })}
                </span>
              }
              note={
                isNum(pos.unrealizedPct)
                  ? `${formatPercent(pos.unrealizedPct)} on cost`
                  : undefined
              }
            />
            {pos.realizedPnL !== 0 && (
              <Fact
                label="Realised P&L"
                value={
                  <span className={toneClass(pos.realizedPnL)}>
                    {formatMoney(pos.realizedPnL, { signed: true })}
                  </span>
                }
              />
            )}
          </dl>
          <div className="mt-2 flex gap-3 text-xs">
            <Link
              to="/portfolio"
              className="font-medium text-accent hover:underline"
            >
              Portfolio
            </Link>
            <Link
              to="/risk"
              className="font-medium text-accent hover:underline"
            >
              Risk Lab
            </Link>
          </div>
        </>
      )}
    </Pane>
  )
}

export function WatchlistsPane({ asset }: { asset: Asset }) {
  const { listsFor } = useWatchlists()
  const lists = listsFor(asset.id)
  return (
    <Pane title="Watchlists">
      {lists.length === 0 ? (
        <p className="text-[0.8125rem] text-ink-3">
          Not on any watchlist. Use Watch above to add it.
        </p>
      ) : (
        <ul className="space-y-1.5 text-[0.8125rem]">
          {lists.map((l) => {
            const note = l.items.find((i) => i.assetId === asset.id)?.note
            return (
              <li key={l.id}>
                <Link
                  to={`/watchlists?list=${l.id}`}
                  className="text-ink hover:underline"
                >
                  {l.name}
                </Link>
                {note && <p className="text-xs text-ink-3">{note}</p>}
              </li>
            )
          })}
        </ul>
      )}
    </Pane>
  )
}

export function AlertsPane({ asset }: { asset: Asset }) {
  const { alerts } = useAlerts()
  const [open, setOpen] = useState(false)
  const mine = alerts.filter((a) => a.assetId === asset.id)
  return (
    <Pane
      title="Alerts"
      actions={
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
          <BellPlus aria-hidden="true" /> New
        </Button>
      }
    >
      {mine.length === 0 ? (
        <p className="text-[0.8125rem] text-ink-3">
          No alerts for {asset.symbol}.
        </p>
      ) : (
        <ul className="space-y-1.5 text-[0.8125rem]">
          {mine.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-2">
              <span className="text-ink-2">{describeAlert(a)}</span>
              <span className="flex shrink-0 items-center gap-1">
                <Badge
                  tone={
                    a.status === "triggered"
                      ? "warn"
                      : a.status === "active"
                        ? "accent"
                        : "neutral"
                  }
                >
                  {a.status}
                </Badge>
                {a.status !== "active" && (
                  <button
                    type="button"
                    className="text-xs text-accent hover:underline"
                    onClick={() => alertActions.rearm(a.id)}
                  >
                    Re-arm
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      <AlertDialog
        open={open}
        onOpenChange={setOpen}
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
    </Pane>
  )
}

export function ResearchPane({ asset }: { asset: Asset }) {
  const navigate = useNavigate()
  const { notes } = useResearch()
  const { theses } = useJournal()
  const now = useNow(60_000)
  const myNotes = notes
    .filter((n) => n.assetIds.includes(asset.id))
    .sort((a, b) => b.updatedAt - a.updatedAt)
  const myTheses = theses.filter((t) => t.assetIds.includes(asset.id))
  return (
    <Pane
      title="Research"
      actions={
        <>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              navigate(
                `/research?note=${researchActions.createNote({ title: `${asset.name} notes`, assetIds: [asset.id] }).id}`
              )
            }
          >
            <FilePlus2 aria-hidden="true" /> Note
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              navigate(
                `/journal/${journalActions.create({ title: `${asset.name} thesis`, assetIds: [asset.id] }).id}`
              )
            }
          >
            <NotebookPen aria-hidden="true" /> Thesis
          </Button>
        </>
      }
    >
      {myNotes.length === 0 && myTheses.length === 0 ? (
        <p className="text-[0.8125rem] text-ink-3">
          No notes or theses about {asset.name} yet.
        </p>
      ) : (
        <ul className="space-y-1.5 text-[0.8125rem]">
          {myTheses.map((t) => (
            <li key={t.id} className="flex items-center gap-2">
              <Badge
                tone={
                  t.stance === "bullish"
                    ? "up"
                    : t.stance === "bearish"
                      ? "down"
                      : "neutral"
                }
              >
                {t.stance}
              </Badge>
              <Link
                to={`/journal/${t.id}`}
                className="truncate text-ink hover:underline"
              >
                {t.title || "Untitled thesis"}
              </Link>
              <span className="ml-auto text-xs text-ink-3 capitalize">
                {t.status}
              </span>
            </li>
          ))}
          {myNotes.slice(0, 6).map((n) => (
            <li key={n.id} className="flex items-center gap-2">
              <Badge>{n.kind === "article" ? "article" : "note"}</Badge>
              <Link
                to={`/research?note=${n.id}`}
                className="truncate text-ink hover:underline"
              >
                {n.title || "Untitled note"}
              </Link>
              <span className="ml-auto shrink-0 text-xs text-ink-3">
                {formatAge(n.updatedAt, now)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Pane>
  )
}

/** Generic CoinGecko categories that say nothing about what an asset does. */
const GENERIC =
  /ecosystem|portfolio|binance|coinbase|launchpad|alleged|fan token|holdings|made in|world liberty|index|ftx/i

export function RelatedPane({
  asset,
  profile,
}: {
  asset: Asset
  profile?: AssetProfile
}) {
  const categories = useCategories()
  const category = useMemo(() => {
    const byName = new Map(
      (categories.data ?? []).map((c) => [c.name.toLowerCase(), c])
    )
    return (
      profile?.categories
        .filter((c) => !GENERIC.test(c))
        .map((c) => byName.get(c.toLowerCase()))
        .find((c) => c && (c.marketCap ?? 0) > 0) ?? null
    )
  }, [categories.data, profile])
  const peers = useCategoryAssets(category?.id ?? null)
  const rows = (peers.data ?? []).filter((a) => a.id !== asset.id).slice(0, 6)
  return (
    <Pane
      title="Related assets"
      subtitle={
        category ? `Largest in “${category.name}” (CoinGecko)` : undefined
      }
      flush
    >
      {!profile || !category ? (
        <p className="p-3 text-[0.8125rem] text-ink-3">
          {profile
            ? "No usable category classification."
            : "Loading classification…"}
        </p>
      ) : peers.isPending ? (
        <div className="p-3">
          <Skeleton className="h-32" />
        </div>
      ) : rows.length === 0 ? (
        <p className="p-3 text-[0.8125rem] text-ink-3">
          No other assets in this category.
        </p>
      ) : (
        <table className={T.table}>
          <caption className="sr-only">Related assets</caption>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className={T.trHover}>
                <td className={T.td}>
                  <AssetCell
                    id={a.id}
                    name={a.name}
                    symbol={a.symbol}
                    image={a.image}
                    size={18}
                  />
                </td>
                <td className={cn(T.td, "num text-right text-ink-2")}>
                  {formatCompactMoney(a.marketCap)}
                </td>
                <td className={cn(T.td, "text-right")}>
                  <Change value={a.change7d} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {category && rows.length > 0 && (
        <div className="flex gap-3 border-t border-rule px-3 py-2 text-xs">
          <Link
            to={`/compare?ids=${[asset.id, ...rows.slice(0, 3).map((r) => r.id)].join(",")}`}
            className="font-medium text-accent hover:underline"
          >
            Compare with peers
          </Link>
          <Link
            to={`/markets?view=category&cat=${category.id}`}
            className="font-medium text-accent hover:underline"
          >
            All in category
          </Link>
        </div>
      )}
    </Pane>
  )
}
