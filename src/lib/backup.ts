/**
 * Whole-workspace backup: one JSON file holding everything CoinWave stores
 * for the user. Every section is validated with the same sanitizers the
 * stores use on load, so a hand-edited or partial file degrades to what can
 * be read safely instead of corrupting saved data.
 */

import { sanitizeAlertsData, type AlertsData } from "@/lib/alerts"
import {
  findAnyOversell,
  sanitizeTransaction,
  transactionKey,
  type PortfolioData,
  type Transaction,
} from "@/lib/portfolio"
import {
  sanitizeJournal,
  sanitizeLayouts,
  sanitizeResearch,
  sanitizeScreens,
  sanitizeSettings,
  sanitizeWatchlists,
  type ChartLayout,
  type JournalData,
  type ResearchData,
  type SavedScreen,
  type Settings,
  type WatchlistsData,
} from "@/lib/workspace"

export const BACKUP_FORMAT = "coinwave-backup"
export const BACKUP_VERSION = 1
/** Larger files are refused before parsing; real backups are far smaller. */
export const MAX_BACKUP_BYTES = 5_000_000

export type BackupData = {
  settings: Settings
  portfolio: PortfolioData
  watchlists: WatchlistsData
  alerts: AlertsData
  research: ResearchData
  journal: JournalData
  screens: SavedScreen[]
  layouts: ChartLayout[]
}

export type SectionId = keyof BackupData

export const SECTIONS: { id: SectionId; label: string; mergeable: boolean }[] =
  [
    { id: "portfolio", label: "Portfolio transactions", mergeable: true },
    { id: "watchlists", label: "Watchlists", mergeable: true },
    { id: "alerts", label: "Alerts and alert history", mergeable: true },
    {
      id: "research",
      label: "Research notes and collections",
      mergeable: true,
    },
    { id: "journal", label: "Theses and journal", mergeable: true },
    { id: "screens", label: "Saved screens", mergeable: true },
    { id: "layouts", label: "Chart layouts", mergeable: true },
    { id: "settings", label: "Settings", mergeable: false },
  ]

export type Backup = {
  format: typeof BACKUP_FORMAT
  version: typeof BACKUP_VERSION
  exportedAt: number
  data: Partial<BackupData>
}

