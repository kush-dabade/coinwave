import { useEffect, useRef, useState } from "react"

/** A clock that re-renders the caller every `interval` ms (for "3 min ago"). */
export function useNow(interval = 15_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), interval)
    return () => window.clearInterval(id)
  }, [interval])
  return now
}

export function useDebounced<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(id)
  }, [value, delay])
  return debounced
}

export function usePageTitle(title: string | null) {
  useEffect(() => {
    document.title = title ? `${title} · CoinWave` : "CoinWave"
  }, [title])
}

/**
 * Returns "tick-up" / "tick-down" briefly after `value` changes, so a cell can
 * flash to show it just updated. Returns "" on first render and when unchanged.
 */
export function useTick(value: number | null | undefined) {
  const previous = useRef(value)
  const [tick, setTick] = useState<{ cls: string; key: number }>({
    cls: "",
    key: 0,
  })
  useEffect(() => {
    const prev = previous.current
    previous.current = value
    if (typeof prev !== "number" || typeof value !== "number" || prev === value)
      return
    setTick((t) => ({
      cls: value > prev ? "tick-up" : "tick-down",
      key: t.key + 1,
    }))
  }, [value])
  return tick
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [query])
  return matches
}

/** Size of an element's content box, tracked with ResizeObserver. */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: Math.floor(entry.contentRect.width),
        height: Math.floor(entry.contentRect.height),
      })
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, size] as const
}
