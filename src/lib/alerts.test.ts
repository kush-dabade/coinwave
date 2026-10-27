import { describe, expect, it } from "vitest"

import {
  alertDistance,
  conditionMet,
  describeAlert,
  evaluateAlerts,
  formatDistance,
  sanitizeAlertsData,
  type Alert,
} from "./alerts"

const alert = (partial: Partial<Alert>): Alert => ({
  id: "a1",
  kind: "price_above",
  assetId: "bitcoin",
  symbol: "BTC",
  name: "Bitcoin",
  threshold: 100,
  period: null,
  status: "active",
  note: "",
  thesisId: null,
  createdAt: 1_000,
  triggeredAt: null,
  triggeredValue: null,
  ...partial,
})

const quote = (price: number | null, change24h: number | null = null) => ({
  price,
  change1h: null,
  change24h,
  change7d: null,
  volume24h: null,
})

describe("conditionMet", () => {
  it("compares inclusively and never triggers on unknown data", () => {
    expect(
      conditionMet(alert({ kind: "price_above", threshold: 100 }), 100)
    ).toBe(true)
    expect(
      conditionMet(alert({ kind: "price_below", threshold: 100 }), 100.01)
    ).toBe(false)
    expect(conditionMet(alert({ kind: "price_above" }), null)).toBe(false)
    expect(conditionMet(alert({ kind: "price_above" }), Number.NaN)).toBe(false)
  })
})

describe("evaluateAlerts", () => {
  const ctx = (observedAt: number, price: number | null) => ({
    observedAt,
    quote: () => quote(price),
    portfolioValue: null,
  })

  it("ignores data observed before (or when) the alert was created", () => {
    expect(evaluateAlerts([alert({})], ctx(1_000, 150))).toEqual([])
    expect(evaluateAlerts([alert({})], ctx(999, 150))).toEqual([])
    expect(evaluateAlerts([alert({})], ctx(1_001, 150))).toHaveLength(1)
  })

  it("only checks active alerts", () => {
    const list = [
      alert({ id: "p", status: "disabled" }),
      alert({ id: "t", status: "triggered" }),
      alert({ id: "a" }),
    ]
    expect(
      evaluateAlerts(list, ctx(2_000, 150)).map((f) => f.alert.id)
    ).toEqual(["a"])
  })

  it("uses the configured change period", () => {
    const a = alert({ kind: "change_below", threshold: -5, period: "24h" })
    const fired = evaluateAlerts([a], {
      observedAt: 2_000,
      quote: () => quote(90, -6.2),
      portfolioValue: null,
    })
    expect(fired).toEqual([{ alert: a, value: -6.2 }])
  })

  it("evaluates portfolio alerts against portfolio value only", () => {
    const a = alert({
      kind: "portfolio_below",
      assetId: null,
      threshold: 10_000,
    })
    expect(
      evaluateAlerts([a], {
        observedAt: 2_000,
        quote: () => null,
        portfolioValue: 9_500,
      })
    ).toHaveLength(1)
    expect(
      evaluateAlerts([a], {
        observedAt: 2_000,
        quote: () => null,
        portfolioValue: null,
      })
    ).toHaveLength(0)
  })
})

describe("alertDistance", () => {
  it("is the % move needed for level alerts and the pp gap for change alerts", () => {
    expect(alertDistance(alert({ threshold: 110 }), 100)).toEqual({
      value: 10,
      unit: "%",
    })
    expect(
      alertDistance(alert({ kind: "price_below", threshold: 50 }), 80)?.value
    ).toBeCloseTo(-37.5)
    expect(
      alertDistance(alert({ kind: "change_above", threshold: 10 }), 4)
    ).toEqual({ value: 6, unit: "pp" })
    expect(alertDistance(alert({}), null)).toBeNull()
    expect(formatDistance({ value: -37.5, unit: "%" })).toBe("−37.5%")
    expect(formatDistance({ value: 6, unit: "pp" })).toBe("+6.0 pp")
  })
})

describe("describeAlert and sanitize", () => {
  it("describes conditions in words", () => {
    expect(
      describeAlert(
        alert({ kind: "change_above", threshold: 10, period: "7d" })
      )
    ).toBe("Bitcoin 7d change at or above +10.00%")
  })

  it("drops malformed alerts and asset alerts without an asset", () => {
    const data = sanitizeAlertsData({
      alerts: [
        alert({}),
        { id: "x", kind: "teleport", threshold: 1 },
        { ...alert({ id: "y" }), assetId: null },
        { ...alert({ id: "z" }), status: "weird" },
      ],
      events: [
        { id: "e", alertId: "a1", at: 5, value: 1, message: "ok" },
        { id: 3 },
      ],
    })
    expect(data.alerts.map((a) => [a.id, a.status])).toEqual([
      ["a1", "active"],
      ["z", "active"],
    ])
    expect(data.events).toHaveLength(1)
  })
})
