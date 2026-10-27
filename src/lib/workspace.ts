/**
 * Data models for the productivity workspace: watchlists, research notes and
 * collections, investment theses with their decision journal, saved screens,
 * chart layouts and settings. Every model has a sanitiser, used both when
 * loading from storage and when importing a backup, so malformed data is
 * dropped field-by-field instead of breaking the app.
 */

const str = (v: unknown, fallback = "") =>
  typeof v === "string" ? v : fallback
const num = (v: unknown, fallback = 0) =>
  Number.isFinite(Number(v)) && v !== null && v !== "" ? Number(v) : fallback
const strs = (v: unknown) =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "")
    : []
const obj = (v: unknown) =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// ---------------------------------------------------------------------------
// Watchlists

export type WatchItem = { assetId: string; note: string; addedAt: number }
export type Watchlist = {
  id: string
  name: string
  createdAt: number
  items: WatchItem[]
}
export type WatchlistsData = {
  version: 1
  lists: Watchlist[]
  defaultId: string
}

export function sanitizeWatchlists(
  raw: unknown,
  fallbackId: string
): WatchlistsData {
  const d = obj(raw)
  const lists: Watchlist[] = []
  for (const l of Array.isArray(d?.lists) ? d.lists : []) {
    const o = obj(l)
    if (!o || typeof o.id !== "string" || !o.id) continue
    const seen = new Set<string>()
    const items: WatchItem[] = []
    for (const it of Array.isArray(o.items) ? o.items : []) {
      const i = obj(it)
      const assetId = i ? str(i.assetId) : ""
      if (!assetId || seen.has(assetId)) continue
      seen.add(assetId)
      items.push({ assetId, note: str(i!.note), addedAt: num(i!.addedAt) })
    }
    lists.push({
      id: o.id,
      name: str(o.name).trim() || "Untitled list",
      createdAt: num(o.createdAt),
      items,
    })
  }
  if (lists.length === 0)
    lists.push({ id: fallbackId, name: "Watchlist", createdAt: 0, items: [] })
  const defaultId =
    typeof d?.defaultId === "string" && lists.some((l) => l.id === d.defaultId)
      ? d.defaultId
      : lists[0].id
  return { version: 1, lists, defaultId }
}

/** The previous version stored one watchlist as an array of asset ids. */
export function migrateLegacyWatchlist(
  raw: unknown,
  id: string,
  now: number
): WatchlistsData | null {
  if (!Array.isArray(raw)) return null
  const ids = [
    ...new Set(
      raw.filter((x): x is string => typeof x === "string" && x !== "")
    ),
  ]
  return {
    version: 1,
    lists: [
      {
        id,
        name: "Watchlist",
        createdAt: now,
        items: ids.map((assetId, i) => ({
          assetId,
          note: "",
          addedAt: now + i,
        })),
      },
    ],
    defaultId: id,
  }
}

// ---------------------------------------------------------------------------
// Research

export type NoteKind = "note" | "article" | "comparison"

export type Revision = { at: number; title: string; body: string }

export type Note = {
  id: string
  kind: NoteKind
  title: string
  body: string
  tags: string[]
  assetIds: string[]
  collectionId: string | null
  links: { url: string; title: string }[]
  /** For saved articles: where it came from. */
  source: { name: string; url: string; publishedAt: number | null } | null
  pinned: boolean
  createdAt: number
  updatedAt: number
  revisions: Revision[]
}

export type Collection = {
  id: string
  name: string
  description: string
  createdAt: number
}

export type ResearchData = {
  version: 1
  notes: Note[]
  collections: Collection[]
}

export function safeHttpUrl(value: string) {
  try {
    const u = new URL(value)
    return u.protocol === "http:" || u.protocol === "https:"
      ? u.toString()
      : null
  } catch {
    return null
  }
}

