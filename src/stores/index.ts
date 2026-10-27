/**
 * Local-first persistent stores for everything the user owns. Each store
 * validates what it loads (see lib/workspace and lib/alerts), syncs across
 * tabs, and exposes plain action functions plus a React hook.
 *
 * Storage keys are part of CoinWave's documented data format; changing one
 * needs a migration.
 */

import { useMemo } from "react"

import {
  createPersistentStore,
  readJSON,
  useStore,
  writeJSON,
} from "@/lib/storage"
import {
  sanitizeAlertsData,
  type Alert,
  type AlertEvent,
  type AlertsData,
} from "@/lib/alerts"
import { newId } from "@/lib/portfolio"
import {
  migrateLegacyWatchlist,
  sanitizeJournal,
  sanitizeLayouts,
  sanitizeResearch,
  sanitizeScreens,
  sanitizeSettings,
  sanitizeWatchlists,
  withRevision,
  type ChartLayout,
  type Collection,
  type JournalData,
  type JournalEntry,
  type Note,
  type ResearchData,
  type SavedScreen,
  type Settings,
  type Thesis,
  type WatchlistsData,
} from "@/lib/workspace"

export const STORAGE_KEYS = {
  settings: "coinwave:settings:v1",
  watchlists: "coinwave:watchlists:v1",
  legacyWatchlist: "coinwave_watchlist",
  alerts: "coinwave:alerts:v1",
  research: "coinwave:research:v1",
  journal: "coinwave:journal:v1",
  screens: "coinwave:screens:v1",
  layouts: "coinwave:chart-layouts:v1",
  recent: "coinwave:recent:v1",
  portfolio: "coinwave:portfolio:v2",
  legacyPortfolio: "coinwave_holdings",
  theme: "theme",
} as const

// ---------------------------------------------------------------------------
// Settings

export const settingsStore = createPersistentStore<Settings>(
  STORAGE_KEYS.settings,
  () => sanitizeSettings(readJSON(STORAGE_KEYS.settings, {}))
)

export function useSettings() {
  return useStore(settingsStore)
}

export function updateSettings(patch: Partial<Settings>) {
  settingsStore.set((prev) => ({ ...prev, ...patch }))
}

// ---------------------------------------------------------------------------
// Watchlists (several named lists; the previous single list migrates in)

const DEFAULT_LIST_ID = "default"

export const watchlistsStore = createPersistentStore<WatchlistsData>(
  STORAGE_KEYS.watchlists,
  () => {
    const saved = readJSON<unknown>(STORAGE_KEYS.watchlists, null)
    if (saved) return sanitizeWatchlists(saved, DEFAULT_LIST_ID)
    const migrated = migrateLegacyWatchlist(
      readJSON(STORAGE_KEYS.legacyWatchlist, null),
      DEFAULT_LIST_ID,
      Date.now()
    )
    const data = migrated ?? sanitizeWatchlists(null, DEFAULT_LIST_ID)
    if (migrated) writeJSON(STORAGE_KEYS.watchlists, data)
    return data
  }
)

