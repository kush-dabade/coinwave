import { useMemo, useRef, useState } from "react"
import { Download, FileJson, Trash2, Upload } from "lucide-react"
import { Link } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { NotificationsControl } from "@/components/alerts/NotificationsControl"
import { Page, PageHeader, Pane } from "@/components/layout/Page"
import { ImportDialog } from "@/components/portfolio/ImportDialog"
import { useTheme, type Theme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import {
  Badge,
  Field,
  Kbd,
  Segmented,
  Select,
  Switch,
} from "@/components/ui/controls"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SNAPSHOT_PREFIX } from "@/hooks/queries"
import { usePortfolio } from "@/hooks/use-portfolio"
import { usePageTitle } from "@/hooks/use-ui"
import {
  createBackup,
  describeSection,
  MAX_BACKUP_BYTES,
  mergeSection,
  parseBackup,
  SECTIONS,
  type BackupData,
  type ParsedBackup,
  type SectionId,
} from "@/lib/backup"
import { downloadFile } from "@/lib/download"
import { formatDate } from "@/lib/format"
import { transactionsToCSV } from "@/lib/portfolio"
import { removeKey, useStore } from "@/lib/storage"
import { T } from "@/lib/table"
import { cn } from "@/lib/utils"
import {
  DEFAULT_INDICATORS,
  DEFAULT_SETTINGS,
  MARKET_COLUMN_LABELS,
  MARKET_COLUMNS,
  type ChartInterval,
  type ChartType,
  type RefreshInterval,
} from "@/lib/workspace"
import {
  alertsStore,
  journalStore,
  layoutsStore,
  recentStore,
  researchStore,
  screensStore,
  settingsStore,
  updateSettings,
  watchlistsStore,
} from "@/stores"
import { emptySection, storageUsage, writeSection } from "@/stores/backup"

const NAV = [
  { id: "appearance", label: "Appearance" },
  { id: "data", label: "Data refresh" },
  { id: "markets", label: "Markets" },
  { id: "charts", label: "Charts" },
  { id: "workspace", label: "Command Center" },
  { id: "alerts", label: "Alerts" },
  { id: "storage", label: "Your data" },
]

const REFRESH: { value: string; label: string }[] = [
  { value: "60", label: "1 min" },
  { value: "120", label: "2 min" },
  { value: "300", label: "5 min" },
  { value: "600", label: "10 min" },
  { value: "0", label: "Off" },
]

const MIN_CAPS = [
  { value: 0, label: "Any size" },
  { value: 10_000_000, label: "$10M+" },
  { value: 100_000_000, label: "$100M+" },
  { value: 1_000_000_000, label: "$1B+" },
]

const CHART_INTERVALS: { value: ChartInterval; label: string }[] = [
  { value: "15m", label: "15 minutes" },
  { value: "1h", label: "1 hour" },
  { value: "4h", label: "4 hours" },
  { value: "1d", label: "1 day" },
  { value: "1w", label: "1 week" },
]

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

const stamp = () => new Date().toISOString().slice(0, 10)

/** Everything the user owns, read live so the page re-renders on change. */
function useWorkspace(): BackupData {
  const settings = useStore(settingsStore)
  const { version, transactions, sample } = usePortfolio()
  const watchlists = useStore(watchlistsStore)
  const alerts = useStore(alertsStore)
  const research = useStore(researchStore)
  const journal = useStore(journalStore)
  const screens = useStore(screensStore)
  const layouts = useStore(layoutsStore)
  return useMemo(
    () => ({
      settings,
      portfolio: { version, transactions, sample },
      watchlists,
      alerts,
      research,
      journal,
      screens,
      layouts,
    }),
    [
      settings,
      version,
      transactions,
      sample,
      watchlists,
      alerts,
      research,
      journal,
      screens,
      layouts,
    ]
  )
}

