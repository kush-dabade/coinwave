import { useMemo, useState } from "react"
import { useQueries } from "@tanstack/react-query"
import { History, ListPlus, Plus, Save, Trash2, X } from "lucide-react"
import { Link, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { Change } from "@/components/data/Change"
import { EmptyState, ErrorNotice, Skeleton } from "@/components/data/states"
import { AssetCell, SortHeader } from "@/components/data/table"
import { WatchButton } from "@/components/data/WatchButton"
import { Page, PageHeader, Pane } from "@/components/layout/Page"
import { Button } from "@/components/ui/button"
import { Badge, Select } from "@/components/ui/controls"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { NameDialog } from "@/components/ui/name-dialog"
import { isFailing, useBinancePrices, useUniverse } from "@/hooks/queries"
import { usePageTitle } from "@/hooks/use-ui"
import { formatCompactMoney, formatPercent, formatPrice } from "@/lib/format"
import { newId } from "@/lib/portfolio"
import { T, nextSort } from "@/lib/table"
import {
  FIELDS,
  FIELD_MAP,
  PRESETS,
  decodeConditions,
  encodeConditions,
  enrich,
  historyMetrics,
  parseHuman,
  savedScreenQuery,
  screen,
  usesHistory,
  value,
  type Condition,
  type FieldKey,
  type HistoryMetrics,
  type ScreenRow,
} from "@/lib/screener"
import { cn } from "@/lib/utils"
import { binancePairFor, fetchKlines } from "@/services/binance"
import {
  screensStore,
  useSavedScreens,
  useWatchlists,
  watchlistActions,
} from "@/stores"

function formatField(field: FieldKey, v: number | null) {
  const f = FIELD_MAP[field]
  if (v === null) return "—"
  if (f.unit === "usd") return formatCompactMoney(v)
  if (f.unit === "price") return formatPrice(v)
  if (f.unit === "ratio") return `${v.toFixed(2)}×`
  if (f.unit === "rank") return `#${v}`
  return formatPercent(v, {
    signed: f.group !== "Valuation & supply" || field === "athChange",
  })
}

function unitHint(field: FieldKey) {
  const u = FIELD_MAP[field].unit
  return u === "usd"
    ? "USD, e.g. 1B or 250M"
    : u === "price"
      ? "USD"
      : u === "ratio"
        ? "multiple, e.g. 2"
        : u === "rank"
          ? "rank"
          : "%"
}

function ConditionRow({
  c,
  onChange,
  onRemove,
  index,
}: {
  c: Condition
  onChange: (c: Condition) => void
  onRemove: () => void
  index: number
}) {
  const [a, setA] = useState(String(c.a))
  const [b, setB] = useState(String(c.b ?? ""))
  const commit = (text: string, key: "a" | "b") => {
    const n = parseHuman(text)
    if (n === null) return
    onChange({ ...c, [key]: n })
  }
  const groups = [...new Set(FIELDS.map((f) => f.group))]
  return (
    <li className="grid grid-cols-[1fr_auto] gap-1.5 border-b border-rule py-2 last:border-0">
      <div className="space-y-1.5">
        <Select
          aria-label={`Condition ${index + 1} field`}
          value={c.field}
          onChange={(e) =>
            onChange({ ...c, field: e.target.value as FieldKey })
          }
          className="w-full"
        >
          {groups.map((g) => (
            <optgroup key={g} label={g}>
              {FIELDS.filter((f) => f.group === g).map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
        <div className="flex items-center gap-1.5">
          <Select
            aria-label={`Condition ${index + 1} operator`}
            value={c.op}
            onChange={(e) =>
              onChange({
                ...c,
                op: e.target.value as Condition["op"],
                b: c.b ?? c.a,
              })
            }
            className="w-28 shrink-0"
          >
            <option value="gt">above</option>
            <option value="lt">below</option>
            <option value="between">between</option>
          </Select>
          <Input
            aria-label={`Condition ${index + 1} value`}
            value={a}
            onChange={(e) => setA(e.target.value)}
            onBlur={() => commit(a, "a")}
            onKeyDown={(e) => e.key === "Enter" && commit(a, "a")}
            className="num h-8"
            aria-invalid={parseHuman(a) === null ? true : undefined}
          />
          {c.op === "between" && (
            <>
              <span className="text-xs text-ink-3">and</span>
              <Input
                aria-label={`Condition ${index + 1} upper value`}
                value={b}
                onChange={(e) => setB(e.target.value)}
                onBlur={() => commit(b, "b")}
                onKeyDown={(e) => e.key === "Enter" && commit(b, "b")}
                className="num h-8"
                aria-invalid={parseHuman(b) === null ? true : undefined}
              />
            </>
          )}
        </div>
        <p className="text-[0.6875rem] text-ink-3">
          {FIELD_MAP[c.field].help}{" "}
          <span className="text-ink-2">Unit: {unitHint(c.field)}.</span>
          {FIELD_MAP[c.field].source === "history" && (
            <Badge tone="accent" className="ml-1">
              history scan
            </Badge>
          )}
        </p>
      </div>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={`Remove condition ${index + 1}`}
        onClick={onRemove}
      >
        <X aria-hidden="true" />
      </Button>
    </li>
  )
}

export default function ScreenerPage() {
  usePageTitle("Screener")
  const [params, setParams] = useSearchParams()
  const universe = useUniverse()
  const binance = useBinancePrices()
  const saved = useSavedScreens()
  const { lists } = useWatchlists()
  const [naming, setNaming] = useState(false)

  const conditions = useMemo(() => decodeConditions(params.get("f")), [params])
  const sortField = (FIELDS.find((f) => f.key === params.get("sort"))?.key ??
    "marketCap") as FieldKey
  const sortDir = params.get("dir") === "asc" ? "asc" : "desc"
  const scanOn = params.get("hist") === "1" || usesHistory(conditions)

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace: true })
  }
  const setConditions = (next: Condition[]) =>
    set({ f: next.length ? encodeConditions(next) : null })

  // Market-only conditions narrow the candidates before any history is fetched.
  const marketRows = useMemo(() => enrich(universe.data ?? []), [universe.data])
  const marketOnly = conditions.filter(
    (c) => FIELD_MAP[c.field].source === "market"
  )
  const candidates = useMemo(
    () => screen(marketRows, marketOnly).slice(0, 150),
    [marketRows, marketOnly]
  )

  const scanTargets = useMemo(
    () =>
      scanOn && binance.data
        ? candidates
            .map((a) => ({ id: a.id, pair: binancePairFor(a, binance.data!) }))
            .filter((x): x is { id: string; pair: string } => !!x.pair)
        : [],
    [scanOn, binance.data, candidates]
  )
  const scans = useQueries({
    queries: scanTargets.map((t) => ({
      queryKey: ["screen-history", t.id, t.pair],
      queryFn: async ({ signal }: { signal: AbortSignal }) =>
        historyMetrics(await fetchKlines(t.pair, "1d", 62, signal)),
      staleTime: 60 * 60_000,
      retry: 1,
    })),
  })
  const scanned = scans.filter((s) => s.data).length
  const scanFailed = scans.filter((s) => s.isError).length
  const history = useMemo(() => {
    const m = new Map<string, HistoryMetrics>()
    scans.forEach((s, i) => s.data && m.set(scanTargets[i].id, s.data))
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `scans` changes identity every render
  }, [scanned, scanTargets])

  const rows: ScreenRow[] = useMemo(() => {
    const enriched = enrich(universe.data ?? [], history)
    const out = screen(enriched, conditions)
    const f = sortDir === "asc" ? 1 : -1
    return out.sort((a, b) => {
      const av = value(a, sortField)
      const bv = value(b, sortField)
      if (av === null && bv === null) return 0
      if (av === null) return 1
      if (bv === null) return -1
      return f * (av - bv)
    })
  }, [universe.data, history, conditions, sortField, sortDir])

  const shownFields = useMemo(() => {
    const base: FieldKey[] = ["marketCap", "change24h", "change7d", "change30d"]
    const used = conditions.map((c) => c.field)
    return [...new Set([...used, sortField, ...base])]
      .filter((k) => k !== "price")
      .slice(0, 7)
  }, [conditions, sortField])

  const applyPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id)
    if (!p) return
    set({
      f: encodeConditions(p.conditions),
      sort: p.sort.field,
      dir: p.sort.dir,
      hist: usesHistory(p.conditions) ? "1" : null,
    })
  }

  const onSort = (key: FieldKey) => {
    const next = nextSort(
      { key: sortField, dir: sortDir },
      key,
      key === "rank" ? "asc" : "desc"
    )
    set({ sort: next.key, dir: next.dir })
  }

  const addAll = (listId: string, listName: string) => {
    const ids = rows.slice(0, 50).map((r) => r.id)
    ids.forEach((id) => watchlistActions.add(listId, id))
    toast(`Added ${ids.length} assets to ${listName}`)
  }

  const historyNotOnBinance = scanOn
    ? candidates.length - scanTargets.length
    : 0

  return (
    <Page>
      <PageHeader
        title="Screener"
        description="Combine conditions on real market data. Every condition must hold; assets missing a value never pass a filter on it."
        actions={
          <>
            {saved.length > 0 && (
              <Select
                aria-label="Saved screens"
                value=""
                onChange={(e) => {
                  const s = saved.find((x) => x.id === e.target.value)
                  if (s) setParams(savedScreenQuery(s), { replace: true })
                }}
                className="w-48"
              >
                <option value="">Saved screens…</option>
                {saved.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}
            <Button
              size="sm"
              disabled={conditions.length === 0}
              onClick={() => setNaming(true)}
            >
              <Save aria-hidden="true" /> Save screen
            </Button>
          </>
        }
      />

      <div
        className="mb-3 flex flex-wrap gap-1.5"
        role="group"
        aria-label="Preset screens"
      >
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            title={p.description}
            onClick={() => applyPreset(p.id)}
            className="h-7 rounded-full border border-rule-strong bg-surface px-3 text-xs text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-3">
          <Pane
            title="Conditions"
            subtitle={
              conditions.length
                ? `${conditions.length} active`
                : "None: showing all 250"
            }
            actions={
              conditions.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConditions([])}
                >
                  Clear
                </Button>
              )
            }
          >
            {conditions.length > 0 && (
              <ol className="-mt-2">
                {conditions.map((c, i) => (
                  <ConditionRow
                    key={`${i}-${c.field}-${c.op}`}
                    index={i}
                    c={c}
                    onChange={(next) =>
                      setConditions(
                        conditions.map((x, j) => (j === i ? next : x))
                      )
                    }
                    onRemove={() =>
                      setConditions(conditions.filter((_, j) => j !== i))
                    }
                  />
                ))}
              </ol>
            )}
            <Button
              size="sm"
              className="mt-2"
              onClick={() =>
                setConditions([
                  ...conditions,
                  { field: "change7d", op: "gt", a: 0 },
                ])
              }
            >
              <Plus aria-hidden="true" /> Add condition
            </Button>
          </Pane>

          <Pane
            title="History scan"
            subtitle="30-day highs/lows, volume baseline, volatility"
          >
            <p className="text-xs text-ink-2">
              Fetches 60 days of daily Binance candles for up to 150 candidates
              that pass the other conditions. Assets without a Binance USDT pair
              can’t be scanned and fail history conditions.
            </p>
            {scanOn ? (
              <div className="mt-2 text-xs">
                {binance.isPending ? (
                  <p className="text-ink-3">Matching Binance pairs…</p>
                ) : (
                  <>
                    <p className="text-ink-2">
                      <span className="num">{scanned}</span> of{" "}
                      <span className="num">{scanTargets.length}</span> scanned
                      {scanFailed > 0 && `, ${scanFailed} failed`}.
                    </p>
                    {historyNotOnBinance > 0 && (
                      <p className="text-ink-3">
                        {historyNotOnBinance} candidates have no Binance pair.
                      </p>
                    )}
                    <div
                      className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2"
                      aria-hidden="true"
                    >
                      <div
                        className="h-full bg-accent transition-all"
                        style={{
                          width: `${scanTargets.length ? (scanned / scanTargets.length) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </>
                )}
                {!usesHistory(conditions) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-1"
                    onClick={() => set({ hist: null })}
                  >
                    Turn off
                  </Button>
                )}
              </div>
            ) : (
              <Button
                size="sm"
                className="mt-2"
                onClick={() => set({ hist: "1" })}
              >
                <History aria-hidden="true" /> Run history scan
              </Button>
            )}
          </Pane>
        </div>

        <Pane
          title="Results"
          subtitle={
            universe.data
              ? `${rows.length} of ${universe.data.length} assets match`
              : undefined
          }
          flush
          actions={
            rows.length > 0 && (
              <>
                <Button size="sm" variant="ghost" asChild>
                  <Link
                    to={`/compare?ids=${rows
                      .slice(0, 5)
                      .map((r) => r.id)
                      .join(",")}`}
                  >
                    Compare top 5
                  </Link>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost">
                      <ListPlus aria-hidden="true" /> Add to watchlist
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuLabel>
                      Add up to 50 results to
                    </DropdownMenuLabel>
                    {lists.map((l) => (
                      <DropdownMenuItem
                        key={l.id}
                        onSelect={() => addAll(l.id, l.name)}
                      >
                        {l.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )
          }
        >
          {isFailing(universe) ? (
            <div className="p-3">
              <ErrorNotice
                error={universe.failureReason}
                onRetry={() => universe.refetch()}
                title="Market data couldn’t be loaded"
              />
            </div>
          ) : !universe.data ? (
            <div className="p-3">
              <Skeleton className="h-80" />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-3">
              <EmptyState title="No assets match">
                Loosen a condition or remove one.
                {scanOn && scanned < scanTargets.length
                  ? " The history scan is still running."
                  : ""}
              </EmptyState>
            </div>
          ) : (
            <div className="max-h-[70svh] overflow-auto">
              <table className={T.table}>
                <caption className="sr-only">Screen results</caption>
                <thead className={T.thead}>
                  <tr>
                    <th scope="col" className={cn(T.th, "text-left")}>
                      Asset
                    </th>
                    <SortHeader
                      label="Price"
                      sortKey={"price" as FieldKey}
                      sort={{ key: sortField, dir: sortDir }}
                      onSort={onSort}
                    />
                    {shownFields.map((k, i) => (
                      <SortHeader
                        key={k}
                        label={FIELD_MAP[k].short}
                        srLabel={FIELD_MAP[k].label}
                        sortKey={k}
                        sort={{ key: sortField, dir: sortDir }}
                        onSort={onSort}
                        className={cn(
                          i >= 2 && "hidden md:table-cell",
                          i >= 4 && "hidden xl:table-cell"
                        )}
                      />
                    ))}
                    <th scope="col" className={cn(T.th, "w-10")}>
                      <span className="sr-only">Watchlists</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 250).map((r) => (
                    <tr key={r.id} className={T.trHover}>
                      <td className={T.td}>
                        <AssetCell
                          id={r.id}
                          name={r.name}
                          symbol={r.symbol}
                          image={r.image}
                          sub={r.rank ? ` · #${r.rank}` : ""}
                        />
                      </td>
                      <td className={cn(T.td, "num text-right text-ink")}>
                        {formatPrice(r.price)}
                      </td>
                      {shownFields.map((k, i) => {
                        const v = value(r, k)
                        const pct =
                          FIELD_MAP[k].unit === "pct" &&
                          FIELD_MAP[k].group !== "Valuation & supply"
                        return (
                          <td
                            key={k}
                            className={cn(
                              T.td,
                              "text-right",
                              i >= 2 && "hidden md:table-cell",
                              i >= 4 && "hidden xl:table-cell"
                            )}
                          >
                            {pct ? (
                              <Change value={v} />
                            ) : (
                              <span className="num text-ink-2">
                                {formatField(k, v)}
                              </span>
                            )}
                          </td>
                        )
                      })}
                      <td className={cn(T.td, "text-right")}>
                        <WatchButton id={r.id} name={r.name} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Pane>
      </div>

      <NameDialog
        open={naming}
        onOpenChange={setNaming}
        title="Save screen"
        description="Saved screens appear in the menu above and in search."
        confirm="Save"
        onSubmit={(name) => {
          const sort = new URLSearchParams()
          if (params.get("sort")) sort.set("sort", params.get("sort")!)
          if (params.get("dir")) sort.set("dir", params.get("dir")!)
          screensStore.set((prev) => [
            {
              id: newId(),
              name,
              conditions: encodeConditions(conditions),
              sort: sort.toString(),
              createdAt: Date.now(),
            },
            ...prev,
          ])
          toast(`Saved “${name}”`)
        }}
      />
      {saved.length > 0 && (
        <details className="mt-4 text-xs text-ink-3">
          <summary className="cursor-pointer">
            Manage saved screens ({saved.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {saved.map((s) => (
              <li key={s.id} className="flex items-center gap-2">
                <span className="text-ink-2">{s.name}</span>
                <span className="mono truncate">
                  {s.conditions || "no conditions"}
                </span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Delete saved screen ${s.name}`}
                  onClick={() =>
                    screensStore.set((prev) =>
                      prev.filter((x) => x.id !== s.id)
                    )
                  }
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Page>
  )
}
