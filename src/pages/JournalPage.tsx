import { useMemo, useState } from "react"
import { ArrowLeft, BellPlus, NotebookPen, Plus, Trash2, X } from "lucide-react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { AlertDialog } from "@/components/alerts/AlertDialog"
import { AssetIcon } from "@/components/data/AssetIcon"
import { Change } from "@/components/data/Change"
import { EmptyState } from "@/components/data/states"
import { Page, PageHeader, Pane } from "@/components/layout/Page"
import { AssetPicker } from "@/components/portfolio/AssetPicker"
import { Button } from "@/components/ui/button"
import {
  Badge,
  Field,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Segmented,
  Select,
  Textarea,
} from "@/components/ui/controls"
import { Input } from "@/components/ui/input"
import { useQuotes } from "@/hooks/queries"
import { usePortfolioValuation } from "@/hooks/use-portfolio-valuation"
import { useNow, usePageTitle } from "@/hooks/use-ui"
import { describeAlert } from "@/lib/alerts"
import {
  formatAge,
  formatDate,
  formatPrice,
  formatQuantity,
  todayISO,
} from "@/lib/format"
import { T } from "@/lib/table"
import { cn } from "@/lib/utils"
import {
  moveSince,
  thesesDueForReview,
  type Decision,
  type EntryKind,
  type JournalEntry,
  type Stance,
  type Thesis,
  type ThesisStatus,
} from "@/lib/workspace"
import {
  alertActions,
  journalActions,
  useAlerts,
  useJournal,
  useWatchlists,
} from "@/stores"

const STATUS_TONE: Record<ThesisStatus, "neutral" | "accent" | "up" | "down"> =
  { draft: "neutral", active: "accent", closed: "up", invalidated: "down" }
const STANCE_TONE: Record<Stance, "up" | "down" | "neutral"> = {
  bullish: "up",
  bearish: "down",
  neutral: "neutral",
}

