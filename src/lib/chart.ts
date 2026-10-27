/**
 * Small, dependency-free helpers behind CoinWave's SVG charts.
 */

export type Point = { t: number; p: number }

/** Axis values at "nice" round steps (1, 2, 2.5, 5 × 10^n) covering [min, max]. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return []
  if (min === max) {
    const pad = Math.abs(min) * 0.01 || 1
    min -= pad
    max += pad
  }
  const rough = (max - min) / Math.max(1, count)
  const power = 10 ** Math.floor(Math.log10(rough))
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= rough) ??
    10 * power
  const start = Math.ceil(min / step) * step
  const ticks: number[] = []
  for (let v = start; v <= max + step * 1e-9; v += step) {
    // Avoid binary float artefacts such as 0.30000000000000004.
    ticks.push(Number(v.toPrecision(12)))
  }
  return ticks
}

/**
 * Reduce a series to at most `max` points while keeping each bucket's
 * minimum and maximum, so spikes and dips survive the downsampling.
 */
export function downsample(points: Point[], max: number): Point[] {
  if (points.length <= max || max < 4) return points
  const buckets = Math.floor((max - 2) / 2)
  const size = (points.length - 2) / buckets
  const out: Point[] = [points[0]]
  for (let b = 0; b < buckets; b++) {
    const from = 1 + Math.floor(b * size)
    const to = Math.min(points.length - 1, 1 + Math.floor((b + 1) * size))
    let lo = points[from]
    let hi = points[from]
    for (let i = from; i < to; i++) {
      if (points[i].p < lo.p) lo = points[i]
      if (points[i].p > hi.p) hi = points[i]
    }
    if (lo === hi) out.push(lo)
    else if (lo.t < hi.t) out.push(lo, hi)
    else out.push(hi, lo)
  }
  out.push(points[points.length - 1])
  return out
}

export function linePath(xs: number[], ys: number[]) {
  let d = ""
  for (let i = 0; i < xs.length; i++) {
    d += `${i === 0 ? "M" : "L"}${xs[i].toFixed(1)} ${ys[i].toFixed(1)}`
  }
  return d
}

/** Index of the point whose time is closest to `t` (points sorted by t). */
export function nearestIndex(points: Point[], t: number) {
  let lo = 0
  let hi = points.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (points[mid].t < t) lo = mid
    else hi = mid
  }
  return Math.abs(points[lo].t - t) <= Math.abs(points[hi].t - t) ? lo : hi
}

const HOUR = 3_600_000
const DAY = 24 * HOUR

type Interval = { kind: "hour" | "day" | "month"; step: number }

const INTERVALS: Interval[] = [
  { kind: "hour", step: 1 },
  { kind: "hour", step: 2 },
  { kind: "hour", step: 3 },
  { kind: "hour", step: 6 },
  { kind: "hour", step: 12 },
  { kind: "day", step: 1 },
  { kind: "day", step: 2 },
  { kind: "day", step: 3 },
  { kind: "day", step: 5 },
  { kind: "day", step: 7 },
  { kind: "day", step: 14 },
  { kind: "month", step: 1 },
  { kind: "month", step: 2 },
  { kind: "month", step: 3 },
  { kind: "month", step: 6 },
]

function approxMs(i: Interval) {
  return i.kind === "hour"
    ? i.step * HOUR
    : i.kind === "day"
      ? i.step * DAY
      : i.step * 30 * DAY
}

function ticksFor(i: Interval, t0: number, t1: number): number[] {
  const out: number[] = []
  const d = new Date(t0)
  if (i.kind === "hour") {
    d.setMinutes(0, 0, 0)
    d.setHours(
      Math.ceil((d.getHours() + (d.getTime() < t0 ? 1 : 0)) / i.step) * i.step
    )
    while (d.getTime() <= t1) {
      if (d.getTime() >= t0) out.push(d.getTime())
      d.setHours(d.getHours() + i.step)
    }
  } else if (i.kind === "day") {
    d.setHours(0, 0, 0, 0)
    if (d.getTime() < t0) d.setDate(d.getDate() + 1)
    while (d.getTime() <= t1) {
      out.push(d.getTime())
      d.setDate(d.getDate() + i.step)
    }
  } else {
    d.setHours(0, 0, 0, 0)
    d.setDate(1)
    if (d.getTime() < t0) d.setMonth(d.getMonth() + 1)
    while (d.getMonth() % i.step !== 0) d.setMonth(d.getMonth() + 1)
    while (d.getTime() <= t1) {
      out.push(d.getTime())
      d.setMonth(d.getMonth() + i.step)
    }
  }
  return out
}

const fmtHour = new Intl.DateTimeFormat("en-US", { hour: "numeric" })
const fmtDay = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
})
const fmtMonth = new Intl.DateTimeFormat("en-US", { month: "short" })

/** Calendar-aligned time axis ticks that fit roughly `maxTicks` labels. */
export function timeTicks(t0: number, t1: number, maxTicks: number) {
  const span = t1 - t0
  if (!(span > 0)) return []
  const interval =
    INTERVALS.find((i) => span / approxMs(i) <= Math.max(2, maxTicks)) ??
    INTERVALS[INTERVALS.length - 1]
  return ticksFor(interval, t0, t1).map((t) => {
    const date = new Date(t)
    let label: string
    if (interval.kind === "hour") {
      label = date.getHours() === 0 ? fmtDay.format(date) : fmtHour.format(date)
    } else if (interval.kind === "day") {
      label = fmtDay.format(date)
    } else {
      label =
        date.getMonth() === 0
          ? String(date.getFullYear())
          : fmtMonth.format(date)
    }
    return { t, label }
  })
}
