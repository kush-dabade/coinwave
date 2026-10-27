import { describe, expect, it } from "vitest"

import {
  downsample,
  nearestIndex,
  niceTicks,
  timeTicks,
  type Point,
} from "./chart"
import { squarify } from "./treemap"

describe("niceTicks", () => {
  it("produces round steps inside the domain", () => {
    expect(niceTicks(61234, 68877, 4)).toEqual([62000, 64000, 66000, 68000])
    expect(niceTicks(0.1, 0.42, 4)).toEqual([0.1, 0.2, 0.3, 0.4])
  })

  it("handles a flat series", () => {
    const ticks = niceTicks(1, 1, 4)
    expect(ticks.length).toBeGreaterThan(0)
    expect(ticks.every(Number.isFinite)).toBe(true)
  })
})

describe("downsample", () => {
  const series: Point[] = Array.from({ length: 1000 }, (_, i) => ({
    t: i,
    p: Math.sin(i / 20),
  }))
  series[500] = { t: 500, p: 50 }

  it("respects the limit and keeps endpoints", () => {
    const out = downsample(series, 200)
    expect(out.length).toBeLessThanOrEqual(200)
    expect(out[0]).toBe(series[0])
    expect(out[out.length - 1]).toBe(series[999])
  })

  it("preserves extremes and time order", () => {
    const out = downsample(series, 200)
    expect(out.some((p) => p.p === 50)).toBe(true)
    for (let i = 1; i < out.length; i++)
      expect(out[i].t).toBeGreaterThan(out[i - 1].t)
  })

  it("returns short series unchanged", () => {
    expect(downsample(series.slice(0, 10), 200)).toHaveLength(10)
  })
})

describe("nearestIndex", () => {
  const pts: Point[] = [0, 10, 20, 30].map((t) => ({ t, p: t }))
  it("finds the closest point", () => {
    expect(nearestIndex(pts, -5)).toBe(0)
    expect(nearestIndex(pts, 14)).toBe(1)
    expect(nearestIndex(pts, 16)).toBe(2)
    expect(nearestIndex(pts, 99)).toBe(3)
  })
})

describe("timeTicks", () => {
  it("aligns to calendar boundaries and fits the budget", () => {
    const t0 = new Date(2026, 9, 19, 13, 17).getTime()
    const t1 = new Date(2026, 9, 26, 13, 17).getTime()
    const ticks = timeTicks(t0, t1, 7)
    expect(ticks.length).toBeGreaterThan(2)
    expect(ticks.length).toBeLessThanOrEqual(8)
    for (const tick of ticks) {
      expect(new Date(tick.t).getHours()).toBe(0)
      expect(tick.t).toBeGreaterThanOrEqual(t0)
      expect(tick.t).toBeLessThanOrEqual(t1)
    }
  })

  it("labels a year with months and marks January with the year", () => {
    const t0 = new Date(2025, 9, 26).getTime()
    const t1 = new Date(2026, 9, 26).getTime()
    const labels = timeTicks(t0, t1, 12).map((t) => t.label)
    expect(labels).toContain("2026")
  })
})

describe("squarify", () => {
  it("fills the area proportionally", () => {
    const items = [6, 6, 4, 3, 2, 2, 1]
    const rects = squarify(items, (v) => v, 600, 400)
    expect(rects).toHaveLength(items.length)
    const total = items.reduce((a, b) => a + b, 0)
    for (const r of rects) {
      expect(r.w * r.h).toBeCloseTo((r.item / total) * 600 * 400, 5)
      expect(r.x).toBeGreaterThanOrEqual(-1e-9)
      expect(r.y).toBeGreaterThanOrEqual(-1e-9)
      expect(r.x + r.w).toBeLessThanOrEqual(600 + 1e-6)
      expect(r.y + r.h).toBeLessThanOrEqual(400 + 1e-6)
    }
  })

  it("skips non-positive values", () => {
    expect(squarify([0, -1, Number.NaN, 5], (v) => v, 100, 100)).toHaveLength(1)
    expect(squarify([], (v: number) => v, 100, 100)).toEqual([])
  })
})