export function sanitizeNote(raw: unknown): Note | null {
  const o = obj(raw)
  if (!o || typeof o.id !== "string" || !o.id) return null
  const kind: NoteKind =
    o.kind === "article" || o.kind === "comparison" ? o.kind : "note"
  const src = obj(o.source)
  const srcUrl = src ? safeHttpUrl(str(src.url)) : null
  return {
    id: o.id,
    kind,
    title: str(o.title).slice(0, 300),
    body: str(o.body).slice(0, 100_000),
    tags: [
      ...new Set(strs(o.tags).map((t) => t.trim().toLowerCase().slice(0, 40))),
    ].slice(0, 20),
    assetIds: [...new Set(strs(o.assetIds))].slice(0, 30),
    collectionId:
      typeof o.collectionId === "string" && o.collectionId
        ? o.collectionId
        : null,
    links: (Array.isArray(o.links) ? o.links : [])
      .map((l) => {
        const lo = obj(l)
        const url = lo ? safeHttpUrl(str(lo.url)) : null
        return url ? { url, title: str(lo!.title).slice(0, 200) } : null
      })
      .filter((l): l is { url: string; title: string } => l !== null)
      .slice(0, 30),
    source:
      src && srcUrl
        ? {
            name: str(src.name),
            url: srcUrl,
            publishedAt: Number.isFinite(Number(src.publishedAt))
              ? Number(src.publishedAt)
              : null,
          }
        : null,
    pinned: o.pinned === true,
    createdAt: num(o.createdAt),
    updatedAt: num(o.updatedAt, num(o.createdAt)),
    revisions: (Array.isArray(o.revisions) ? o.revisions : [])
      .map((r) => {
        const ro = obj(r)
        return ro
          ? { at: num(ro.at), title: str(ro.title), body: str(ro.body) }
          : null
      })
      .filter((r): r is Revision => r !== null)
      .slice(-30),
  }
}

export function sanitizeResearch(raw: unknown): ResearchData {
  const d = obj(raw)
  const collections: Collection[] = (
    Array.isArray(d?.collections) ? d.collections : []
  )
    .map((c) => {
      const o = obj(c)
      return o && typeof o.id === "string" && o.id
        ? {
            id: o.id,
            name: str(o.name).trim() || "Untitled",
            description: str(o.description),
            createdAt: num(o.createdAt),
          }
        : null
    })
    .filter((c): c is Collection => c !== null)
  const ids = new Set(collections.map((c) => c.id))
  const notes = (Array.isArray(d?.notes) ? d.notes : [])
    .map(sanitizeNote)
    .filter((n): n is Note => n !== null)
    .map((n) =>
      n.collectionId && !ids.has(n.collectionId)
        ? { ...n, collectionId: null }
        : n
    )
  return { version: 1, notes, collections }
}

/** Snapshot the previous content when an edit lands, at most every 10 minutes. */
export function withRevision(
  note: Note,
  next: Pick<Note, "title" | "body">,
  now: number
): Note {
  const changed = note.title !== next.title || note.body !== next.body
  if (!changed) return note
  const last = note.revisions[note.revisions.length - 1]
  const hasContent = note.title.trim() !== "" || note.body.trim() !== ""
  const shouldSnapshot = hasContent && (!last || now - last.at > 10 * 60_000)
  return {
    ...note,
    ...next,
    updatedAt: now,
    revisions: shouldSnapshot
      ? [
          ...note.revisions,
          { at: note.updatedAt || now, title: note.title, body: note.body },
        ].slice(-30)
      : note.revisions,
  }
}

// ---------------------------------------------------------------------------
// Theses and the decision journal

export type Stance = "bullish" | "bearish" | "neutral"
export type ThesisStatus = "draft" | "active" | "closed" | "invalidated"
export type EntryKind = "observation" | "decision" | "review"
export type Decision =
  | "buy"
  | "add"
  | "trim"
  | "sell"
  | "hold"
  | "wait"
  | "exit"

export type JournalEntry = {
  id: string
  kind: EntryKind
  /** ISO timestamp the entry refers to. */
  at: number
  text: string
  decision: Decision | null
  assetId: string | null
  /** Price of `assetId` when the entry was recorded (from live data), if known. */
  priceAtEntry: number | null
  outcome: string
}

export type Thesis = {
  id: string
  title: string
  assetIds: string[]
  stance: Stance
  status: ThesisStatus
  summary: string
  assumptions: string[]
  catalysts: string[]
  risks: string[]
  invalidation: string[]
  monitoring: string
  reviewBy: string | null
  alertIds: string[]
  watchlistId: string | null
  lessons: string
  createdAt: number
  updatedAt: number
  entries: JournalEntry[]
}

export type JournalData = { version: 1; theses: Thesis[] }

