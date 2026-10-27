import { useSyncExternalStore } from "react"

/**
 * localStorage can throw (private mode, disabled storage, quota) and can hold
 * anything a previous version of the app wrote. Every access goes through
 * these helpers so a bad value degrades to the fallback instead of crashing.
 */
export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function writeJSON(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function removeKey(key: string) {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Storage unavailable: nothing to remove.
  }
}

export type PersistentStore<T> = {
  get: () => T
  set: (next: T | ((prev: T) => T)) => void
  subscribe: (listener: () => void) => () => void
  /** True when the last write could not be persisted (e.g. private mode). */
  isVolatile: () => boolean
}

/**
 * A tiny external store backed by localStorage.
 *
 * State is read once at creation (no effect-time hydration, so StrictMode's
 * double effects cannot overwrite saved data with an empty default) and kept
 * in sync across tabs through the `storage` event.
 */
export function createPersistentStore<T>(
  key: string,
  load: () => T
): PersistentStore<T> {
  let state = load()
  let volatile = false
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((listener) => listener())

  if (typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
      if (event.key !== key) return
      state = load()
      emit()
    })
  }

  return {
    get: () => state,
    set(next) {
      state =
        typeof next === "function" ? (next as (prev: T) => T)(state) : next
      volatile = !writeJSON(key, state)
      emit()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    isVolatile: () => volatile,
  }
}

export function useStore<T>(store: PersistentStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get)
}
