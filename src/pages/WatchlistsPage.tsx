import { useMemo, useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  BellPlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react"
import { Link, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { AlertDialog, type AlertDraft } from "@/components/alerts/AlertDialog"
import { Change } from "@/components/data/Change"
import { Sparkline } from "@/components/data/Sparkline"
import { EmptyState, Skeleton } from "@/components/data/states"
import { AssetCell } from "@/components/data/table"
import { Page, PageHeader } from "@/components/layout/Page"
import { AssetPicker } from "@/components/portfolio/AssetPicker"
import { Button } from "@/components/ui/button"
import {
  Badge,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/controls"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NameDialog } from "@/components/ui/name-dialog"
import { useQuotes, useSparklines } from "@/hooks/queries"
import { usePageTitle } from "@/hooks/use-ui"
import { formatCompactMoney, formatPrice, isNum } from "@/lib/format"
import { median } from "@/lib/stats"
import { T } from "@/lib/table"
import { cn } from "@/lib/utils"
import {
  useAlerts,
  useWatchlists,
  watchlistActions,
  watchlistsStore,
} from "@/stores"

function NoteCell({
  listId,
  assetId,
  label,
  note,
}: {
  listId: string
  assetId: string
  /** Asset name for the field's accessible label. */
  label: string
  note: string
}) {
  return (
    <input
      aria-label={`Note for ${label}`}
      defaultValue={note}
      onBlur={(e) =>
        e.target.value !== note &&
        watchlistActions.setNote(listId, assetId, e.target.value.slice(0, 280))
      }
      onKeyDown={(e) =>
        e.key === "Enter" && (e.target as HTMLInputElement).blur()
      }
      placeholder="Add a note"
      className="h-7 w-full min-w-40 rounded bg-transparent px-1 text-xs text-ink-2 outline-none placeholder:text-ink-3 focus:bg-surface-2"
    />
  )
}

export default function WatchlistsPage() {
  usePageTitle("Watchlists")
  const [params, setParams] = useSearchParams()
  const { lists, defaultId } = useWatchlists()
  const { alerts } = useAlerts()
  const list =
    lists.find((l) => l.id === params.get("list")) ??
    lists.find((l) => l.id === defaultId) ??
    lists[0]
  const ids = useMemo(() => list?.items.map((i) => i.assetId) ?? [], [list])
  const { assets, isLoading } = useQuotes(ids)
  const sparks = useSparklines(ids)
  const [naming, setNaming] = useState<null | "new" | "rename">(null)
  const [adding, setAdding] = useState(false)
  const [alertDraft, setAlertDraft] = useState<AlertDraft | null>(null)

  const summary = useMemo(() => {
    const ch24 = ids.map((id) => assets.get(id)?.change24h).filter(isNum)
    const ch7 = ids.map((id) => assets.get(id)?.change7d).filter(isNum)
    const sorted = ids
      .map((id) => assets.get(id))
      .filter((a) => a && isNum(a.change24h))
      .sort((a, b) => b!.change24h! - a!.change24h!)
    return {
      avg24: ch24.length ? ch24.reduce((a, b) => a + b, 0) / ch24.length : null,
      med7: ch7.length ? median(ch7) : null,
      best: sorted[0] ?? null,
      worst: sorted.length > 1 ? sorted[sorted.length - 1] : null,
    }
  }, [ids, assets])

  const removeList = () => {
    if (!list || lists.length <= 1) return
    const before = watchlistsStore.get()
    watchlistActions.remove(list.id)
    setParams({}, { replace: true })
    toast(`Deleted “${list.name}”`, {
      action: {
        label: "Undo",
        onClick: () => watchlistActions.replace(before),
      },
    })
  }

  return (
    <Page>
      <PageHeader
        title="Watchlists"
        description="Named lists of assets with notes. Use the star anywhere in CoinWave to add assets; lists feed the Command Center, Markets, Compare and Risk Lab."
        actions={
          <Button size="sm" variant="primary" onClick={() => setNaming("new")}>
            <Plus aria-hidden="true" /> New list
          </Button>
        }
      />
      <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav
          aria-label="Watchlists"
          className="rounded-md border border-rule bg-surface p-1.5"
        >
          <ul className="space-y-0.5">
            {lists.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  aria-current={l.id === list?.id ? "page" : undefined}
                  onClick={() => setParams({ list: l.id }, { replace: true })}
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[0.8125rem]",
                    l.id === list?.id
                      ? "bg-surface-2 text-ink"
                      : "text-ink-2 hover:bg-surface-2/60"
                  )}
                >
                  {l.id === defaultId && (
                    <Star
                      className="size-3 fill-accent text-accent"
                      aria-label="Default list"
                    />
                  )}
                  <span className="flex-1 truncate">{l.name}</span>
                  <span className="num text-xs text-ink-3">
                    {l.items.length}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {list && (
          <section
            aria-labelledby="list-title"
            className="min-w-0 rounded-md border border-rule bg-surface"
          >
            <header className="flex flex-wrap items-center gap-2 border-b border-rule px-3 py-2">
              <h2
                id="list-title"
                className="text-[0.9375rem] font-semibold text-ink"
              >
                {list.name}
              </h2>
              {list.id === defaultId && <Badge tone="accent">Default</Badge>}
              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                <Popover open={adding} onOpenChange={setAdding}>
                  <PopoverTrigger asChild>
                    <Button size="sm">
                      <Plus aria-hidden="true" /> Add asset
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-80 p-2">
                    <AssetPicker
                      inputId="watch-add"
                      value={null}
                      suggestedIds={[]}
                      onChange={(a) => {
                        if (!a) return
                        watchlistActions.add(list.id, a.id)
                        setAdding(false)
                        toast(`${a.name} added to ${list.name}`)
                      }}
                    />
                  </PopoverContent>
                </Popover>
                {ids.length >= 2 && (
                  <Button size="sm" variant="ghost" asChild>
                    <Link to={`/compare?ids=${ids.slice(0, 6).join(",")}`}>
                      Compare
                    </Link>
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="List actions"
                    >
                      <MoreHorizontal aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onSelect={() => setNaming("rename")}>
                      <Pencil aria-hidden="true" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={list.id === defaultId}
                      onSelect={() => watchlistActions.setDefault(list.id)}
                    >
                      <Star aria-hidden="true" /> Make default
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to={`/markets?view=watchlist&list=${list.id}`}>
                        Open in Markets
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to={`/risk?subject=${list.id}`}>
                        Analyse in Risk Lab
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      tone="danger"
                      disabled={lists.length <= 1}
                      onSelect={removeList}
                    >
                      <Trash2 aria-hidden="true" /> Delete list
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>

            {ids.length === 0 ? (
              <div className="p-3">
                <EmptyState title="This list is empty">
                  Add assets with the button above, or with the star next to any
                  asset across CoinGecko’s catalogue.
                </EmptyState>
              </div>
            ) : (
              <>
                <dl className="grid grid-cols-2 gap-px border-b border-rule bg-rule sm:grid-cols-4">
                  <div className="bg-surface px-3 py-2">
                    <dt className="text-[0.6875rem] text-ink-3">Average 24h</dt>
                    <dd>
                      <Change value={summary.avg24} />
                    </dd>
                  </div>
                  <div className="bg-surface px-3 py-2">
                    <dt className="text-[0.6875rem] text-ink-3">Median 7d</dt>
                    <dd>
                      <Change value={summary.med7} />
                    </dd>
                  </div>
                  <div className="bg-surface px-3 py-2">
                    <dt className="text-[0.6875rem] text-ink-3">Best 24h</dt>
                    <dd className="text-[0.8125rem]">
                      {summary.best ? (
                        <>
                          {summary.best.symbol}{" "}
                          <Change value={summary.best.change24h} />
                        </>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                  <div className="bg-surface px-3 py-2">
                    <dt className="text-[0.6875rem] text-ink-3">Worst 24h</dt>
                    <dd className="text-[0.8125rem]">
                      {summary.worst ? (
                        <>
                          {summary.worst.symbol}{" "}
                          <Change value={summary.worst.change24h} />
                        </>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                </dl>
                <div className="overflow-x-auto">
                  <table className={T.table}>
                    <caption className="sr-only">{list.name}</caption>
                    <thead className={T.thead}>
                      <tr>
                        <th scope="col" className={cn(T.th, "w-16")}>
                          <span className="sr-only">Order</span>
                        </th>
                        <th scope="col" className={cn(T.th, "text-left")}>
                          Asset
                        </th>
                        <th scope="col" className={cn(T.th, "text-right")}>
                          Price
                        </th>
                        <th scope="col" className={cn(T.th, "text-right")}>
                          24h
                        </th>
                        <th
                          scope="col"
                          className={cn(
                            T.th,
                            "hidden text-right sm:table-cell"
                          )}
                        >
                          7d
                        </th>
                        <th
                          scope="col"
                          className={cn(
                            T.th,
                            "hidden text-right lg:table-cell"
                          )}
                        >
                          30d
                        </th>
                        <th
                          scope="col"
                          className={cn(
                            T.th,
                            "hidden text-right lg:table-cell"
                          )}
                        >
                          Mkt cap
                        </th>
                        <th
                          scope="col"
                          className={cn(T.th, "hidden md:table-cell")}
                        >
                          <span className="sr-only">7-day trend</span>
                        </th>
                        <th
                          scope="col"
                          className={cn(T.th, "hidden text-left xl:table-cell")}
                        >
                          Note
                        </th>
                        <th scope="col" className={cn(T.th, "w-24")}>
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.items.map((item, i) => {
                        const a = assets.get(item.assetId)
                        const alertCount = alerts.filter(
                          (x) =>
                            x.assetId === item.assetId && x.status === "active"
                        ).length
                        return (
                          <tr key={item.assetId} className={T.trHover}>
                            <td className={cn(T.td, "whitespace-nowrap")}>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                aria-label={`Move ${a?.name ?? item.assetId} up`}
                                disabled={i === 0}
                                onClick={() =>
                                  watchlistActions.move(
                                    list.id,
                                    item.assetId,
                                    -1
                                  )
                                }
                              >
                                <ArrowUp aria-hidden="true" />
                              </Button>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                aria-label={`Move ${a?.name ?? item.assetId} down`}
                                disabled={i === list.items.length - 1}
                                onClick={() =>
                                  watchlistActions.move(
                                    list.id,
                                    item.assetId,
                                    1
                                  )
                                }
                              >
                                <ArrowDown aria-hidden="true" />
                              </Button>
                            </td>
                            {/* Vertical padding keeps the asset link and the
                                note field below it comfortable touch targets. */}
                            <td className={cn(T.td, "py-1.5")}>
                              {a ? (
                                <AssetCell
                                  id={a.id}
                                  name={a.name}
                                  symbol={a.symbol}
                                  image={a.image}
                                />
                              ) : isLoading ? (
                                <Skeleton className="h-4 w-28" />
                              ) : (
                                <span className="text-ink-3">
                                  {item.assetId} · price unavailable
                                </span>
                              )}
                              <div className="mt-1 xl:hidden">
                                <NoteCell
                                  listId={list.id}
                                  assetId={item.assetId}
                                  label={a?.name ?? item.assetId}
                                  note={item.note}
                                />
                              </div>
                            </td>
                            <td className={cn(T.td, "num text-right text-ink")}>
                              {formatPrice(a?.price)}
                            </td>
                            <td className={cn(T.td, "text-right")}>
                              <Change value={a?.change24h} />
                            </td>
                            <td
                              className={cn(
                                T.td,
                                "hidden text-right sm:table-cell"
                              )}
                            >
                              <Change value={a?.change7d} />
                            </td>
                            <td
                              className={cn(
                                T.td,
                                "hidden text-right lg:table-cell"
                              )}
                            >
                              <Change value={a?.change30d} />
                            </td>
                            <td
                              className={cn(
                                T.td,
                                "num hidden text-right text-ink-2 lg:table-cell"
                              )}
                            >
                              {formatCompactMoney(a?.marketCap)}
                            </td>
                            <td className={cn(T.td, "hidden md:table-cell")}>
                              <Sparkline
                                values={sparks[item.assetId] ?? []}
                                width={88}
                                height={22}
                              />
                            </td>
                            <td className={cn(T.td, "hidden xl:table-cell")}>
                              <NoteCell
                                listId={list.id}
                                assetId={item.assetId}
                                label={a?.name ?? item.assetId}
                                note={item.note}
                              />
                            </td>
                            <td
                              className={cn(
                                T.td,
                                "text-right whitespace-nowrap"
                              )}
                            >
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                aria-label={`Create an alert for ${a?.name ?? item.assetId}${alertCount ? ` (${alertCount} active)` : ""}`}
                                title={
                                  alertCount
                                    ? `${alertCount} active alert${alertCount > 1 ? "s" : ""}`
                                    : "Create alert"
                                }
                                onClick={() =>
                                  setAlertDraft({
                                    asset: a
                                      ? {
                                          id: a.id,
                                          name: a.name,
                                          symbol: a.symbol,
                                          image: a.image,
                                        }
                                      : null,
                                    threshold: a?.price ?? undefined,
                                  })
                                }
                              >
                                <BellPlus
                                  className={
                                    alertCount ? "text-accent" : undefined
                                  }
                                  aria-hidden="true"
                                />
                              </Button>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                aria-label={`Remove ${a?.name ?? item.assetId} from ${list.name}`}
                                onClick={() => {
                                  const before = watchlistsStore.get()
                                  watchlistActions.removeItem(
                                    list.id,
                                    item.assetId
                                  )
                                  toast(`Removed ${a?.name ?? item.assetId}`, {
                                    action: {
                                      label: "Undo",
                                      onClick: () =>
                                        watchlistActions.replace(before),
                                    },
                                  })
                                }}
                              >
                                <X aria-hidden="true" />
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        )}
      </div>

      <NameDialog
        open={naming !== null}
        onOpenChange={(o) => !o && setNaming(null)}
        title={naming === "rename" ? "Rename watchlist" : "New watchlist"}
        initial={naming === "rename" ? (list?.name ?? "") : ""}
        confirm={naming === "rename" ? "Rename" : "Create"}
        onSubmit={(name) => {
          if (naming === "rename" && list)
            watchlistActions.rename(list.id, name)
          else
            setParams(
              { list: watchlistActions.create(name) },
              { replace: true }
            )
        }}
      />
      <AlertDialog
        open={alertDraft !== null}
        onOpenChange={(o) => !o && setAlertDraft(null)}
        draft={alertDraft ?? {}}
      />
    </Page>
  )
}