const STANCES = new Set<Stance>(["bullish", "bearish", "neutral"])
const T_STATUSES = new Set<ThesisStatus>([
  "draft",
  "active",
  "closed",
  "invalidated",
])
const KINDS = new Set<EntryKind>(["observation", "decision", "review"])
const DECISIONS = new Set<Decision>([
  "buy",
  "add",
  "trim",
  "sell",
  "hold",
  "wait",
  "exit",
])

export function sanitizeThesis(raw: unknown): Thesis | null {
  const o = obj(raw)
  if (!o || typeof o.id !== "string" || !o.id) return null
  return {
    id: o.id,
    title: str(o.title).slice(0, 300) || "Untitled thesis",
    assetIds: [...new Set(strs(o.assetIds))].slice(0, 20),
    stance: STANCES.has(o.stance as Stance) ? (o.stance as Stance) : "neutral",
    status: T_STATUSES.has(o.status as ThesisStatus)
      ? (o.status as ThesisStatus)
      : "draft",
    summary: str(o.summary).slice(0, 20_000),
    assumptions: strs(o.assumptions).slice(0, 50),
    catalysts: strs(o.catalysts).slice(0, 50),
    risks: strs(o.risks).slice(0, 50),
    invalidation: strs(o.invalidation).slice(0, 50),
    monitoring: str(o.monitoring).slice(0, 5_000),
    reviewBy:
      typeof o.reviewBy === "string" && DATE_RE.test(o.reviewBy)
        ? o.reviewBy
        : null,
    alertIds: strs(o.alertIds),
    watchlistId:
      typeof o.watchlistId === "string" && o.watchlistId ? o.watchlistId : null,
    lessons: str(o.lessons).slice(0, 20_000),
    createdAt: num(o.createdAt),
    updatedAt: num(o.updatedAt, num(o.createdAt)),
    entries: (Array.isArray(o.entries) ? o.entries : [])
      .map((e) => {
        const eo = obj(e)
        if (!eo || typeof eo.id !== "string") return null
        const price = Number(eo.priceAtEntry)
        return {
          id: eo.id,
          kind: KINDS.has(eo.kind as EntryKind)
            ? (eo.kind as EntryKind)
            : "observation",
          at: num(eo.at),
          text: str(eo.text).slice(0, 20_000),
          decision: DECISIONS.has(eo.decision as Decision)
            ? (eo.decision as Decision)
            : null,
          assetId:
            typeof eo.assetId === "string" && eo.assetId ? eo.assetId : null,
          priceAtEntry:
            eo.priceAtEntry !== null && Number.isFinite(price) && price > 0
              ? price
              : null,
          outcome: str(eo.outcome).slice(0, 10_000),
        }
      })
      .filter((e): e is JournalEntry => e !== null)
      .sort((a, b) => a.at - b.at),
  }
}

export function sanitizeJournal(raw: unknown): JournalData {
  const d = obj(raw)
  return {
    version: 1,
    theses: (Array.isArray(d?.theses) ? d.theses : [])
      .map(sanitizeThesis)
      .filter((t): t is Thesis => t !== null),
  }
}

/** Theses whose review date has arrived (or passed) and are still open. */
export function thesesDueForReview(theses: Thesis[], today: string) {
  return theses.filter(
    (t) =>
      (t.status === "active" || t.status === "draft") &&
      t.reviewBy !== null &&
      t.reviewBy <= today
  )
}

/** % move of a price since a decision, from the decision's perspective. */
export function moveSince(priceAtEntry: number | null, now: number | null) {
  if (priceAtEntry === null || now === null || priceAtEntry <= 0) return null
  return (now / priceAtEntry - 1) * 100
}

// ---------------------------------------------------------------------------
// Saved screens and chart layouts

export type SavedScreen = {
  id: string
  name: string
  /** Encoded conditions (see lib/screener). */
  conditions: string
  sort: string
  createdAt: number
}

export function sanitizeScreens(raw: unknown): SavedScreen[] {
  return (Array.isArray(raw) ? raw : [])
    .map((s) => {
      const o = obj(s)
      return o && typeof o.id === "string" && o.id && typeof o.name === "string"
        ? {
            id: o.id,
            name: o.name.slice(0, 80) || "Saved screen",
            conditions: str(o.conditions),
            sort: str(o.sort),
            createdAt: num(o.createdAt),
          }
        : null
    })
    .filter((s): s is SavedScreen => s !== null)
}

export type ChartType = "candles" | "line" | "area"
export type ChartInterval = "15m" | "1h" | "4h" | "1d" | "1w"