export const watchlistActions = {
  create(name: string) {
    const id = newId()
    watchlistsStore.set((d) => ({
      ...d,
      lists: [
        ...d.lists,
        {
          id,
          name: name.trim() || "Untitled list",
          createdAt: Date.now(),
          items: [],
        },
      ],
    }))
    return id
  },
  rename(id: string, name: string) {
    watchlistsStore.set((d) => ({
      ...d,
      lists: d.lists.map((l) =>
        l.id === id ? { ...l, name: name.trim() || l.name } : l
      ),
    }))
  },
  remove(id: string) {
    watchlistsStore.set((d) => {
      const lists = d.lists.filter((l) => l.id !== id)
      if (lists.length === 0) return d
      return {
        ...d,
        lists,
        defaultId: d.defaultId === id ? lists[0].id : d.defaultId,
      }
    })
  },
  setDefault(id: string) {
    watchlistsStore.set((d) => ({ ...d, defaultId: id }))
  },
  add(listId: string, assetId: string) {
    watchlistsStore.set((d) => ({
      ...d,
      lists: d.lists.map((l) =>
        l.id === listId && !l.items.some((i) => i.assetId === assetId)
          ? {
              ...l,
              items: [...l.items, { assetId, note: "", addedAt: Date.now() }],
            }
          : l
      ),
    }))
  },
  removeItem(listId: string, assetId: string) {
    watchlistsStore.set((d) => ({
      ...d,
      lists: d.lists.map((l) =>
        l.id === listId
          ? { ...l, items: l.items.filter((i) => i.assetId !== assetId) }
          : l
      ),
    }))
  },
  toggle(listId: string, assetId: string) {
    const list = watchlistsStore.get().lists.find((l) => l.id === listId)
    const has = list?.items.some((i) => i.assetId === assetId) ?? false
    if (has) watchlistActions.removeItem(listId, assetId)
    else watchlistActions.add(listId, assetId)
    return !has
  },
  setNote(listId: string, assetId: string, note: string) {
    watchlistsStore.set((d) => ({
      ...d,
      lists: d.lists.map((l) =>
        l.id === listId
          ? {
              ...l,
              items: l.items.map((i) =>
                i.assetId === assetId ? { ...i, note } : i
              ),
            }
          : l
      ),
    }))
  },
  move(listId: string, assetId: string, delta: -1 | 1) {
    watchlistsStore.set((d) => ({
      ...d,
      lists: d.lists.map((l) => {
        if (l.id !== listId) return l
        const i = l.items.findIndex((x) => x.assetId === assetId)
        const j = i + delta
        if (i < 0 || j < 0 || j >= l.items.length) return l
        const items = [...l.items]
        ;[items[i], items[j]] = [items[j], items[i]]
        return { ...l, items }
      }),
    }))
  },
  replace(data: WatchlistsData) {
    watchlistsStore.set(data)
  },
}

export function useWatchlists() {
  const data = useStore(watchlistsStore)
  return useMemo(() => {
    const defaultList =
      data.lists.find((l) => l.id === data.defaultId) ?? data.lists[0]
    const allIds = [
      ...new Set(data.lists.flatMap((l) => l.items.map((i) => i.assetId))),
    ]
    const listsFor = (assetId: string) =>
      data.lists.filter((l) => l.items.some((i) => i.assetId === assetId))
    return { ...data, defaultList, allIds, listsFor }
  }, [data])
}

// ---------------------------------------------------------------------------
// Alerts

export const alertsStore = createPersistentStore<AlertsData>(
  STORAGE_KEYS.alerts,
  () => sanitizeAlertsData(readJSON(STORAGE_KEYS.alerts, null))
)

export const alertActions = {
  create(
    alert: Omit<
      Alert,
      "id" | "createdAt" | "status" | "triggeredAt" | "triggeredValue"
    >
  ) {
    const full: Alert = {
      ...alert,
      id: newId(),
      createdAt: Date.now(),
      status: "active",
      triggeredAt: null,
      triggeredValue: null,
    }
    alertsStore.set((d) => ({ ...d, alerts: [full, ...d.alerts] }))
    return full
  },
  update(id: string, patch: Partial<Alert>) {
    alertsStore.set((d) => ({
      ...d,
      alerts: d.alerts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }))
  },
  remove(id: string) {
    alertsStore.set((d) => ({
      ...d,
      alerts: d.alerts.filter((a) => a.id !== id),
    }))
  },
  /** Re-arm a triggered or disabled alert. New observations are required to trigger it again. */
  rearm(id: string) {
    alertActions.update(id, {
      status: "active",
      createdAt: Date.now(),
      triggeredAt: null,
      triggeredValue: null,
    })
  },
  fire(fired: { alert: Alert; value: number; message: string }[], at: number) {
    if (fired.length === 0) return
    const ids = new Set(fired.map((f) => f.alert.id))
    const events: AlertEvent[] = fired.map((f) => ({
      id: newId(),
      alertId: f.alert.id,
      at,
      value: f.value,
      message: f.message,
    }))
    alertsStore.set((d) => ({
      ...d,
      alerts: d.alerts.map((a) =>
        ids.has(a.id)
          ? {
              ...a,
              status: "triggered",
              triggeredAt: at,
              triggeredValue: fired.find((f) => f.alert.id === a.id)!.value,
            }
          : a
      ),
      events: [...events, ...d.events].slice(0, 200),
    }))
  },
  /**
   * Fires alerts that are still active in the latest saved state and returns
   * those that fired. Another tab may already have fired one, so the state
   * is re-read from storage first (call this inside a cross-tab lock).
   */
  fireIfActive(
    fired: { alert: Alert; value: number; message: string }[],
    at: number
  ) {
    const saved = readJSON<unknown>(STORAGE_KEYS.alerts, null)
    if (saved) alertsStore.set(sanitizeAlertsData(saved))
    const current = alertsStore.get().alerts
    const still = fired.filter(
      (f) => current.find((a) => a.id === f.alert.id)?.status === "active"
    )
    alertActions.fire(still, at)
    return still
  },
  dismissAll() {
    alertsStore.set((d) => ({
      ...d,
      alerts: d.alerts.map((a) =>
        a.status === "triggered" ? { ...a, status: "dismissed" } : a
      ),
    }))
  },
  clearHistory() {
    alertsStore.set((d) => ({ ...d, events: [] }))
  },
  replace(data: AlertsData) {
    alertsStore.set(data)
  },
}

