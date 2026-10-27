/**
 * Glue between the backup format (lib/backup) and the live stores: read the
 * whole workspace, write one section back, and measure what is stored.
 */

import { SNAPSHOT_PREFIX } from "@/hooks/queries"
import { portfolioActions } from "@/hooks/use-portfolio"
import { sanitizeAlertsData } from "@/lib/alerts"
import type { BackupData, SectionId } from "@/lib/backup"
import {
  DEFAULT_SETTINGS,
  sanitizeJournal,
  sanitizeResearch,
  sanitizeWatchlists,
} from "@/lib/workspace"
import {
  STORAGE_KEYS,
  alertsStore,
  journalStore,
  layoutsStore,
  researchStore,
  screensStore,
  settingsStore,
  watchlistsStore,
} from "@/stores"

export function snapshotWorkspace(): BackupData {
  return {
    settings: settingsStore.get(),
    portfolio: portfolioActions.get(),
    watchlists: watchlistsStore.get(),
    alerts: alertsStore.get(),
    research: researchStore.get(),
    journal: journalStore.get(),
    screens: screensStore.get(),
    layouts: layoutsStore.get(),
  }
}

export function writeSection<K extends SectionId>(id: K, value: BackupData[K]) {
  const v = value as BackupData[SectionId]
  switch (id) {
    case "settings":
      return settingsStore.set(v as BackupData["settings"])
    case "portfolio":
      return portfolioActions.replace(v as BackupData["portfolio"])
    case "watchlists":
      return watchlistsStore.set(v as BackupData["watchlists"])
    case "alerts":
      return alertsStore.set(v as BackupData["alerts"])
    case "research":
      return researchStore.set(v as BackupData["research"])
    case "journal":
      return journalStore.set(v as BackupData["journal"])
    case "screens":
      return screensStore.set(v as BackupData["screens"])
    case "layouts":
      return layoutsStore.set(v as BackupData["layouts"])
  }
}

/** What a section looks like when it holds nothing. */
export function emptySection<K extends SectionId>(id: K): BackupData[K] {
  const empty: BackupData = {
    settings: DEFAULT_SETTINGS,
    portfolio: { version: 2, transactions: [], sample: false },
    watchlists: sanitizeWatchlists(null, "default"),
    alerts: sanitizeAlertsData(null),
    research: sanitizeResearch(null),
    journal: sanitizeJournal(null),
    screens: [],
    layouts: [],
  }
  return empty[id]
}

const SECTION_KEYS: Record<SectionId, string[]> = {
  settings: [STORAGE_KEYS.settings],
  portfolio: [STORAGE_KEYS.portfolio],
  watchlists: [STORAGE_KEYS.watchlists],
  alerts: [STORAGE_KEYS.alerts],
  research: [STORAGE_KEYS.research],
  journal: [STORAGE_KEYS.journal],
  screens: [STORAGE_KEYS.screens],
  layouts: [STORAGE_KEYS.layouts],
}

/** Bytes used in localStorage, per section, plus cached market data. */
export function storageUsage() {
  const sizeOf = (key: string) => {
    try {
      const v = window.localStorage.getItem(key)
      // UTF-16: two bytes per code unit is how browsers count the quota.
      return v === null ? 0 : (key.length + v.length) * 2
    } catch {
      return 0
    }
  }
  const sections = Object.fromEntries(
    (Object.keys(SECTION_KEYS) as SectionId[]).map((id) => [
      id,
      SECTION_KEYS[id].reduce((n, k) => n + sizeOf(k), 0),
    ])
  ) as Record<SectionId, number>
  let cache = 0
  let total = 0
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (!key) continue
      const size = sizeOf(key)
      total += size
      if (key.startsWith(SNAPSHOT_PREFIX)) cache += size
    }
  } catch {
    // Storage unavailable.
  }
  return { sections, cache, total }
}