function ListEditor({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string
  items: string[]
  onChange: (items: string[]) => void
  placeholder: string
}) {
  const [draft, setDraft] = useState("")
  const add = () => {
    const t = draft.trim()
    if (t) onChange([...items, t])
    setDraft("")
  }
  return (
    <div>
      <h3 className="eyebrow mb-1">{label}</h3>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li
            key={`${i}-${item}`}
            className="group flex items-start gap-2 text-[0.8125rem] text-ink-2"
          >
            <span
              className="mt-2 size-1 shrink-0 rounded-full bg-ink-3"
              aria-hidden="true"
            />
            <span className="flex-1">{item}</span>
            <button
              type="button"
              aria-label={`Remove “${item}”`}
              className="text-ink-3 opacity-0 group-hover:opacity-100 hover:text-ink focus:opacity-100"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
        className="mt-1.5 flex gap-1.5"
      >
        <Input
          aria-label={`Add to ${label.toLowerCase()}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          className="h-8"
        />
        <Button size="sm" type="submit" disabled={!draft.trim()}>
          Add
        </Button>
      </form>
    </div>
  )
}

function EntryForm({
  thesis,
  prices,
  symbols,
}: {
  thesis: Thesis
  prices: Map<string, number | null>
  /** Ticker per asset id, once quotes have loaded. */
  symbols: Map<string, string>
}) {
  const [kind, setKind] = useState<EntryKind>("observation")
  const [decision, setDecision] = useState<Decision>("buy")
  const [assetId, setAssetId] = useState(thesis.assetIds[0] ?? "")
  const [date, setDate] = useState(todayISO())
  const [text, setText] = useState("")
  const today = todayISO()
  const backdated = date !== today

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim() && kind !== "decision") return
    const at = backdated ? new Date(`${date}T12:00:00`).getTime() : Date.now()
    journalActions.addEntry(thesis.id, {
      kind,
      at,
      text: text.trim(),
      decision: kind === "decision" ? decision : null,
      assetId: assetId || null,
      // Only "now" entries capture a price: we never invent a past price.
      priceAtEntry:
        !backdated && assetId ? (prices.get(assetId) ?? null) : null,
      outcome: "",
    })
    setText("")
    toast(
      kind === "decision"
        ? "Decision recorded"
        : kind === "review"
          ? "Review recorded"
          : "Observation recorded"
    )
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-2 rounded-md border border-rule bg-surface-2/40 p-3"
    >
      <div className="flex flex-wrap items-end gap-2">
        <Segmented
          label="Entry type"
          size="sm"
          value={kind}
          onChange={setKind}
          options={[
            { value: "observation", label: "Observation" },
            { value: "decision", label: "Decision" },
            { value: "review", label: "Review" },
          ]}
        />
        {kind === "decision" && (
          <Select
            aria-label="Decision"
            value={decision}
            onChange={(e) => setDecision(e.target.value as Decision)}
            className="w-28"
          >
            {(
              [
                "buy",
                "add",
                "trim",
                "sell",
                "hold",
                "wait",
                "exit",
              ] as Decision[]
            ).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        )}
        {thesis.assetIds.length > 0 && (
          <Select
            aria-label="Asset"
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
            className="w-36"
          >
            <option value="">No asset</option>
            {thesis.assetIds.map((id) => (
              <option key={id} value={id}>
                {symbols.get(id) ?? id}
              </option>
            ))}
          </Select>
        )}
        <Input
          type="date"
          aria-label="Date"
          max={today}
          value={date}
          onChange={(e) => setDate(e.target.value || today)}
          className="h-8 w-40"
        />
      </div>
      <Textarea
        aria-label="Entry"
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          kind === "decision"
            ? "What did you decide, and why now?"
            : kind === "review"
              ? "How is the thesis holding up? What changed?"
              : "What did you notice?"
        }
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.6875rem] text-ink-3">
          {assetId && !backdated
            ? `Records ${symbols.get(assetId) ?? assetId}’s current price (${formatPrice(prices.get(assetId))}) so you can review the decision later.`
            : backdated
              ? "Backdated entries don’t record a price: CoinWave won’t guess what you saw then."
              : ""}
        </p>
        <Button
          size="sm"
          variant="primary"
          type="submit"
          disabled={!text.trim() && kind !== "decision"}
        >
          Add entry
        </Button>
      </div>
    </form>
  )
}

function Timeline({
  thesis,
  prices,
  symbols,
}: {
  thesis: Thesis
  prices: Map<string, number | null>
  symbols: Map<string, string>
}) {
  const now = useNow(60_000)
  if (thesis.entries.length === 0)
    return (
      <p className="text-[0.8125rem] text-ink-3">
        No entries yet. Record observations and decisions as they happen.
      </p>
    )
  return (
    <ol className="relative space-y-3 border-l border-rule pl-4">
      {[...thesis.entries].reverse().map((e: JournalEntry) => {
        const move = e.assetId
          ? moveSince(e.priceAtEntry, prices.get(e.assetId) ?? null)
          : null
        return (
          <li key={e.id} className="relative">
            <span
              className={cn(
                "absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-surface",
                e.kind === "decision"
                  ? "bg-accent"
                  : e.kind === "review"
                    ? "bg-warn"
                    : "bg-ink-3"
              )}
              aria-hidden="true"
            />
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge
                tone={
                  e.kind === "decision"
                    ? "accent"
                    : e.kind === "review"
                      ? "warn"
                      : "neutral"
                }
              >
                {e.kind === "decision" && e.decision ? `${e.decision}` : e.kind}
              </Badge>
              <time
                className="text-ink-3"
                dateTime={new Date(e.at).toISOString()}
              >
                {formatDate(e.at)} · {formatAge(e.at, now)}
              </time>
              {e.assetId && (
                <Link
                  to={`/markets/${e.assetId}`}
                  className="mono text-ink-2 hover:underline"
                >
                  {symbols.get(e.assetId) ?? e.assetId}
                </Link>
              )}
              {e.priceAtEntry !== null && (
                <span className="text-ink-3">
                  at{" "}
                  <span className="num text-ink-2">
                    {formatPrice(e.priceAtEntry)}
                  </span>
                  {move !== null && (
                    <>
                      {" "}
                      · now <Change value={move} /> since
                    </>
                  )}
                </span>
              )}
              <button
                type="button"
                aria-label="Delete entry"
                className="ml-auto text-ink-3 hover:text-ink"
                onClick={() => journalActions.removeEntry(thesis.id, e.id)}
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
              </button>
            </div>
            {e.text && (
              <p className="doc mt-1 text-[0.9375rem] leading-6 whitespace-pre-wrap text-ink">
                {e.text}
              </p>
            )}
            {e.kind === "decision" && (
              <label className="mt-1 block">
                <span className="sr-only">Outcome of this decision</span>
                <input
                  defaultValue={e.outcome}
                  onBlur={(ev) =>
                    ev.target.value !== e.outcome &&
                    journalActions.updateEntry(thesis.id, e.id, {
                      outcome: ev.target.value,
                    })
                  }
                  placeholder="Outcome / what you learned (fill in when you review)"
                  className="w-full rounded bg-transparent px-1 py-0.5 text-xs text-ink-2 outline-none placeholder:text-ink-3 focus:bg-surface-2"
                />
              </label>
            )}
          </li>
        )
      })}
    </ol>
  )
}

function ThesisEditor({ thesis }: { thesis: Thesis }) {
  const navigate = useNavigate()
  const { alerts } = useAlerts()
  const { lists } = useWatchlists()
  const { positions } = usePortfolioValuation()
  const [addingAsset, setAddingAsset] = useState(false)
  const [alertOpen, setAlertOpen] = useState(false)
  const { assets } = useQuotes(thesis.assetIds)
  const prices = useMemo(
    () =>
      new Map(thesis.assetIds.map((id) => [id, assets.get(id)?.price ?? null])),
    [thesis.assetIds, assets]
  )
  const symbols = useMemo(
    () =>
      new Map(
        thesis.assetIds.flatMap((id) => {
          const a = assets.get(id)
          return a ? [[id, a.symbol] as const] : []
        })
      ),
    [thesis.assetIds, assets]
  )
  const update = (patch: Partial<Thesis>) =>
    journalActions.update(thesis.id, patch)
  const linkedAlerts = alerts.filter(
    (a) => thesis.alertIds.includes(a.id) || a.thesisId === thesis.id
  )
  const held = positions.filter((p) => thesis.assetIds.includes(p.assetId))
  const decisions = thesis.entries.filter((e) => e.kind === "decision")

  const remove = () => {
    const removed = journalActions.remove(thesis.id)
    navigate("/journal")
    if (removed)
      toast("Thesis deleted", {
        action: {
          label: "Undo",
          onClick: () => journalActions.restore(removed),
        },
      })
  }

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-3">
        <Pane flush>
          <div className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <Button size="icon-sm" variant="ghost" asChild>
                <Link to="/journal" aria-label="All theses">
                  <ArrowLeft aria-hidden="true" />
                </Link>
              </Button>
              <label htmlFor="thesis-title" className="sr-only">
                Thesis title
              </label>
              <input
                id="thesis-title"
                defaultValue={thesis.title}
                onBlur={(e) =>
                  e.target.value !== thesis.title &&
                  update({ title: e.target.value })
                }
                placeholder="Name this thesis"
                className="doc min-w-0 flex-1 bg-transparent text-2xl font-semibold text-ink outline-none placeholder:text-ink-3"
              />
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Delete thesis"
                onClick={remove}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {thesis.assetIds.map((id) => {
                const a = assets.get(id)
                return (
                  <span
                    key={id}
                    className="inline-flex h-7 items-center gap-1.5 rounded-full border border-rule-strong pr-1 pl-2 text-[0.8125rem]"
                  >
                    <AssetIcon
                      src={a?.image}
                      symbol={a?.symbol ?? "?"}
                      size={16}
                    />
                    <Link
                      to={`/markets/${id}`}
                      className="text-ink hover:underline"
                    >
                      {a?.name ?? id}
                    </Link>
                    <span className="num text-xs text-ink-3">
                      {formatPrice(a?.price)}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${a?.name ?? id}`}
                      className="inline-flex size-5 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2"
                      onClick={() =>
                        update({
                          assetIds: thesis.assetIds.filter((x) => x !== id),
                        })
                      }
                    >
                      <X className="size-3" aria-hidden="true" />
                    </button>
                  </span>
                )
              })}
              <Popover open={addingAsset} onOpenChange={setAddingAsset}>
                <PopoverTrigger asChild>
                  <Button size="sm">
                    <Plus aria-hidden="true" /> Asset
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-80 p-2">
                  <AssetPicker
                    inputId="thesis-asset"
                    value={null}
                    suggestedIds={[]}
                    onChange={(a) => {
                      if (a) {
                        update({
                          assetIds: [...new Set([...thesis.assetIds, a.id])],
                        })
                        setAddingAsset(false)
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Stance" htmlFor="thesis-stance">
                <Select
                  id="thesis-stance"
                  value={thesis.stance}
                  onChange={(e) => update({ stance: e.target.value as Stance })}
                  className="w-full"
                >
                  <option value="bullish">Bullish</option>
                  <option value="bearish">Bearish</option>
                  <option value="neutral">Neutral / watching</option>
                </Select>
              </Field>
              <Field label="Status" htmlFor="thesis-status">
                <Select
                  id="thesis-status"
                  value={thesis.status}
                  onChange={(e) =>
                    update({ status: e.target.value as ThesisStatus })
                  }
                  className="w-full"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="closed">Closed</option>
                  <option value="invalidated">Invalidated</option>
                </Select>
              </Field>
              <Field
                label="Review by"
                htmlFor="thesis-review"
                hint="Shows on the Command Center when due"
              >
                <Input
                  id="thesis-review"
                  type="date"
                  value={thesis.reviewBy ?? ""}
                  onChange={(e) => update({ reviewBy: e.target.value || null })}
                  className="h-8"
                />
              </Field>
            </div>
            <div>
              <label htmlFor="thesis-summary" className="eyebrow mb-1 block">
                Thesis
              </label>
              <Textarea
                id="thesis-summary"
                rows={4}
                defaultValue={thesis.summary}
                onBlur={(e) =>
                  e.target.value !== thesis.summary &&
                  update({ summary: e.target.value })
                }
                placeholder="State the idea in a few sentences: what you believe, why, and over what time frame."
                className="doc text-[0.9375rem] leading-7"
              />
            </div>
          </div>
        </Pane>

        <Pane title="Structure">
          <div className="grid gap-4 md:grid-cols-2">
            <ListEditor
              label="Assumptions"
              items={thesis.assumptions}
              onChange={(v) => update({ assumptions: v })}
              placeholder="Something that must be true"
            />
            <ListEditor
              label="Catalysts"
              items={thesis.catalysts}
              onChange={(v) => update({ catalysts: v })}
              placeholder="An event that could move it"
            />
            <ListEditor
              label="Risks"
              items={thesis.risks}
              onChange={(v) => update({ risks: v })}
              placeholder="What could go wrong"
            />
            <ListEditor
              label="Invalidation"
              items={thesis.invalidation}
              onChange={(v) => update({ invalidation: v })}
              placeholder="What would prove you wrong"
            />
          </div>
          <div className="mt-4">
            <label htmlFor="thesis-monitoring" className="eyebrow mb-1 block">
              Monitoring criteria
            </label>
            <Textarea
              id="thesis-monitoring"
              rows={2}
              defaultValue={thesis.monitoring}
              onBlur={(e) =>
                e.target.value !== thesis.monitoring &&
                update({ monitoring: e.target.value })
              }
              placeholder="Levels, metrics or events you'll watch. Turn price levels into alerts on the right."
            />
          </div>
        </Pane>

        <Pane
          title="Journal"
          subtitle="Observations, dated decisions and reviews"
        >
          <EntryForm thesis={thesis} prices={prices} symbols={symbols} />
          <div className="mt-4">
            <Timeline thesis={thesis} prices={prices} symbols={symbols} />
          </div>
        </Pane>

        {(thesis.status === "closed" || thesis.status === "invalidated") && (
          <Pane title="Lessons">
            <Textarea
              rows={4}
              aria-label="Lessons"
              defaultValue={thesis.lessons}
              onBlur={(e) =>
                e.target.value !== thesis.lessons &&
                update({ lessons: e.target.value })
              }
              placeholder="What did this thesis teach you? What would you do differently?"
              className="doc text-[0.9375rem] leading-7"
            />
          </Pane>
        )}
      </div>

      <aside className="space-y-3" aria-label="Thesis context">
        <Pane
          title="Decision review"
          subtitle="Price when recorded versus now"
          flush
        >
          {decisions.length === 0 ? (
            <p className="p-3 text-[0.8125rem] text-ink-3">
              Record a decision to review it later.
            </p>
          ) : (
            <table className={T.table}>
              <caption className="sr-only">
                Decisions and price moves since
              </caption>
              <thead>
                <tr>
                  <th scope="col" className={cn(T.th, "text-left")}>
                    Decision
                  </th>
                  <th scope="col" className={cn(T.th, "text-right")}>
                    Then
                  </th>
                  <th scope="col" className={cn(T.th, "text-right")}>
                    Since
                  </th>
                </tr>
              </thead>
              <tbody>
                {decisions.map((d) => (
                  <tr key={d.id} className={T.tr}>
                    <td className={T.td}>
                      <span className="font-medium text-ink capitalize">
                        {d.decision}
                      </span>{" "}
                      <span className="mono text-xs text-ink-3">
                        {d.assetId ? (symbols.get(d.assetId) ?? d.assetId) : ""}
                      </span>
                      <span className="block text-[0.6875rem] text-ink-3">
                        {formatDate(d.at)}
                      </span>
                    </td>
                    <td className={cn(T.td, "num text-right text-ink-2")}>
                      {formatPrice(d.priceAtEntry)}
                    </td>
                    <td className={cn(T.td, "text-right")}>
                      <Change
                        value={
                          d.assetId
                            ? moveSince(
                                d.priceAtEntry,
                                prices.get(d.assetId) ?? null
                              )
                            : null
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="border-t border-rule px-3 py-2 text-[0.6875rem] text-ink-3">
            Price moves say nothing about whether a decision was good; the
            outcome notes on each decision are where you judge that.
          </p>
        </Pane>

        <Pane
          title="Alerts"
          actions={
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setAlertOpen(true)}
            >
              <BellPlus aria-hidden="true" /> New
            </Button>
          }
        >
          {linkedAlerts.length === 0 ? (
            <p className="text-[0.8125rem] text-ink-3">
              Turn invalidation levels or targets into alerts linked to this
              thesis.
            </p>
          ) : (
            <ul className="space-y-1.5 text-[0.8125rem]">
              {linkedAlerts.map((a) => (
                <li
                  key={a.id}
                  className="flex items-start justify-between gap-2"
                >
                  <span className="text-ink-2">{describeAlert(a)}</span>
                  <span className="flex items-center gap-1">
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
        </Pane>

        <Pane title="Position">
          {held.length === 0 ? (
            <p className="text-[0.8125rem] text-ink-3">
              You don’t hold{" "}
              {thesis.assetIds.length
                ? "these assets"
                : "anything linked to this thesis"}
              .
            </p>
          ) : (
            <ul className="space-y-1 text-[0.8125rem]">
              {held.map((p) => (
                <li key={p.assetId} className="flex justify-between gap-2">
                  <span className="text-ink">{p.name}</span>
                  <span className="num text-ink-2">
                    {formatQuantity(p.quantity)} ·{" "}
                    <Change value={p.unrealizedPct} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Pane>

        <Pane title="Watchlist">
          <Select
            aria-label="Linked watchlist"
            value={thesis.watchlistId ?? ""}
            onChange={(e) => update({ watchlistId: e.target.value || null })}
            className="w-full"
          >
            <option value="">None</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
          {thesis.watchlistId && (
            <Link
              to={`/watchlists?list=${thesis.watchlistId}`}
              className="mt-2 inline-block text-xs font-medium text-accent hover:underline"
            >
              Open watchlist
            </Link>
          )}
        </Pane>
      </aside>

      <AlertDialog
        open={alertOpen}
        onOpenChange={setAlertOpen}
        draft={{
          thesisId: thesis.id,
          asset:
            thesis.assetIds[0] && assets.get(thesis.assetIds[0])
              ? {
                  id: thesis.assetIds[0],
                  name: assets.get(thesis.assetIds[0])!.name,
                  symbol: assets.get(thesis.assetIds[0])!.symbol,
                  image: assets.get(thesis.assetIds[0])!.image,
                }
              : null,
          threshold: prices.get(thesis.assetIds[0]) ?? undefined,
        }}
      />
    </div>
  )
}

export default function JournalPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { theses } = useJournal()
  const [status, setStatus] = useState<"open" | "all" | ThesisStatus>("open")
  const thesis = id ? theses.find((t) => t.id === id) : null
  usePageTitle(thesis ? thesis.title || "Thesis" : "Journal")
  const now = useNow(60_000)
  const due = new Set(thesesDueForReview(theses, todayISO()).map((t) => t.id))

  if (id) {
    return (
      <Page>
        {thesis ? (
          <>
            <h1 className="sr-only">{thesis.title || "Untitled thesis"}</h1>
            <ThesisEditor key={thesis.id} thesis={thesis} />
          </>
        ) : (
          <EmptyState
            title="Thesis not found"
            action={
              <Button size="sm" asChild>
                <Link to="/journal">All theses</Link>
              </Button>
            }
          >
            It may have been deleted.
          </EmptyState>
        )}
      </Page>
    )
  }

  const shown = theses
    .filter((t) =>
      status === "all"
        ? true
        : status === "open"
          ? t.status === "draft" || t.status === "active"
          : t.status === status
    )
    .sort(
      (a, b) =>
        Number(due.has(b.id)) - Number(due.has(a.id)) ||
        b.updatedAt - a.updatedAt
    )

  return (
    <Page>
      <PageHeader
        title="Journal"
        description="Write down why you’re interested in an asset, what would prove you wrong, and every decision you make. Review it later against what happened."
        actions={
          <Button
            size="sm"
            variant="primary"
            onClick={() => navigate(`/journal/${journalActions.create().id}`)}
          >
            <NotebookPen aria-hidden="true" /> New thesis
          </Button>
        }
      />
      {theses.length === 0 ? (
        <EmptyState
          title="No theses yet"
          action={
            <Button
              size="sm"
              variant="primary"
              onClick={() => navigate(`/journal/${journalActions.create().id}`)}
            >
              Write your first thesis
            </Button>
          }
        >
          A thesis records your reasoning before you act: assumptions,
          catalysts, risks and invalidation conditions. Decisions you log
          capture the price at the time, so you can honestly review them later.
          CoinWave never suggests what to buy or sell.
        </EmptyState>
      ) : (
        <>
          <Segmented
            label="Show"
            size="sm"
            value={status}
            onChange={setStatus}
            className="mb-3"
            options={[
              { value: "open", label: "Open" },
              { value: "active", label: "Active" },
              { value: "draft", label: "Draft" },
              { value: "closed", label: "Closed" },
              { value: "invalidated", label: "Invalidated" },
              { value: "all", label: "All" },
            ]}
          />
          <div className="overflow-hidden rounded-md border border-rule bg-surface">
            <table className={T.table}>
              <caption className="sr-only">Theses</caption>
              <thead>
                <tr>
                  <th scope="col" className={cn(T.th, "text-left")}>
                    Thesis
                  </th>
                  <th scope="col" className={cn(T.th, "text-left")}>
                    Stance
                  </th>
                  <th scope="col" className={cn(T.th, "text-left")}>
                    Status
                  </th>
                  <th
                    scope="col"
                    className={cn(T.th, "hidden text-right sm:table-cell")}
                  >
                    Entries
                  </th>
                  <th
                    scope="col"
                    className={cn(T.th, "hidden text-right md:table-cell")}
                  >
                    Review by
                  </th>
                  <th scope="col" className={cn(T.th, "text-right")}>
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-4 text-[0.8125rem] text-ink-3"
                    >
                      No theses with this status.
                    </td>
                  </tr>
                )}
                {shown.map((t) => (
                  <tr key={t.id} className={T.trHover}>
                    <td className={cn(T.td, "w-1/2 max-w-0")}>
                      <Link
                        to={`/journal/${t.id}`}
                        className="block truncate font-medium text-ink hover:underline"
                      >
                        {t.title || "Untitled thesis"}
                      </Link>
                      <span className="mono block truncate text-[0.6875rem] text-ink-3">
                        {t.assetIds.join(", ") || "No assets"}
                      </span>
                    </td>
                    <td className={T.td}>
                      <Badge tone={STANCE_TONE[t.stance]}>{t.stance}</Badge>
                    </td>
                    <td className={T.td}>
                      <Badge tone={STATUS_TONE[t.status]}>{t.status}</Badge>
                      {due.has(t.id) && (
                        <Badge tone="warn" className="ml-1">
                          review due
                        </Badge>
                      )}
                    </td>
                    <td
                      className={cn(
                        T.td,
                        "num hidden text-right text-ink-2 sm:table-cell"
                      )}
                    >
                      {t.entries.length}
                    </td>
                    <td
                      className={cn(
                        T.td,
                        "num hidden text-right text-ink-2 md:table-cell"
                      )}
                    >
                      {formatDate(t.reviewBy)}
                    </td>
                    <td className={cn(T.td, "text-right text-xs text-ink-3")}>
                      {formatAge(t.updatedAt, now)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Page>
  )
}