export function useAlerts() {
  return useStore(alertsStore)
}

// ---------------------------------------------------------------------------
// Research notes and collections

export const researchStore = createPersistentStore<ResearchData>(
  STORAGE_KEYS.research,
  () => sanitizeResearch(readJSON(STORAGE_KEYS.research, null))
)

export const researchActions = {
  createNote(
    partial: Partial<
      Omit<Note, "id" | "createdAt" | "updatedAt" | "revisions">
    > = {}
  ) {
    const now = Date.now()
    const note: Note = {
      kind: "note",
      title: "",
      body: "",
      tags: [],
      assetIds: [],
      collectionId: null,
      links: [],
      source: null,
      pinned: false,
      ...partial,
      id: newId(),
      createdAt: now,
      updatedAt: now,
      revisions: [],
    }
    researchStore.set((d) => ({ ...d, notes: [note, ...d.notes] }))
    return note
  },
  updateNote(id: string, patch: Partial<Note>) {
    researchStore.set((d) => ({
      ...d,
      notes: d.notes.map((n) => {
        if (n.id !== id) return n
        const content =
          patch.title !== undefined || patch.body !== undefined
            ? withRevision(
                n,
                { title: patch.title ?? n.title, body: patch.body ?? n.body },
                Date.now()
              )
            : { ...n, updatedAt: Date.now() }
        const rest = { ...patch }
        delete rest.title
        delete rest.body
        return { ...content, ...rest }
      }),
    }))
  },
  restoreRevision(id: string, at: number) {
    const note = researchStore.get().notes.find((n) => n.id === id)
    const rev = note?.revisions.find((r) => r.at === at)
    if (note && rev)
      researchActions.updateNote(id, { title: rev.title, body: rev.body })
  },
  removeNote(id: string) {
    const removed = researchStore.get().notes.find((n) => n.id === id) ?? null
    researchStore.set((d) => ({
      ...d,
      notes: d.notes.filter((n) => n.id !== id),
    }))
    return removed
  },
  restoreNote(note: Note) {
    researchStore.set((d) =>
      d.notes.some((n) => n.id === note.id)
        ? d
        : { ...d, notes: [note, ...d.notes] }
    )
  },
  createCollection(name: string, description = "") {
    const c: Collection = {
      id: newId(),
      name: name.trim() || "Untitled",
      description,
      createdAt: Date.now(),
    }
    researchStore.set((d) => ({ ...d, collections: [...d.collections, c] }))
    return c
  },
  renameCollection(id: string, name: string) {
    researchStore.set((d) => ({
      ...d,
      collections: d.collections.map((c) =>
        c.id === id ? { ...c, name: name.trim() || c.name } : c
      ),
    }))
  },
  removeCollection(id: string) {
    researchStore.set((d) => ({
      collections: d.collections.filter((c) => c.id !== id),
      notes: d.notes.map((n) =>
        n.collectionId === id ? { ...n, collectionId: null } : n
      ),
      version: 1,
    }))
  },
  replace(data: ResearchData) {
    researchStore.set(data)
  },
}

