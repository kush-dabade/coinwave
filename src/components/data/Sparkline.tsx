import { memo } from "react"

import { cn } from "@/lib/utils"

/**
 * A minimal trend line. Decorative by design (aria-hidden): the change it
 * illustrates is always printed as a number alongside it.
 */
function SparklineImpl({
  values,
  width = 96,
  height = 28,
  className,
}: {
  values: number[]
  width?: number
  height?: number
  className?: string
}) {
  if (values.length < 2) {
    return (
      <span
        aria-hidden="true"
        className={cn("inline-block", className)}
        style={{ width, height }}
      />
    )
  }
  let min = Infinity
  let max = -Infinity
  for (const v of values) {
    if (v < min) min = v
    if (v > max) max = v
  }
  // A floor of 2% of the price on the vertical range keeps tiny moves (a
  // stablecoin's 0.01% wiggle) flat instead of magnifying noise into swings.
  const floor = Math.abs((max + min) / 2) * 0.02
  if (max - min < floor) {
    const mid = (max + min) / 2
    min = mid - floor / 2
    max = mid + floor / 2
  }
  const pad = 2
  const span = max - min || 1
  const step = (width - pad * 2) / (values.length - 1)
  let d = ""
  values.forEach((v, i) => {
    const x = pad + i * step
    const y = pad + (1 - (v - min) / span) * (height - pad * 2)
    d += `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`
  })
  const first = values[0]
  const last = values[values.length - 1]
  const color =
    last > first ? "var(--up)" : last < first ? "var(--down)" : "var(--ink-3)"
  const baseY = pad + (1 - (first - min) / span) * (height - pad * 2)

  return (
    <svg
      aria-hidden="true"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("block shrink-0 overflow-visible", className)}
    >
      <line
        x1={pad}
        x2={width - pad}
        y1={baseY}
        y2={baseY}
        stroke="var(--rule-strong)"
        strokeWidth={1}
      />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

export const Sparkline = memo(SparklineImpl)