export function createBackup(
  data: Partial<BackupData>,
  now = Date.now()
): Backup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now,
    data,
  }
}

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`

/** Short human description of what a section holds, for previews. */
export function describeSection<K extends SectionId>(
  id: K,
  value: BackupData[K]
): string {
  const v = value as BackupData[SectionId]
  switch (id) {
    case "portfolio": {
      const p = v as PortfolioData
      return p.sample
        ? `${plural(p.transactions.length, "transaction")} (sample data)`
        : plural(p.transactions.length, "transaction")
    }
    case "watchlists": {
      const w = v as WatchlistsData
      return `${plural(w.lists.length, "list")}, ${plural(
        w.lists.reduce((n, l) => n + l.items.length, 0),
        "asset"
      )}`
    }
    case "alerts": {
      const a = v as AlertsData
      return `${plural(a.alerts.length, "alert")}, ${plural(a.events.length, "history event")}`
    }
    case "research": {
      const r = v as ResearchData
      return `${plural(r.notes.length, "note")}, ${plural(r.collections.length, "collection")}`
    }
    case "journal": {
      const j = v as JournalData
      return `${plural(j.theses.length, "thesis", "theses")}, ${plural(
        j.theses.reduce((n, t) => n + t.entries.length, 0),
        "journal entry",
        "journal entries"
      )}`
    }
    case "screens":
      return plural((v as SavedScreen[]).length, "screen")
    case "layouts":
      return plural((v as ChartLayout[]).length, "layout")
    case "settings":
      return "Theme-independent preferences"
  }
  return ""
}

function sanitizePortfolio(raw: unknown): PortfolioData {
  const o =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  return {
    version: 2,
    transactions: (Array.isArray(o.transactions) ? o.transactions : [])
      .map(sanitizeTransaction)
      .filter((t): t is Transaction => t !== null),
    sample: o.sample === true,
  }
}

const rawLength = (raw: unknown, key?: string) => {
  const v = key ? (raw as Record<string, unknown> | null)?.[key] : raw
  return Array.isArray(v) ? v.length : 0
}

export type ParsedBackup = {
  exportedAt: number | null
  data: Partial<BackupData>
  /** Records present in the file that failed validation, per section. */
  dropped: Partial<Record<SectionId, number>>
}

export type ParseResult =
  | { ok: true; backup: ParsedBackup }
  | { ok: false; error: string }

export function parseBackup(text: string): ParseResult {
  if (text.length > MAX_BACKUP_BYTES)
    return {
      ok: false,
      error:
        "This file is larger than 5 MB, which is too large for a CoinWave backup.",
    }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: "This file isn’t valid JSON." }
  }
  const root =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null
  if (!root || root.format !== BACKUP_FORMAT) {
    return {
      ok: false,
      error:
        "This isn’t a CoinWave backup file. Export one from Settings → Your data.",
    }
  }
  if (typeof root.version !== "number" || root.version > BACKUP_VERSION) {
    return {
      ok: false,
      error:
        "This backup was made by a newer version of CoinWave and can’t be read here.",
    }
  }
  const src =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : {}
  const data: Partial<BackupData> = {}
  const dropped: Partial<Record<SectionId, number>> = {}
  const note = (id: SectionId, before: number, after: number) => {
    if (before > after) dropped[id] = before - after
  }

  if ("settings" in src) data.settings = sanitizeSettings(src.settings)
  if ("portfolio" in src) {
    data.portfolio = sanitizePortfolio(src.portfolio)
    note(
      "portfolio",
      rawLength(src.portfolio, "transactions"),
      data.portfolio.transactions.length
    )
  }
  if ("watchlists" in src) {
    const w = sanitizeWatchlists(src.watchlists, "default")
    // The sanitizer creates an empty default list when none is valid; an
    // import should not invent one.
    if (rawLength(src.watchlists, "lists") > 0) data.watchlists = w
    note(
      "watchlists",
      rawLength(src.watchlists, "lists"),
      rawLength(src.watchlists, "lists") > 0 ? w.lists.length : 0
    )
  }
  if ("alerts" in src) {
    data.alerts = sanitizeAlertsData(src.alerts)
    note("alerts", rawLength(src.alerts, "alerts"), data.alerts.alerts.length)
  }
  if ("research" in src) {
    data.research = sanitizeResearch(src.research)
    note(
      "research",
      rawLength(src.research, "notes"),
      data.research.notes.length
    )
  }
  if ("journal" in src) {
    data.journal = sanitizeJournal(src.journal)
    note(
      "journal",
      rawLength(src.journal, "theses"),
      data.journal.theses.length
    )
  }
  if ("screens" in src) {
    data.screens = sanitizeScreens(src.screens)
    note("screens", rawLength(src.screens), data.screens.length)
  }
  if ("layouts" in src) {
    data.layouts = sanitizeLayouts(src.layouts)
    note("layouts", rawLength(src.layouts), data.layouts.length)
  }
  if (Object.keys(data).length === 0)
    return {
      ok: false,
      error: "This backup doesn’t contain any CoinWave data.",
    }

  const exportedAt =
    typeof root.exportedAt === "number" && Number.isFinite(root.exportedAt)
      ? root.exportedAt
      : null
  return { ok: true, backup: { exportedAt, data, dropped } }
}

// ---------------------------------------------------------------------------
// Merging

export type MergeOutcome<T> =
  | { ok: true; value: T; added: number; updated: number; skipped: number }
  | { ok: false; error: string }

type WithId = { id: string }

/**
 * Union by id. Existing records win unless `newer` says the incoming copy is
 * more recent (used for documents that carry an updatedAt).
 */
function unionById<T extends WithId>(
  current: T[],
  incoming: T[],
  newer?: (a: T, b: T) => boolean
) {
  const index = new Map(current.map((x, i) => [x.id, i]))
  const value = [...current]
  let added = 0
  let updated = 0
  let skipped = 0
  for (const item of incoming) {
    const i = index.get(item.id)
    if (i === undefined) {
      index.set(item.id, value.length)
      value.push(item)
      added++
    } else if (newer?.(item, value[i])) {
      value[i] = item
      updated++
    } else {
      skipped++
    }
  }
  return { value, added, updated, skipped }
}

const byUpdatedAt = <T extends { updatedAt: number }>(a: T, b: T) =>
  a.updatedAt > b.updatedAt

function mergePortfolio(
  current: PortfolioData,
  incoming: PortfolioData
): MergeOutcome<PortfolioData> {
  if (incoming.sample) {
    return {
      ok: true,
      value: current,
      added: 0,
      updated: 0,
      skipped: incoming.transactions.length,
    }
  }
  // The bundled sample is never mixed with real transactions.
  const base = current.sample ? [] : current.transactions
  const ids = new Set(base.map((t) => t.id))
  const keys = new Set(base.map(transactionKey))
  const transactions = [...base]
  let added = 0
  let skipped = 0
  for (const tx of incoming.transactions) {
    const key = transactionKey(tx)
    if (ids.has(tx.id) || keys.has(key)) {
      skipped++
      continue
    }
    ids.add(tx.id)
    keys.add(key)
    transactions.push(tx)
    added++
  }
  const short = findAnyOversell(
    transactions,
    transactions.map((t) => t.assetId)
  )
  if (short) {
    const symbol =
      transactions.find((t) => t.assetId === short.assetId)?.symbol ??
      short.assetId
    return {
      ok: false,
      error: `Merging would sell more ${symbol} than the combined ledger holds${short.date ? ` on ${short.date}` : ""}. Replace the portfolio instead, or fix the file.`,
    }
  }
  return {
    ok: true,
    value: { version: 2, transactions, sample: false },
    added,
    updated: 0,
    skipped,
  }
}

function mergeWatchlists(
  current: WatchlistsData,
  incoming: WatchlistsData
): MergeOutcome<WatchlistsData> {
  let added = 0
  let updated = 0
  let skipped = 0
  const lists = current.lists.map((l) => ({ ...l, items: [...l.items] }))
  for (const list of incoming.lists) {
    const existing = lists.find((l) => l.id === list.id)
    if (!existing) {
      lists.push(list)
      added++
      continue
    }
    const fresh = list.items.filter(
      (it) => !existing.items.some((x) => x.assetId === it.assetId)
    )
    if (fresh.length) {
      existing.items.push(...fresh)
      updated++
    } else {
      skipped++
    }
  }
  return { ok: true, value: { ...current, lists }, added, updated, skipped }
}

export function mergeSection<K extends SectionId>(
  id: K,
  current: BackupData[K],
  incoming: BackupData[K]
): MergeOutcome<BackupData[K]> {
  const c = current as BackupData[SectionId]
  const n = incoming as BackupData[SectionId]
  let out: MergeOutcome<BackupData[SectionId]>
  switch (id) {
    case "portfolio":
      out = mergePortfolio(c as PortfolioData, n as PortfolioData)
      break
    case "watchlists":
      out = mergeWatchlists(c as WatchlistsData, n as WatchlistsData)
      break
    case "alerts": {
      const a = c as AlertsData
      const b = n as AlertsData
      const alerts = unionById(a.alerts, b.alerts)
      const events = unionById(a.events, b.events)
      out = {
        ok: true,
        value: {
          version: 1,
          alerts: alerts.value,
          events: events.value.sort((x, y) => y.at - x.at),
        },
        added: alerts.added,
        updated: 0,
        skipped: alerts.skipped,
      }
      break
    }
    case "research": {
      const a = c as ResearchData
      const b = n as ResearchData
      const notes = unionById(a.notes, b.notes, byUpdatedAt)
      const collections = unionById(a.collections, b.collections)
      out = {
        ok: true,
        value: {
          version: 1,
          notes: notes.value,
          collections: collections.value,
        },
        added: notes.added + collections.added,
        updated: notes.updated,
        skipped: notes.skipped + collections.skipped,
      }
      break
    }
    case "journal": {
      const t = unionById(
        (c as JournalData).theses,
        (n as JournalData).theses,
        byUpdatedAt
      )
      out = {
        ok: true,
        value: { version: 1, theses: t.value },
        added: t.added,
        updated: t.updated,
        skipped: t.skipped,
      }
      break
    }
    case "screens":
    case "layouts": {
      const u = unionById(c as WithId[], n as WithId[])
      out = {
        ok: true,
        value: u.value as SavedScreen[] | ChartLayout[],
        added: u.added,
        updated: 0,
        skipped: u.skipped,
      }
      break
    }
    default:
      // Settings are a single document: importing them always replaces.
      out = { ok: true, value: n, added: 0, updated: 1, skipped: 0 }
  }
  return out as MergeOutcome<BackupData[K]>
}
