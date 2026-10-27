/** Shared table styling: dense rows, hairline separators, sticky header. */
export const T = {
  table: "w-full border-collapse text-[0.8125rem]",
  thead: "sticky top-0 z-[1] bg-surface",
  th: "h-8 px-2 text-[0.6875rem] font-semibold tracking-[0.04em] whitespace-nowrap text-ink-3 uppercase first:pl-3 last:pr-3",
  tr: "border-t border-rule",
  trHover: "border-t border-rule transition-colors hover:bg-surface-2/70",
  td: "h-9 px-2 whitespace-nowrap first:pl-3 last:pr-3",
}

/** Toggle helper: same key flips direction, a new key starts at its natural direction. */
export function nextSort<K extends string>(
  current: { key: K; dir: "asc" | "desc" },
  key: K,
  natural: "asc" | "desc" = "desc"
) {
  return key === current.key
    ? { key, dir: current.dir === "asc" ? ("desc" as const) : ("asc" as const) }
    : { key, dir: natural }
}
