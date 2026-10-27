import { useEffect, useState } from "react"

import { useUniverse } from "@/hooks/queries"
import { useNow } from "@/hooks/use-ui"
import { useSettings } from "@/stores"

export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener("online", on)
    window.addEventListener("offline", off)
    return () => {
      window.removeEventListener("online", on)
      window.removeEventListener("offline", off)
    }
  }, [])
  return online
}

export type FreshnessState =
  | "loading"
  | "fresh"
  | "delayed"
  | "offline"
  | "unavailable"
  | "paused"

/** Freshness of the market universe: the data most of CoinWave shows. */
export function useFreshness() {
  const universe = useUniverse()
  const { refreshInterval } = useSettings()
  const online = useOnline()
  const now = useNow(10_000)
  const updatedAt = universe.dataUpdatedAt || null
  const age = updatedAt ? now - updatedAt : Infinity
  const failing = universe.isError || universe.failureCount > 0
  const budget = (refreshInterval || 600) * 1000 * 2 + 60_000
  let state: FreshnessState
  if (!online) state = "offline"
  else if (!universe.data) state = failing ? "unavailable" : "loading"
  else if (failing || age > budget) state = "delayed"
  else if (refreshInterval === 0) state = "paused"
  else state = "fresh"
  return {
    state,
    updatedAt,
    now,
    error: universe.failureReason,
    refetch: () => universe.refetch(),
  }
}
