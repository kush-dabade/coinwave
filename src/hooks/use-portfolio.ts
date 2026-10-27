import { useMemo } from "react"

import {
  createPersistentStore,
  readJSON,
  useStore,
  writeJSON,
} from "@/lib/storage"
import {
  migrateLegacyHoldings,
  sampleTransactions,
  sanitizeTransaction,
  type PortfolioData,
  type Transaction,
} from "@/lib/portfolio"

const KEY = "coinwave:portfolio:v2"
/** Holdings saved by the previous version. Read once, never deleted. */
const LEGACY_KEY = "coinwave_holdings"

function load(): PortfolioData {
  const saved = readJSON<Partial<PortfolioData> | null>(KEY, null)
  if (saved && Array.isArray(saved.transactions)) {
    return {
      version: 2,
      transactions: saved.transactions
        .map(sanitizeTransaction)
        .filter((t): t is Transaction => t !== null),
      sample: saved.sample === true,
    }
  }
  const migrated = migrateLegacyHoldings(readJSON<unknown>(LEGACY_KEY, null))
  const data: PortfolioData = {
    version: 2,
    transactions: migrated,
    sample: false,
  }
  // Persist the migration so transaction ids stay stable across reloads.
  if (migrated.length > 0) writeJSON(KEY, data)
  return data
}

const store = createPersistentStore<PortfolioData>(KEY, load)

export const portfolioActions = {
  add(tx: Transaction) {
    store.set((prev) => ({ ...prev, transactions: [...prev.transactions, tx] }))
  },
  update(tx: Transaction) {
    store.set((prev) => ({
      ...prev,
      transactions: prev.transactions.map((t) => (t.id === tx.id ? tx : t)),
    }))
  },
  remove(id: string): Transaction | null {
    const removed = store.get().transactions.find((t) => t.id === id) ?? null
    store.set((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== id),
    }))
    return removed
  },
  restore(tx: Transaction) {
    store.set((prev) =>
      prev.transactions.some((t) => t.id === tx.id)
        ? prev
        : { ...prev, transactions: [...prev.transactions, tx] }
    )
  },
  loadSample() {
    store.set({ version: 2, transactions: sampleTransactions(), sample: true })
  },
  clear() {
    store.set({ version: 2, transactions: [], sample: false })
  },
  /** Restore a previous state wholesale (undo for "clear"). */
  replace(data: PortfolioData) {
    store.set(data)
  },
  get: () => store.get(),
}

export function usePortfolio() {
  const data = useStore(store)
  const heldIds = useMemo(
    () => [...new Set(data.transactions.map((t) => t.assetId))],
    [data.transactions]
  )
  return { ...data, heldIds, isVolatile: store.isVolatile() }
}
