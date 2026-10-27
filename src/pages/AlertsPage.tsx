import { useEffect, useMemo, useState } from "react"
import { BellPlus, Pause, Pencil, Play, RotateCcw, Trash2 } from "lucide-react"
import { Link, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { AlertDialog, type AlertDraft } from "@/components/alerts/AlertDialog"
import { NotificationsControl } from "@/components/alerts/NotificationsControl"
import { EmptyState } from "@/components/data/states"
import { Page, PageHeader, Pane } from "@/components/layout/Page"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/controls"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAsset, useQuotes } from "@/hooks/queries"
import { usePortfolioValuation } from "@/hooks/use-portfolio-valuation"
import { useNow, usePageTitle } from "@/hooks/use-ui"
import {
  alertDistance,
  describeAlert,
  formatDistance,
  formatObserved,
  isAssetAlert,
  observedValue,
  type Alert,
} from "@/lib/alerts"
import { formatAge, formatDate } from "@/lib/format"
import { T } from "@/lib/table"
import { cn } from "@/lib/utils"
import { alertActions, alertsStore, useAlerts, useJournal } from "@/stores"

function useObserved(alerts: Alert[]) {
  const ids = useMemo(
    () => [...new Set(alerts.filter((a) => a.assetId).map((a) => a.assetId!))],
    [alerts]
  )
  const { assets } = useQuotes(ids)
  const portfolio = usePortfolioValuation()
  return (a: Alert) =>
    observedValue(a, {
      asset: a.assetId ? (assets.get(a.assetId) ?? null) : null,
      portfolioValue: isAssetAlert(a.kind) ? null : portfolio.summary.value,
    })
}

function AlertTable({
  alerts,
  onEdit,
  empty,
}: {
  alerts: Alert[]
  onEdit: (a: Alert) => void
  empty: string
}) {
  const now = useNow(30_000)
  const observe = useObserved(alerts)
  const { theses } = useJournal()
  if (alerts.length === 0)
    return <p className="p-3 text-[0.8125rem] text-ink-3">{empty}</p>
  return (
    <div className="overflow-x-auto">
      <table className={T.table}>
        <caption className="sr-only">Alerts</caption>
        <thead className={T.thead}>
          <tr>
            <th scope="col" className={cn(T.th, "text-left")}>
              Condition
            </th>
            <th scope="col" className={cn(T.th, "text-right")}>
              Now
            </th>
            <th
              scope="col"
              className={cn(T.th, "hidden text-right sm:table-cell")}
              title="How far the current value is from the threshold"
            >
              Distance
            </th>
            <th scope="col" className={cn(T.th, "text-left")}>
              Status
            </th>
            <th
              scope="col"
              className={cn(T.th, "hidden text-left md:table-cell")}
            >
              Linked
            </th>
            <th scope="col" className={cn(T.th, "w-28")}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((a) => {
            const v = observe(a)
            const distance = alertDistance(a, v)
            const thesis = theses.find((t) => t.id === a.thesisId)
            return (
              <tr key={a.id} className={T.tr}>
                <td className={cn(T.td, "w-[45%] max-w-0 whitespace-normal")}>
                  {a.assetId ? (
                    <Link
                      to={`/markets/${a.assetId}`}
                      className="text-ink hover:underline"
                    >
                      {describeAlert(a)}
                    </Link>
                  ) : (
                    <span className="text-ink">{describeAlert(a)}</span>
                  )}
                  {a.note && (
                    <span className="block text-xs text-ink-3">{a.note}</span>
                  )}
                  <span className="block text-[0.6875rem] text-ink-3">
                    Created {formatDate(a.createdAt)}
                  </span>
                </td>
                <td className={cn(T.td, "num text-right text-ink")}>
                  {v === null ? "—" : formatObserved(a.kind, v)}
                </td>
                <td
                  className={cn(
                    T.td,
                    "num hidden text-right text-ink-2 sm:table-cell"
                  )}
                >
                  {formatDistance(distance)}
                </td>
                <td className={T.td}>
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
                  {a.triggeredAt && (
                    <span className="block text-[0.6875rem] text-ink-3">
                      {formatAge(a.triggeredAt, now)}
                      {a.triggeredValue !== null
                        ? ` at ${formatObserved(a.kind, a.triggeredValue)}`
                        : ""}
                    </span>
                  )}
                </td>
                <td className={cn(T.td, "hidden md:table-cell")}>
                  {thesis ? (
                    <Link
                      to={`/journal/${thesis.id}`}
                      className="text-xs text-accent hover:underline"
                    >
                      {thesis.title || "Thesis"}
                    </Link>
                  ) : (
                    <span className="text-xs text-ink-3">—</span>
                  )}
                </td>
                <td className={cn(T.td, "text-right whitespace-nowrap")}>
                  {a.status === "active" ? (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Pause alert"
                      onClick={() =>
                        alertActions.update(a.id, { status: "disabled" })
                      }
                    >
                      <Pause aria-hidden="true" />
                    </Button>
                  ) : a.status === "disabled" ? (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Resume alert"
                      onClick={() => alertActions.rearm(a.id)}
                    >
                      <Play aria-hidden="true" />
                    </Button>
                  ) : (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Re-arm alert"
                      onClick={() => alertActions.rearm(a.id)}
                    >
                      <RotateCcw aria-hidden="true" />
                    </Button>
                  )}
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Edit alert"
                    onClick={() => onEdit(a)}
                  >
                    <Pencil aria-hidden="true" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Delete alert"
                    onClick={() => {
                      const before = alertsStore.get()
                      alertActions.remove(a.id)
                      toast("Alert deleted", {
                        action: {
                          label: "Undo",
                          onClick: () => alertActions.replace(before),
                        },
                      })
                    }}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function PresetAsset({
  id,
  onReady,
}: {
  id: string
  onReady: (draft: AlertDraft) => void
}) {
  const { asset, notFound } = useAsset(id)
  useEffect(() => {
    if (asset)
      onReady({
        asset: {
          id: asset.id,
          name: asset.name,
          symbol: asset.symbol,
          image: asset.image,
        },
        threshold: asset.price ?? undefined,
      })
    else if (notFound) onReady({})
  }, [asset, notFound, onReady])
  return null
}

export default function AlertsPage() {
  usePageTitle("Alerts")
  const [params, setParams] = useSearchParams()
  const { alerts, events } = useAlerts()
  const now = useNow(30_000)
  const [dialog, setDialog] = useState<{
    open: boolean
    draft: AlertDraft
    editing: Alert | null
  }>({ open: false, draft: {}, editing: null })
  const newParam = params.get("new")

  const active = alerts.filter((a) => a.status === "active")
  const triggered = alerts.filter((a) => a.status === "triggered")
  const other = alerts.filter(
    (a) => a.status === "disabled" || a.status === "dismissed"
  )

  const openNew = (draft: AlertDraft = {}) =>
    setDialog({ open: true, draft, editing: null })

  return (
    <Page>
      <PageHeader
        title="Alerts"
        description="Conditions on prices, % moves, volume and your portfolio’s value."
        actions={
          <Button size="sm" variant="primary" onClick={() => openNew()}>
            <BellPlus aria-hidden="true" /> New alert
          </Button>
        }
      />

      <div className="mb-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Pane title="How alerts work">
          <ul className="list-disc space-y-1 pl-4 text-[0.8125rem] text-ink-2">
            <li>
              Alerts are checked in your browser each time fresh data arrives,
              so{" "}
              <strong className="text-ink">
                only while CoinWave is open in a tab
              </strong>
              . Nothing runs when the tab is closed, and no email or push is
              sent.
            </li>
            <li>
              An alert triggers once, then waits for you. Re-arm it to watch
              again; only newer data can trigger it.
            </li>
            <li>
              Prices come from free public APIs refreshed every 1–10 minutes
              (see Settings), so very brief moves can be missed.
            </li>
          </ul>
        </Pane>
        <Pane title="Delivery">
          <NotificationsControl />
          <p className="mt-2 text-xs text-ink-3">
            Triggered alerts always appear as a message in CoinWave and on the
            bell in the top bar.
          </p>
        </Pane>
      </div>

      {alerts.length === 0 ? (
        <EmptyState
          title="No alerts yet"
          action={
            <Button size="sm" variant="primary" onClick={() => openNew()}>
              Create an alert
            </Button>
          }
        >
          Watch for a price level, a % move over 1 hour, 24 hours or 7 days, a
          jump in 24h volume, or your portfolio crossing a value. You can also
          create alerts from asset pages, Chart Studio (click the chart),
          watchlists and theses.
        </EmptyState>
      ) : (
        <Tabs
          defaultValue={triggered.length ? "triggered" : "active"}
          className="rounded-md border border-rule bg-surface"
        >
          <TabsList aria-label="Alerts by status">
            <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
            <TabsTrigger value="triggered">
              Triggered ({triggered.length})
            </TabsTrigger>
            <TabsTrigger value="other">
              Paused &amp; seen ({other.length})
            </TabsTrigger>
            <TabsTrigger value="history">History ({events.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="active">
            <AlertTable
              alerts={active}
              empty="No active alerts."
              onEdit={(a) => setDialog({ open: true, draft: {}, editing: a })}
            />
          </TabsContent>
          <TabsContent value="triggered">
            {triggered.length > 0 && (
              <div className="flex justify-end border-b border-rule px-3 py-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => alertActions.dismissAll()}
                >
                  Mark all as seen
                </Button>
              </div>
            )}
            <AlertTable
              alerts={triggered}
              empty="Nothing has triggered."
              onEdit={(a) => setDialog({ open: true, draft: {}, editing: a })}
            />
          </TabsContent>
          <TabsContent value="other">
            <AlertTable
              alerts={other}
              empty="No paused or seen alerts."
              onEdit={(a) => setDialog({ open: true, draft: {}, editing: a })}
            />
          </TabsContent>
          <TabsContent value="history">
            {events.length === 0 ? (
              <p className="p-3 text-[0.8125rem] text-ink-3">
                No alert has triggered yet.
              </p>
            ) : (
              <>
                <ol className="divide-y divide-rule">
                  {events.map((e) => (
                    <li
                      key={e.id}
                      className="flex items-start gap-3 px-3 py-2 text-[0.8125rem]"
                    >
                      <time
                        className="num w-28 shrink-0 text-xs text-ink-3"
                        dateTime={new Date(e.at).toISOString()}
                      >
                        {formatDate(e.at)}{" "}
                        {new Date(e.at).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </time>
                      <span className="text-ink-2">{e.message}</span>
                      <span className="ml-auto shrink-0 text-xs text-ink-3">
                        {formatAge(e.at, now)}
                      </span>
                    </li>
                  ))}
                </ol>
                <div className="border-t border-rule px-3 py-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => alertActions.clearHistory()}
                  >
                    Clear history
                  </Button>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      )}

      {newParam && newParam !== "1" && !dialog.open && (
        <PresetAsset
          id={newParam}
          onReady={(draft) => {
            openNew(draft)
            setParams({}, { replace: true })
          }}
        />
      )}
      {newParam === "1" && !dialog.open && (
        <OpenOnce
          onOpen={() => {
            openNew()
            setParams({}, { replace: true })
          }}
        />
      )}
      <AlertDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        draft={dialog.draft}
        editing={dialog.editing}
      />
    </Page>
  )
}

function OpenOnce({ onOpen }: { onOpen: () => void }) {
  useEffect(() => {
    onOpen()
  }, [onOpen])
  return null
}
