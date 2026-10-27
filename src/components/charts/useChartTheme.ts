import { useMemo } from "react"

import { useTheme } from "@/components/theme-provider"

export type ChartTheme = {
  bg: string
  text: string
  muted: string
  grid: string
  rule: string
  up: string
  down: string
  ink: string
  accent: string
  warn: string
  series: string[]
}

function read(name: string) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
}

/** Canvas charts cannot read CSS variables; resolve them per theme. */
export function useChartTheme(): ChartTheme {
  const { resolvedTheme } = useTheme()
  return useMemo(
    () => ({
      bg: read("--surface"),
      text: read("--ink-2"),
      muted: read("--ink-3"),
      grid: read("--chart-grid"),
      rule: read("--rule-strong"),
      up: read("--up"),
      down: read("--down"),
      ink: read("--ink"),
      accent: read("--accent"),
      warn: read("--warn"),
      series: [1, 2, 3, 4, 5, 6].map((i) => read(`--series-${i}`)),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- values come from the DOM and change with the theme class
    [resolvedTheme]
  )
}

/** Hex colour with alpha, for translucent fills. */
export function alpha(hex: string, a: number) {
  const h = hex.replace("#", "")
  if (h.length !== 6) return hex
  const n = parseInt(h, 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}