const isEmpty = (id: SectionId, data: BackupData) => {
  switch (id) {
    case "portfolio":
      return data.portfolio.transactions.length === 0
    case "watchlists":
      return (
        data.watchlists.lists.every((l) => l.items.length === 0) &&
        data.watchlists.lists.length <= 1
      )
    case "alerts":
      return data.alerts.alerts.length === 0 && data.alerts.events.length === 0
    case "research":
      return (
        data.research.notes.length === 0 &&
        data.research.collections.length === 0
      )
    case "journal":
      return data.journal.theses.length === 0
    case "screens":
    case "layouts":
      return data[id].length === 0
    case "settings":
      return JSON.stringify(data.settings) === JSON.stringify(DEFAULT_SETTINGS)
  }
}

export default function SettingsPage() {
  usePageTitle("Settings")
  const settings = useStore(settingsStore)
  const { theme, setTheme } = useTheme()

  return (
    <Page>
      <PageHeader
        title="Settings"
        description="Preferences and data for this browser. CoinWave has no account: everything here is stored locally."
      />
      <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="hidden lg:block">
          <ul className="sticky top-20 space-y-0.5 text-[0.8125rem]">
            {NAV.map((n) => (
              <li key={n.id}>
                <a
                  href={`#${n.id}-title`}
                  className="block rounded px-2 py-1 text-ink-2 hover:bg-surface-2 hover:text-ink"
                >
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="max-w-4xl min-w-0 space-y-3">
          <Pane id="appearance" title="Appearance">
            <Field
              label="Theme"
              hint="System follows your device’s light or dark setting."
            >
              <Segmented<Theme>
                label="Theme"
                value={theme}
                onChange={setTheme}
                options={[
                  { value: "dark", label: "Dark" },
                  { value: "light", label: "Light" },
                  { value: "system", label: "System" },
                ]}
              />
            </Field>
          </Pane>

          <Pane id="data" title="Data refresh">
            <Field
              label="Refresh market data every"
              hint="CoinGecko’s free API allows only a few requests a minute, so faster refresh makes rate limiting more likely. “Off” refreshes only when you ask."
            >
              <Segmented
                label="Refresh interval"
                value={String(settings.refreshInterval)}
                onChange={(v) =>
                  updateSettings({
                    refreshInterval: Number(v) as RefreshInterval,
                  })
                }
                options={REFRESH}
              />
            </Field>
            <p className="mt-3 text-xs text-ink-3">
              Source health, latency and recent requests are on{" "}
              <Link
                to="/status"
                className="text-accent underline underline-offset-2"
              >
                Data status
              </Link>
              .
            </p>
          </Pane>

          <Pane id="markets" title="Markets">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Rows per page">
                <Segmented
                  label="Rows per page"
                  value={String(settings.marketPageSize)}
                  onChange={(v) =>
                    updateSettings({ marketPageSize: v === "50" ? 50 : 100 })
                  }
                  options={[
                    { value: "50", label: "50" },
                    { value: "100", label: "100" },
                  ]}
                />
              </Field>
              <Field
                label="Biggest movers: minimum market cap"
                htmlFor="movers-cap"
                hint="Filters out thinly traded coins whose swings are mostly noise."
              >
                <Select
                  id="movers-cap"
                  value={String(settings.moversMinCap)}
                  onChange={(e) =>
                    updateSettings({ moversMinCap: Number(e.target.value) })
                  }
                  className="w-40"
                >
                  {MIN_CAPS.some(
                    (c) => c.value === settings.moversMinCap
                  ) ? null : (
                    <option value={settings.moversMinCap}>Custom</option>
                  )}
                  {MIN_CAPS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="mt-4">
              <Switch
                label="Hide stablecoins"
                description="Leaves USD-pegged coins out of the Markets table by default. You can still find them in search."
                checked={settings.hideStablecoins}
                onChange={(hideStablecoins) =>
                  updateSettings({ hideStablecoins })
                }
              />
            </div>
            <fieldset className="mt-4">
              <legend className="mb-1.5 text-xs font-medium text-ink-2">
                Table columns (on screens wide enough to show them)
              </legend>
              <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {MARKET_COLUMNS.map((c) => (
                  <label
                    key={c}
                    className="flex items-center gap-2 text-[0.8125rem]"
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--accent)]"
                      checked={settings.marketColumns.includes(c)}
                      disabled={c === "price"}
                      onChange={(e) =>
                        updateSettings({
                          marketColumns: e.target.checked
                            ? MARKET_COLUMNS.filter(
                                (x) =>
                                  x === c || settings.marketColumns.includes(x)
                              )
                            : settings.marketColumns.filter((x) => x !== c),
                        })
                      }
                    />
                    {MARKET_COLUMN_LABELS[c]}
                  </label>
                ))}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="mt-2 -ml-2"
                onClick={() =>
                  updateSettings({
                    marketColumns: DEFAULT_SETTINGS.marketColumns,
                  })
                }
              >
                Restore default columns
              </Button>
            </fieldset>
          </Pane>

          <Pane
            id="charts"
            title="Charts"
            subtitle="Defaults for Chart Studio. A chart link with its own interval or type overrides them."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Default interval" htmlFor="chart-interval">
                <Select
                  id="chart-interval"
                  className="w-40"
                  value={settings.chartDefaults.interval}
                  onChange={(e) =>
                    updateSettings({
                      chartDefaults: {
                        ...settings.chartDefaults,
                        interval: e.target.value as ChartInterval,
                      },
                    })
                  }
                >
                  {CHART_INTERVALS.map((i) => (
                    <option key={i.value} value={i.value}>
                      {i.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Default chart type">
                <Segmented<ChartType>
                  label="Default chart type"
                  value={settings.chartDefaults.type}
                  onChange={(type) =>
                    updateSettings({
                      chartDefaults: { ...settings.chartDefaults, type },
                    })
                  }
                  options={[
                    { value: "candles", label: "Candles" },
                    { value: "line", label: "Line" },
                    { value: "area", label: "Area" },
                  ]}
                />
              </Field>
            </div>
            <p className="mt-3 text-xs text-ink-3">
              Indicators are set in Chart Studio and remembered there.{" "}
              <button
                type="button"
                className="font-medium text-accent hover:underline"
                onClick={() => {
                  updateSettings({
                    chartDefaults: {
                      ...settings.chartDefaults,
                      indicators: DEFAULT_INDICATORS,
                    },
                  })
                  toast("Indicators reset to SMA 20/50, volume and RSI 14")
                }}
              >
                Reset indicators
              </button>
            </p>
          </Pane>

          <Pane id="workspace" title="Command Center">
            <p className="text-[0.8125rem] text-ink-2">
              {settings.widgets.filter((w) => w.visible).length} of{" "}
              {settings.widgets.length} widgets shown.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" asChild>
                <Link to="/?customize=1">Customize widgets</Link>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  updateSettings({ widgets: DEFAULT_SETTINGS.widgets })
                }
              >
                Restore default layout
              </Button>
            </div>
            <p className="mt-3 text-xs text-ink-3">
              Keyboard: press <Kbd>/</Kbd> or <Kbd>Ctrl</Kbd> <Kbd>K</Kbd> to
              search, <Kbd>G</Kbd> then a letter to jump to a page, <Kbd>?</Kbd>{" "}
              for the full list. Shortcuts are ignored while you type in a
              field.
            </p>
          </Pane>

          <Pane id="alerts" title="Alerts">
            <NotificationsControl />
            <p className="mt-3 text-xs text-ink-3">
              Alerts are checked in this browser against data CoinWave fetches
              while it’s open. Nothing runs on a server, so a closed tab can’t
              alert you.
            </p>
          </Pane>

          <DataSection />
        </div>
      </div>
    </Page>
  )
}

// ---------------------------------------------------------------------------
// Your data: storage, backup, import and deletion

function DataSection() {
  const data = useWorkspace()
  const queryClient = useQueryClient()
  const usage = storageUsage()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<{
    name: string
    backup: ParsedBackup
  } | null>(null)
  const [confirm, setConfirm] = useState<SectionId | "all" | null>(null)
  const [csvOpen, setCsvOpen] = useState(false)
  const volatile = [
    settingsStore,
    watchlistsStore,
    alertsStore,
    researchStore,
    journalStore,
    screensStore,
    layoutsStore,
  ].some((s) => s.isVolatile())

  const exportAll = () => {
    downloadFile(
      `coinwave-backup-${stamp()}.json`,
      JSON.stringify(createBackup(data), null, 2),
      "application/json"
    )
    toast("Backup downloaded", {
      description:
        "Keep it somewhere safe: it’s the only copy outside this browser.",
    })
  }

  const onFile = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = ""
    if (!file) return
    if (file.size > MAX_BACKUP_BYTES)
      return toast.error(
        "This file is larger than 5 MB, which is too large for a CoinWave backup."
      )
    const result = parseBackup(await file.text())
    if (!result.ok) return toast.error(result.error)
    setPreview({ name: file.name, backup: result.backup })
  }

  const remove = (target: SectionId | "all") => {
    const ids = target === "all" ? SECTIONS.map((s) => s.id) : [target]
    const before = Object.fromEntries(
      ids.map((id) => [id, data[id]])
    ) as Partial<BackupData>
    // "All" also forgets the recently viewed list, which isn't backed up.
    const recentBefore = recentStore.get()
    for (const id of ids) writeSection(id, emptySection(id))
    if (target === "all") recentStore.set([])
    setConfirm(null)
    toast(
      target === "all"
        ? "All CoinWave data deleted"
        : `${SECTIONS.find((s) => s.id === target)?.label} deleted`,
      {
        action: {
          label: "Undo",
          onClick: () => {
            ;(Object.keys(before) as SectionId[]).forEach((id) =>
              writeSection(id, before[id]!)
            )
            if (target === "all") recentStore.set(recentBefore)
          },
        },
      }
    )
  }

  const clearCache = () => {
    try {
      const keys: string[] = []
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i)
        if (k?.startsWith(SNAPSHOT_PREFIX)) keys.push(k)
      }
      keys.forEach(removeKey)
    } catch {
      // Storage unavailable.
    }
    queryClient.invalidateQueries()
    toast("Cached market data cleared", {
      description: "Fresh data is loading from the sources.",
    })
  }

  return (
    <Pane id="storage" title="Your data" flush>
      <div className="space-y-2 p-3 text-[0.8125rem] leading-6 text-ink-2">
        <p>
          Your portfolio, watchlists, alerts, research, theses, saved screens
          and chart layouts live only in this browser’s local storage. There’s
          no account and no server copy, so another browser or device starts
          empty and clearing site data erases them. Export a backup to keep or
          move them.
        </p>
        <p className="text-xs text-ink-3">
          Requests to market-data providers include the ids of the assets being
          priced (for example, the coins you hold), never quantities, notes or
          anything else you write.
        </p>
        {volatile && (
          <p
            role="alert"
            className="rounded border border-warn/40 bg-warn-soft px-2 py-1 text-xs text-warn"
          >
            This browser isn’t saving changes (private browsing or storage
            full). Export a backup before closing the tab.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-y border-rule px-3 py-2">
        <Button size="sm" variant="primary" onClick={exportAll}>
          <Download aria-hidden="true" /> Export backup (JSON)
        </Button>
        <Button size="sm" onClick={() => fileRef.current?.click()}>
          <FileJson aria-hidden="true" /> Import backup…
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <Button
          size="sm"
          disabled={
            data.portfolio.transactions.length === 0 || data.portfolio.sample
          }
          title={
            data.portfolio.sample
              ? "The sample portfolio isn’t exported"
              : undefined
          }
          onClick={() =>
            downloadFile(
              `coinwave-transactions-${stamp()}.csv`,
              transactionsToCSV(data.portfolio.transactions),
              "text/csv"
            )
          }
        >
          <Download aria-hidden="true" /> Transactions CSV
        </Button>
        <Button size="sm" onClick={() => setCsvOpen(true)}>
          <Upload aria-hidden="true" /> Import transactions CSV…
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className={T.table}>
          <caption className="sr-only">Data stored in this browser</caption>
          <thead className={T.thead}>
            <tr>
              <th scope="col" className={cn(T.th, "text-left")}>
                Section
              </th>
              <th scope="col" className={cn(T.th, "text-left")}>
                Contents
              </th>
              <th scope="col" className={cn(T.th, "text-right")}>
                Size
              </th>
              <th scope="col" className={cn(T.th, "w-24")}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {SECTIONS.map((s) => {
              const empty = isEmpty(s.id, data)
              return (
                <tr key={s.id} className={T.tr}>
                  <th
                    scope="row"
                    className={cn(T.td, "text-left font-medium text-ink")}
                  >
                    {s.label}
                  </th>
                  <td className={cn(T.td, "text-left text-ink-2")}>
                    {describeSection(s.id, data[s.id])}
                  </td>
                  <td className={cn(T.td, "num text-right text-ink-3")}>
                    {formatBytes(usage.sections[s.id])}
                  </td>
                  <td className={cn(T.td, "text-right")}>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={empty}
                      onClick={() => setConfirm(s.id)}
                      aria-label={
                        s.id === "settings"
                          ? "Reset settings"
                          : `Delete ${s.label.toLowerCase()}`
                      }
                    >
                      {s.id === "settings" ? "Reset" : "Delete"}
                    </Button>
                  </td>
                </tr>
              )
            })}
            <tr className={T.tr}>
              <th
                scope="row"
                className={cn(T.td, "text-left font-medium text-ink")}
              >
                Cached market data
              </th>
              <td className={cn(T.td, "text-left text-ink-2")}>
                Last good prices, shown while sources are slow
              </td>
              <td className={cn(T.td, "num text-right text-ink-3")}>
                {formatBytes(usage.cache)}
              </td>
              <td className={cn(T.td, "text-right")}>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={usage.cache === 0}
                  onClick={clearCache}
                >
                  Clear
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-rule px-3 py-2 text-xs text-ink-3">
        <span>
          Total in local storage{" "}
          <span className="num text-ink-2">{formatBytes(usage.total)}</span>{" "}
          (browsers allow about 5 MB per site).
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="text-down hover:text-down"
          onClick={() => setConfirm("all")}
        >
          <Trash2 aria-hidden="true" /> Delete all CoinWave data
        </Button>
      </div>

      <ConfirmDelete
        target={confirm}
        onCancel={() => setConfirm(null)}
        onConfirm={remove}
      />
      {preview && (
        <ImportPreview
          name={preview.name}
          backup={preview.backup}
          current={data}
          onClose={() => setPreview(null)}
        />
      )}
      <ImportDialog open={csvOpen} onOpenChange={setCsvOpen} />
    </Pane>
  )
}

function ConfirmDelete({
  target,
  onCancel,
  onConfirm,
}: {
  target: SectionId | "all" | null
  onCancel: () => void
  onConfirm: (t: SectionId | "all") => void
}) {
  const label =
    target === "all"
      ? "all CoinWave data"
      : target === "settings"
        ? "settings"
        : SECTIONS.find((s) => s.id === target)?.label.toLowerCase()
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {target === "settings" ? "Reset settings?" : `Delete ${label}?`}
          </DialogTitle>
          <DialogDescription>
            {target === "settings"
              ? "Preferences return to their defaults. Your data isn’t affected."
              : "This removes it from this browser. You can undo right after; after that it’s gone unless you have a backup."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="danger" onClick={() => target && onConfirm(target)}>
            {target === "settings" ? "Reset" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type Outcome =
  | { ok: true; value: BackupData[SectionId]; summary: string }
  | { ok: false; error: string }

function ImportPreview({
  name,
  backup,
  current,
  onClose,
}: {
  name: string
  backup: ParsedBackup
  current: BackupData
  onClose: () => void
}) {
  const present = SECTIONS.filter((s) => backup.data[s.id] !== undefined)
  const [selected, setSelected] = useState<Set<SectionId>>(
    () => new Set(present.map((s) => s.id))
  )
  const [mode, setMode] = useState<"merge" | "replace">("merge")

  const outcomes = useMemo(
    () =>
      new Map<SectionId, Outcome>(
        present.map((s): [SectionId, Outcome] => {
          const incoming = backup.data[s.id]!
          if (mode === "replace" || !s.mergeable)
            return [
              s.id,
              { ok: true, value: incoming, summary: "Replaces current" },
            ]
          const out = mergeSection(s.id, current[s.id], incoming)
          if (!out.ok) return [s.id, { ok: false, error: out.error }]
          const parts = [
            out.added && `${out.added} new`,
            out.updated && `${out.updated} updated`,
            out.skipped && `${out.skipped} already here`,
          ].filter(Boolean)
          return [
            s.id,
            {
              ok: true,
              value: out.value,
              summary: parts.length ? parts.join(", ") : "Nothing new",
            },
          ]
        })
      ),
    [present, backup, current, mode]
  )
  const blocked = [...selected].some((id) => outcomes.get(id)?.ok === false)

  const apply = () => {
    const before = Object.fromEntries(
      [...selected].map((id) => [id, current[id]])
    ) as Partial<BackupData>
    for (const id of selected) {
      const out = outcomes.get(id)
      if (out?.ok) writeSection(id, out.value as BackupData[typeof id])
    }
    onClose()
    toast(
      `Imported ${selected.size} section${selected.size === 1 ? "" : "s"}`,
      {
        action: {
          label: "Undo",
          onClick: () =>
            (Object.keys(before) as SectionId[]).forEach((id) =>
              writeSection(id, before[id]!)
            ),
        },
      }
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import backup</DialogTitle>
          <DialogDescription>
            <span className="mono">{name}</span>
            {backup.exportedAt
              ? `, exported ${formatDate(backup.exportedAt)}`
              : ""}
            . Choose what to bring in. Nothing changes until you import.
          </DialogDescription>
        </DialogHeader>

        <Segmented
          label="Import mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: "merge", label: "Merge with my data" },
            { value: "replace", label: "Replace my data" },
          ]}
        />
        <p className="mt-1 text-xs text-ink-3">
          {mode === "merge"
            ? "Adds what’s new. Duplicate transactions are skipped; for notes and theses edited in both places, the more recent version wins."
            : "Selected sections are overwritten with the backup’s contents."}
        </p>

        <ul className="mt-3 divide-y divide-rule rounded-md border border-rule">
          {present.map((s) => {
            const out = outcomes.get(s.id)
            const dropped = backup.dropped[s.id]
            return (
              <li key={s.id} className="flex items-start gap-3 px-3 py-2">
                <input
                  id={`import-${s.id}`}
                  type="checkbox"
                  className="mt-1 size-4 accent-[var(--accent)]"
                  checked={selected.has(s.id)}
                  onChange={(e) =>
                    setSelected((prev) => {
                      const next = new Set(prev)
                      if (e.target.checked) next.add(s.id)
                      else next.delete(s.id)
                      return next
                    })
                  }
                />
                <div className="min-w-0 flex-1 text-[0.8125rem]">
                  <label
                    htmlFor={`import-${s.id}`}
                    className="font-medium text-ink"
                  >
                    {s.label}
                  </label>
                  <p className="text-xs text-ink-3">
                    Backup: {describeSection(s.id, backup.data[s.id]!)} · Now:{" "}
                    {describeSection(s.id, current[s.id])}
                  </p>
                  {dropped ? (
                    <p className="text-xs text-warn">
                      {dropped} unreadable record{dropped === 1 ? "" : "s"} will
                      be skipped.
                    </p>
                  ) : null}
                  {out && !out.ok && selected.has(s.id) && (
                    <p className="text-xs text-down" role="alert">
                      {out.error}
                    </p>
                  )}
                </div>
                {out?.ok && (
                  <Badge
                    tone={
                      mode === "replace" || !s.mergeable ? "warn" : "neutral"
                    }
                  >
                    {out.summary}
                  </Badge>
                )}
              </li>
            )
          })}
        </ul>

        <DialogFooter>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={selected.size === 0 || blocked}
            onClick={apply}
          >
            {mode === "replace" ? "Replace selected" : "Import selected"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
