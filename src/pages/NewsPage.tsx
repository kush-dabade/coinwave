import { useMemo, useState } from "react"
import { BookmarkPlus, ExternalLink, RotateCw, Search } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { EmptyState, ErrorNotice, Skeleton } from "@/components/data/states"
import { Page, PageHeader } from "@/components/layout/Page"
import { Button } from "@/components/ui/button"
import { Badge, Select, Switch } from "@/components/ui/controls"
import { Input } from "@/components/ui/input"
import { useNews, useUniverse } from "@/hooks/queries"
import { useNow, usePageTitle } from "@/hooks/use-ui"
import { formatAge } from "@/lib/format"
import { buildMatchers, groupStories, tagAssets } from "@/lib/news"
import { cn } from "@/lib/utils"
import { researchActions, useResearch } from "@/stores"

/** Stories shown at a time. */
const PAGE = 30

export default function NewsPage() {
  usePageTitle("News")
  const navigate = useNavigate()
  const news = useNews()
  const universe = useUniverse()
  const { notes } = useResearch()
  const now = useNow(60_000)
  const [query, setQuery] = useState("")
  const [source, setSource] = useState("")
  const [asset, setAsset] = useState("")
  const [grouped, setGrouped] = useState(true)
  const [limit, setLimit] = useState(PAGE)
  // Any filter change starts the list from the top again.
  const filterKey = `${query}|${source}|${asset}|${grouped}`
  const [seenFilter, setSeenFilter] = useState(filterKey)
  if (filterKey !== seenFilter) {
    setSeenFilter(filterKey)
    setLimit(PAGE)
  }

  const matchers = useMemo(
    () => buildMatchers((universe.data ?? []).slice(0, 150)),
    [universe.data]
  )
  const bySymbol = useMemo(
    () => new Map((universe.data ?? []).map((a) => [a.id, a])),
    [universe.data]
  )
  const tagged = useMemo(
    () =>
      (news.data?.items ?? []).map((item) => ({
        item,
        tags: tagAssets(`${item.title} ${item.summary}`, matchers),
      })),
    [news.data, matchers]
  )
  const tagOf = useMemo(
    () => new Map(tagged.map((t) => [t.item.id, t.tags])),
    [tagged]
  )
  const assetCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of tagged)
      for (const id of t.tags) m.set(id, (m.get(id) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [tagged])
  const savedLinks = useMemo(
    () => new Set(notes.map((n) => n.source?.url).filter(Boolean)),
    [notes]
  )

  const q = query.trim().toLowerCase()
  const filtered = useMemo(
    () =>
      tagged
        .filter(
          ({ item, tags }) =>
            (!source || item.sourceId === source) &&
            (!asset || tags.includes(asset)) &&
            (!q ||
              item.title.toLowerCase().includes(q) ||
              item.summary.toLowerCase().includes(q))
        )
        .map((t) => t.item),
    [tagged, source, asset, q]
  )
  const groups = useMemo(
    () =>
      grouped
        ? groupStories(filtered)
        : filtered.map((lead) => ({ lead, related: [] })),
    [filtered, grouped]
  )

  const save = (item: (typeof filtered)[number]) => {
    const note = researchActions.createNote({
      kind: "article",
      title: item.title,
      body: item.summary,
      assetIds: tagOf.get(item.id) ?? [],
      tags: ["news"],
      source: {
        name: item.source,
        url: item.link,
        publishedAt: item.publishedAt,
      },
    })
    toast("Saved to Research", {
      action: {
        label: "Open",
        onClick: () => navigate(`/research?note=${note.id}`),
      },
    })
  }

  const sources = news.data?.sources ?? []
  return (
    <Page>
      <PageHeader
        title="News"
        description="Headlines from crypto publishers’ RSS feeds over the last 7 days, tagged with the assets they mention. Read the full story at the publisher."
        meta={
          news.data && (
            <>
              <span>Updated {formatAge(news.data.fetchedAt, now)}</span>
              {sources.map((s) => (
                <span
                  key={s.id}
                  className={cn(
                    "inline-flex items-center gap-1",
                    !s.ok && "text-warn"
                  )}
                  title={s.error ?? undefined}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      s.ok ? "bg-up" : "bg-warn"
                    )}
                    aria-hidden="true"
                  />
                  {s.name}
                  {s.ok ? ` (${s.count})` : " unavailable"}
                </span>
              ))}
            </>
          )
        }
        actions={
          <Button
            size="sm"
            onClick={() => news.refetch()}
            disabled={news.isFetching}
          >
            <RotateCw
              className={cn(news.isFetching && "animate-spin")}
              aria-hidden="true"
            />{" "}
            Refresh
          </Button>
        }
      />

      {news.isPending ? (
        <Skeleton className="h-96" />
      ) : news.isError || !news.data ? (
        <ErrorNotice
          error={news.error}
          onRetry={() => news.refetch()}
          title="The news service is unavailable"
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
          <section
            aria-label="Headlines"
            className="min-w-0 rounded-md border border-rule bg-surface"
          >
            <div className="flex flex-wrap items-center gap-2 border-b border-rule p-2">
              <div className="relative min-w-48 flex-1">
                <Search
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-3"
                  aria-hidden="true"
                />
                <Input
                  type="search"
                  aria-label="Search headlines"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search headlines"
                  className="h-8 pl-8"
                />
              </div>
              <Select
                aria-label="Publisher"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-40"
              >
                <option value="">All publishers</option>
                {sources
                  .filter((s) => s.ok)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </Select>
              <div className="w-48">
                <Switch
                  label="Group duplicates"
                  checked={grouped}
                  onChange={setGrouped}
                />
              </div>
            </div>
            {groups.length === 0 ? (
              <div className="p-3">
                <EmptyState title="No headlines match">
                  Try another search or clear the filters.
                </EmptyState>
              </div>
            ) : (
              <ul className="divide-y divide-rule">
                {groups.slice(0, limit).map(({ lead, related }) => {
                  const tags = tagOf.get(lead.id) ?? []
                  const saved = savedLinks.has(lead.link)
                  return (
                    <li key={lead.id} className="flex gap-3 px-3 py-3">
                      <div className="min-w-0 flex-1">
                        <a
                          href={lead.link}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="group text-[0.9375rem] leading-6 font-medium text-ink hover:underline"
                        >
                          {lead.title}
                          <ExternalLink
                            className="ml-1 inline size-3.5 text-ink-3"
                            aria-hidden="true"
                          />
                          <span className="sr-only">
                            {" "}
                            (opens {lead.source} in a new tab)
                          </span>
                        </a>
                        {lead.summary && (
                          <p className="mt-0.5 line-clamp-2 text-[0.8125rem] text-ink-2">
                            {lead.summary}
                          </p>
                        )}
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6875rem] text-ink-3">
                          <span className="font-medium text-ink-2">
                            {lead.source}
                          </span>
                          <time
                            dateTime={new Date(lead.publishedAt).toISOString()}
                          >
                            {formatAge(lead.publishedAt, now)}
                          </time>
                          {related.length > 0 && (
                            <span>
                              Also:{" "}
                              {related.map((r, i) => (
                                <span key={r.id}>
                                  {i > 0 && ", "}
                                  <a
                                    href={r.link}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className="hover:underline"
                                  >
                                    {r.source}
                                  </a>
                                </span>
                              ))}
                            </span>
                          )}
                          {tags.map((id) => (
                            <Link
                              key={id}
                              to={`/markets/${id}`}
                              className="mono rounded bg-surface-2 px-1 text-ink-2 hover:text-ink"
                            >
                              {bySymbol.get(id)?.symbol ?? id}
                            </Link>
                          ))}
                        </p>
                      </div>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        disabled={saved}
                        aria-label={
                          saved
                            ? "Already saved to research"
                            : `Save “${lead.title}” to research`
                        }
                        title={saved ? "Saved" : "Save to research"}
                        onClick={() => save(lead)}
                      >
                        <BookmarkPlus
                          className={saved ? "text-accent" : undefined}
                          aria-hidden="true"
                        />
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
            {groups.length > limit && (
              <div className="border-t border-rule p-2 text-center">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setLimit((n) => n + PAGE)}
                >
                  Show more ({groups.length - limit} older)
                </Button>
              </div>
            )}
          </section>

          <aside className="space-y-3">
            <section
              className="rounded-md border border-rule bg-surface p-3"
              aria-labelledby="news-assets"
            >
              <h2
                id="news-assets"
                className="mb-2 text-[0.8125rem] font-semibold"
              >
                Assets in the news
              </h2>
              {assetCounts.length === 0 ? (
                <p className="text-xs text-ink-3">
                  No assets recognised in current headlines.
                </p>
              ) : (
                <ul className="space-y-0.5">
                  {asset && (
                    <li>
                      <button
                        type="button"
                        className="text-xs text-accent hover:underline"
                        onClick={() => setAsset("")}
                      >
                        Show all
                      </button>
                    </li>
                  )}
                  {assetCounts.slice(0, 15).map(([id, n]) => (
                    <li key={id}>
                      <button
                        type="button"
                        aria-pressed={asset === id}
                        onClick={() => setAsset(asset === id ? "" : id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[0.8125rem]",
                          asset === id
                            ? "bg-surface-2 text-ink"
                            : "text-ink-2 hover:bg-surface-2/60"
                        )}
                      >
                        <span className="flex-1 truncate">
                          {bySymbol.get(id)?.name ?? id}
                        </span>
                        <Badge>{n}</Badge>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-[0.6875rem] text-ink-3">
                Tags come from names and distinctive tickers in each headline;
                ordinary words like “near” or “link” are ignored.
              </p>
            </section>
            <p className="text-[0.6875rem] leading-5 text-ink-3">
              Sources: CoinDesk, Cointelegraph, Decrypt, The Block, Bitcoin
              Magazine and CryptoSlate public RSS feeds, fetched by CoinWave’s
              news function and cached for 5 minutes. Headlines and summaries
              belong to their publishers. CoinWave doesn’t rank stories by
              popularity.
            </p>
          </aside>
        </div>
      )}
    </Page>
  )
}