export type IndicatorConfig = {
  sma: { enabled: boolean; periods: number[] }
  ema: { enabled: boolean; periods: number[] }
  bollinger: { enabled: boolean; period: number; k: number }
  volume: boolean
  rsi: { enabled: boolean; period: number }
  macd: { enabled: boolean; fast: number; slow: number; signal: number }
}

export type ChartLayout = {
  id: string
  name: string
  assetId: string
  interval: ChartInterval
  type: ChartType
  log: boolean
  indicators: IndicatorConfig
  compare: string[]
  createdAt: number
}

export const DEFAULT_INDICATORS: IndicatorConfig = {
  sma: { enabled: true, periods: [20, 50] },
  ema: { enabled: false, periods: [21] },
  bollinger: { enabled: false, period: 20, k: 2 },
  volume: true,
  rsi: { enabled: true, period: 14 },
  macd: { enabled: false, fast: 12, slow: 26, signal: 9 },
}

const INTERVALS = new Set<ChartInterval>(["15m", "1h", "4h", "1d", "1w"])
const period = (v: unknown, fallback: number, max = 400) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) && n >= 1 && n <= max ? n : fallback
}

export function sanitizeIndicators(raw: unknown): IndicatorConfig {
  const o = obj(raw) ?? {}
  const sub = (k: string) => obj(o[k]) ?? {}
  const periods = (v: unknown, fallback: number[]) => {
    const list = (Array.isArray(v) ? v : [])
      .map((p) => period(p, 0))
      .filter((p) => p > 0)
      .slice(0, 3)
    return list.length ? list : fallback
  }
  const d = DEFAULT_INDICATORS
  const on = (k: string, fallback: boolean) =>
    typeof sub(k).enabled === "boolean" ? (sub(k).enabled as boolean) : fallback
  return {
    sma: {
      enabled: on("sma", d.sma.enabled),
      periods: periods(sub("sma").periods, d.sma.periods),
    },
    ema: {
      enabled: on("ema", d.ema.enabled),
      periods: periods(sub("ema").periods, d.ema.periods),
    },
    bollinger: {
      enabled: on("bollinger", d.bollinger.enabled),
      period: period(sub("bollinger").period, 20),
      k: Math.min(4, Math.max(0.5, num(sub("bollinger").k, 2))),
    },
    volume: o.volume !== false,
    rsi: {
      enabled: on("rsi", d.rsi.enabled),
      period: period(sub("rsi").period, 14, 100),
    },
    macd: {
      enabled: on("macd", d.macd.enabled),
      fast: period(sub("macd").fast, 12, 100),
      slow: period(sub("macd").slow, 26, 200),
      signal: period(sub("macd").signal, 9, 100),
    },
  }
}

export function sanitizeLayouts(raw: unknown): ChartLayout[] {
  return (Array.isArray(raw) ? raw : [])
    .map((l) => {
      const o = obj(l)
      if (
        !o ||
        typeof o.id !== "string" ||
        !o.id ||
        typeof o.assetId !== "string" ||
        !o.assetId
      )
        return null
      return {
        id: o.id,
        name: str(o.name).slice(0, 80) || "Layout",
        assetId: o.assetId,
        interval: INTERVALS.has(o.interval as ChartInterval)
          ? (o.interval as ChartInterval)
          : "1d",
        type: o.type === "line" || o.type === "area" ? o.type : "candles",
        log: o.log === true,
        indicators: sanitizeIndicators(o.indicators),
        compare: strs(o.compare).slice(0, 4),
        createdAt: num(o.createdAt),
      }
    })
    .filter((l): l is ChartLayout => l !== null)
}

// ---------------------------------------------------------------------------
// Settings

export type RefreshInterval = 60 | 120 | 300 | 600 | 0

export type WidgetId =
  | "pulse"
  | "majors"
  | "movers"
  | "watchlist"
  | "portfolio"
  | "alerts"
  | "recent"
  | "research"
  | "news"
  | "map"
  | "sectors"

export const WIDGETS: { id: WidgetId; label: string }[] = [
  { id: "pulse", label: "Market pulse" },
  { id: "majors", label: "Bitcoin & Ethereum" },
  { id: "portfolio", label: "Portfolio" },
  { id: "watchlist", label: "Watchlist" },
  { id: "alerts", label: "Alerts" },
  { id: "movers", label: "Biggest movers" },
  { id: "research", label: "Research needing attention" },
  { id: "news", label: "Latest news" },
  { id: "recent", label: "Recently viewed" },
  { id: "sectors", label: "Sector performance" },
  { id: "map", label: "Market map" },
]