export function useResearch() {
  return useStore(researchStore)
}

// ---------------------------------------------------------------------------
// Theses and decision journal

export const journalStore = createPersistentStore<JournalData>(
  STORAGE_KEYS.journal,
  () => sanitizeJournal(readJSON(STORAGE_KEYS.journal, null))
)

export const journalActions = {
  create(partial: Partial<Thesis> = {}) {
    const now = Date.now()
    const thesis: Thesis = {
      title: "",
      assetIds: [],
      stance: "neutral",
      status: "draft",
      summary: "",
      assumptions: [],
      catalysts: [],
      risks: [],
      invalidation: [],
      monitoring: "",
      reviewBy: null,
      alertIds: [],
      watchlistId: null,
      lessons: "",
      entries: [],
      ...partial,
      id: newId(),
      createdAt: now,
      updatedAt: now,
    }
    journalStore.set((d) => ({ ...d, theses: [thesis, ...d.theses] }))
    return thesis
  },
  update(id: string, patch: Partial<Thesis>) {
    journalStore.set((d) => ({
      ...d,
      theses: d.theses.map((t) =>
        t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t
      ),
    }))
  },
  remove(id: string) {
    const removed = journalStore.get().theses.find((t) => t.id === id) ?? null
    journalStore.set((d) => ({
      ...d,
      theses: d.theses.filter((t) => t.id !== id),
    }))
    return removed
  },
  restore(thesis: Thesis) {
    journalStore.set((d) =>
      d.theses.some((t) => t.id === thesis.id)
        ? d
        : { ...d, theses: [thesis, ...d.theses] }
    )
  },
  addEntry(thesisId: string, entry: Omit<JournalEntry, "id">) {
    const full: JournalEntry = { ...entry, id: newId() }
    journalStore.set((d) => ({
      ...d,
      theses: d.theses.map((t) =>
        t.id === thesisId
          ? {
              ...t,
              updatedAt: Date.now(),
              entries: [...t.entries, full].sort((a, b) => a.at - b.at),
            }
          : t
      ),
    }))
    return full
  },
  updateEntry(thesisId: string, entryId: string, patch: Partial<JournalEntry>) {
    journalStore.set((d) => ({
      ...d,
      theses: d.theses.map((t) =>
        t.id === thesisId
          ? {
              ...t,
              updatedAt: Date.now(),
              entries: t.entries.map((e) =>
                e.id === entryId ? { ...e, ...patch } : e
              ),
            }
          : t
      ),
    }))
  },
  removeEntry(thesisId: string, entryId: string) {
    journalStore.set((d) => ({
      ...d,
      theses: d.theses.map((t) =>
        t.id === thesisId
          ? { ...t, entries: t.entries.filter((e) => e.id !== entryId) }
          : t
      ),
    }))
  },
  replace(data: JournalData) {
    journalStore.set(data)
  },
}

export function useJournal() {
  return useStore(journalStore)
}

// ---------------------------------------------------------------------------
// Saved screens, chart layouts, recently viewed assets

export const screensStore = createPersistentStore<SavedScreen[]>(
  STORAGE_KEYS.screens,
  () => sanitizeScreens(readJSON(STORAGE_KEYS.screens, []))
)

export function useSavedScreens() {
  return useStore(screensStore)
}

export const layoutsStore = createPersistentStore<ChartLayout[]>(
  STORAGE_KEYS.layouts,
  () => sanitizeLayouts(readJSON(STORAGE_KEYS.layouts, []))
)

export function useChartLayouts() {
  return useStore(layoutsStore)
}

export const recentStore = createPersistentStore<string[]>(
  STORAGE_KEYS.recent,
  () => {
    const raw = readJSON<unknown>(STORAGE_KEYS.recent, [])
    return Array.isArray(raw)
      ? raw.filter((x): x is string => typeof x === "string").slice(0, 12)
      : []
  }
)

export function rememberAsset(assetId: string) {
  recentStore.set((prev) =>
    [assetId, ...prev.filter((x) => x !== assetId)].slice(0, 12)
  )
}

export function useRecentAssets() {
  return useStore(recentStore)
}
