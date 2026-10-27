import { describe, expect, it } from "vitest"

import {
  DASH,
  direction,
  formatAge,
  formatCompactMoney,
  formatDate,
  formatMoney,
  formatPercent,
  formatPrice,
  formatQuantity,
  parseAmount,
} from "./format"

describe("formatPrice", () => {
  it("uses cents at or above $1", () => {
    expect(formatPrice(67123.456)).toBe("$67,123.46")
    expect(formatPrice(1)).toBe("$1.00")
  })

  it("keeps significant digits below $1", () => {
    expect(formatPrice(0.1234567)).toBe("$0.1235")
    expect(formatPrice(0.00001234)).toBe("$0.00001234")
    expect(formatPrice(0.5)).toBe("$0.50")
  })

  it("renders missing values as a dash, not zero", () => {
    expect(formatPrice(null)).toBe(DASH)
    expect(formatPrice(undefined)).toBe(DASH)
    expect(formatPrice(Number.NaN)).toBe(DASH)
    expect(formatPrice(0)).toBe("$0.00")
  })
})

describe("formatMoney", () => {
  it("signs with a true minus", () => {
    expect(formatMoney(-1234.5)).toBe("−$1,234.50")
    expect(formatMoney(1234.5, { signed: true })).toBe("+$1,234.50")
    expect(formatMoney(0, { signed: true })).toBe("$0.00")
  })

  it("does not round a tiny loss to $0.00", () => {
    expect(formatMoney(-0.004)).toBe("−$0.004")
  })
})

describe("formatCompactMoney", () => {
  it("abbreviates large aggregates", () => {
    expect(formatCompactMoney(2_410_000_000_000)).toBe("$2.41T")
    expect(formatCompactMoney(98_400_000_000)).toBe("$98.40B")
    expect(formatCompactMoney(512_300_000)).toBe("$512.30M")
  })

  it("keeps small amounts exact", () => {
    expect(formatCompactMoney(12_345)).toBe("$12,345")
  })
})

describe("formatPercent", () => {
  it("signs changes", () => {
    expect(formatPercent(1.234)).toBe("+1.23%")
    expect(formatPercent(-0.4)).toBe("−0.40%")
  })

  it("never shows negative zero", () => {
    expect(formatPercent(-0.001)).toBe("0.00%")
    expect(formatPercent(0)).toBe("0.00%")
  })

  it("dashes missing values", () => {
    expect(formatPercent(null)).toBe(DASH)
  })
})

describe("misc", () => {
  it("formats quantities with sensible precision", () => {
    expect(formatQuantity(0.123456789)).toBe("0.12345679")
    expect(formatQuantity(12.3456789)).toBe("12.3457")
    expect(formatQuantity(1234567.891)).toBe("1,234,567.89")
  })

  it("classifies direction with a dead zone", () => {
    expect(direction(0.001)).toBe("flat")
    expect(direction(0.2)).toBe("up")
    expect(direction(-0.2)).toBe("down")
    expect(direction(null)).toBe("flat")
  })

  it("describes data age", () => {
    const now = 1_000_000_000
    expect(formatAge(now - 5_000, now)).toBe("just now")
    expect(formatAge(now - 3 * 60_000, now)).toBe("3 min. ago")
    expect(formatAge(null, now)).toBe(DASH)
  })

  it("treats bare dates as local calendar dates", () => {
    expect(formatDate("2024-01-15")).toBe("Jan 15, 2024")
    expect(formatDate(null)).toBe(DASH)
    expect(formatDate("nonsense")).toBe(DASH)
  })
})

describe("parseAmount", () => {
  it("accepts plain and US-grouped numbers", () => {
    expect(parseAmount("0.5")).toBe(0.5)
    expect(parseAmount(".5")).toBe(0.5)
    expect(parseAmount("12")).toBe(12)
    expect(parseAmount(" 1,234.56 ")).toBe(1234.56)
    expect(parseAmount("$61,250")).toBe(61250)
  })

  it("rejects ambiguous or invalid input instead of guessing", () => {
    // "0,5" must not become 5.
    expect(parseAmount("0,5")).toBeNaN()
    expect(parseAmount("1,23")).toBeNaN()
    expect(parseAmount("-1")).toBeNaN()
    expect(parseAmount("1e5")).toBeNaN()
    expect(parseAmount("abc")).toBeNaN()
    expect(parseAmount("")).toBeNaN()
  })
})