export const MARKET_COLUMNS = [
  "rank",
  "price",
  "change1h",
  "change24h",
  "change7d",
  "change30d",
  "change1y",
  "marketCap",
  "fdv",
  "volume24h",
  "volToMcap",
  "athChange",
  "circulatingSupply",
  "sparkline",
] as const

export type MarketColumn = (typeof MARKET_COLUMNS)[number]

export const MARKET_COLUMN_LABELS: Record<MarketColumn, string> = {
  rank: "Rank",
  price: "Price",
  change1h: "1h change",
  change24h: "24h change",
  change7d: "7d change",
  change30d: "30d change",
  change1y: "1y change",
  marketCap: "Market cap",
  fdv: "Fully diluted value",
  volume24h: "24h volume",
  volToMcap: "Turnover (vol / cap)",
  athChange: "From all-time high",
  circulatingSupply: "Circulating supply",
  sparkline: "7-day sparkline",
}

export const DEFAULT_MARKET_COLUMNS: MarketColumn[] = [
  "rank",
  "price",
  "change1h",
  "change24h",
  "change7d",
  "change30d",
  "marketCap",
  "volume24h",
  "sparkline",
]

export type Settings = {
  version: 1
  refreshInterval: RefreshInterval
  marketColumns: MarketColumn[]
  marketPageSize: 50 | 100
  hideStablecoins: boolean
  chartDefaults: {
    interval: ChartInterval
    type: ChartType
    indicators: IndicatorConfig
  }
  notifications: boolean
  widgets: { id: WidgetId; visible: boolean }[]
  moversMinCap: number
}

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  refreshInterval: 120,
  marketColumns: DEFAULT_MARKET_COLUMNS,
  marketPageSize: 100,
  hideStablecoins: false,
  chartDefaults: {
    interval: "1d",
    type: "candles",
    indicators: DEFAULT_INDICATORS,
  },
  notifications: false,
  widgets: WIDGETS.map((w) => ({
    id: w.id,
    visible: w.id !== "map" && w.id !== "recent",
  })),
  moversMinCap: 100_000_000,
}

export function sanitizeSettings(raw: unknown): Settings {
  const o = obj(raw) ?? {}
  const d = DEFAULT_SETTINGS
  const refresh = Number(o.refreshInterval)
  const cols = strs(o.marketColumns).filter((c): c is MarketColumn =>
    (MARKET_COLUMNS as readonly string[]).includes(c)
  )
  const chart = obj(o.chartDefaults) ?? {}
  const savedWidgets = (Array.isArray(o.widgets) ? o.widgets : [])
    .map((w) => obj(w))
    .filter(
      (w): w is Record<string, unknown> =>
        !!w && WIDGETS.some((x) => x.id === w.id)
    )
    .map((w) => ({ id: w.id as WidgetId, visible: w.visible !== false }))
  // Keep the user's order and append any widgets added in later versions.
  const widgets = [
    ...savedWidgets.filter(
      (w, i) => savedWidgets.findIndex((x) => x.id === w.id) === i
    ),
    ...d.widgets.filter((w) => !savedWidgets.some((x) => x.id === w.id)),
  ]
  return {
    version: 1,
    refreshInterval: ([60, 120, 300, 600, 0] as number[]).includes(refresh)
      ? (refresh as RefreshInterval)
      : d.refreshInterval,
    marketColumns: cols.length ? cols : d.marketColumns,
    marketPageSize: o.marketPageSize === 50 ? 50 : 100,
    hideStablecoins: o.hideStablecoins === true,
    chartDefaults: {
      interval: INTERVALS.has(chart.interval as ChartInterval)
        ? (chart.interval as ChartInterval)
        : d.chartDefaults.interval,
      type:
        chart.type === "line" || chart.type === "area" ? chart.type : "candles",
      indicators: chart.indicators
        ? sanitizeIndicators(chart.indicators)
        : d.chartDefaults.indicators,
    },
    notifications: o.notifications === true,
    widgets,
    moversMinCap: Math.max(0, num(o.moversMinCap, d.moversMinCap)),
  }
}
