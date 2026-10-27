/**
 * Formatting rules shared by every figure in CoinWave.
 *
 * - Missing or non-finite values render as an em dash, never as 0.
 * - Prices >= $1 use cents; prices below $1 keep four significant digits so
 *   that $0.00001234 does not collapse to $0.00.
 * - Signed values use a true minus sign (U+2212) so columns of figures align.
 * - Everything is USD; the unit is part of the formatted string.
 */

export const DASH = "—"
const MINUS = "−"
const LOCALE = "en-US"

export function isNum(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

const usd2 = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const usdSig = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "USD",
  minimumSignificantDigits: 2,
  maximumSignificantDigits: 4,
})

const usdSigMoney = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "USD",
  minimumSignificantDigits: 1,
  maximumSignificantDigits: 2,
})

const usdCompact = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "USD",
  notation: "compact",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const usdWhole = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

function withSign(text: string, value: number, signed: boolean) {
  if (value < 0) return MINUS + text
  if (signed && value > 0) return "+" + text
  return text
}

/** A unit price: $67,123.45 or $0.001234. */
export function formatPrice(value: number | null | undefined) {
  if (!isNum(value)) return DASH
  const abs = Math.abs(value)
  const text = abs !== 0 && abs < 1 ? usdSig.format(abs) : usd2.format(abs)
  return withSign(text, value, false)
}

/** An amount of money (portfolio value, P&L, totals). */
export function formatMoney(
  value: number | null | undefined,
  { signed = false }: { signed?: boolean } = {}
) {
  if (!isNum(value)) return DASH
  const abs = Math.abs(value)
  // Sub-cent amounts are noise in a money context, but keep them visible
  // rather than rounding a real loss to "$0.00".
  const text =
    abs !== 0 && abs < 0.01 ? usdSigMoney.format(abs) : usd2.format(abs)
  return withSign(text, value, signed)
}

/** Large aggregates: $2.41T, $98.40B, $512.30M. Values under $100k stay exact. */
export function formatCompactMoney(value: number | null | undefined) {
  if (!isNum(value)) return DASH
  const abs = Math.abs(value)
  const text = abs < 100_000 ? usdWhole.format(abs) : usdCompact.format(abs)
  return withSign(text, value, false)
}

/** A percentage change: +1.23%, −0.40%, 0.00%. */
export function formatPercent(
  value: number | null | undefined,
  { signed = true, digits = 2 }: { signed?: boolean; digits?: number } = {}
) {
  if (!isNum(value)) return DASH
  const abs = Math.abs(value)
  // Guard against "−0.00%" for values that round to zero.
  if (abs < 0.5 * 10 ** -digits) return (0).toFixed(digits) + "%"
  const text =
    abs.toLocaleString(LOCALE, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }) + "%"
  return withSign(text, value, signed)
}

/** A share of a whole (allocation, dominance): 57.3%. */
export function formatShare(value: number | null | undefined, digits = 1) {
  return formatPercent(value, { signed: false, digits })
}

/** A token quantity: up to 8 decimals, trailing zeros trimmed. */
export function formatQuantity(value: number | null | undefined) {
  if (!isNum(value)) return DASH
  const abs = Math.abs(value)
  const maximumFractionDigits = abs >= 1000 ? 2 : abs >= 1 ? 4 : 8
  const text = abs.toLocaleString(LOCALE, { maximumFractionDigits })
  return withSign(text, value, false)
}

/** Supply figures: 19.70M, 21.00M, 1.20B. */
export function formatSupply(value: number | null | undefined) {
  if (!isNum(value)) return DASH
  return value.toLocaleString(LOCALE, {
    notation: value >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: 2,
  })
}

/** Direction of a change, used to pick colour and arrow. */
export function direction(
  value: number | null | undefined
): "up" | "down" | "flat" {
  if (!isNum(value) || Math.abs(value) < 0.005) return "flat"
  return value > 0 ? "up" : "down"
}

const relative = new Intl.RelativeTimeFormat(LOCALE, {
  numeric: "auto",
  style: "short",
})

/** "just now", "45 sec. ago", "3 min. ago", "2 hr. ago". */
export function formatAge(
  timestamp: number | null | undefined,
  now = Date.now()
) {
  if (!isNum(timestamp) || timestamp <= 0) return DASH
  const seconds = Math.round((now - timestamp) / 1000)
  if (seconds < 10) return "just now"
  if (seconds < 60) return relative.format(-seconds, "second")
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return relative.format(-minutes, "minute")
  const hours = Math.round(minutes / 60)
  if (hours < 48) return relative.format(-hours, "hour")
  return relative.format(-Math.round(hours / 24), "day")
}

const clock = new Intl.DateTimeFormat(LOCALE, {
  hour: "numeric",
  minute: "2-digit",
})
const shortDate = new Intl.DateTimeFormat(LOCALE, {
  month: "short",
  day: "numeric",
  year: "numeric",
})

export function formatClock(timestamp: number | null | undefined) {
  return isNum(timestamp) && timestamp > 0 ? clock.format(timestamp) : DASH
}

export function formatDate(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return DASH
  const date =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? // A bare calendar date is a local date, not UTC midnight.
        new Date(
          Number(value.slice(0, 4)),
          Number(value.slice(5, 7)) - 1,
          Number(value.slice(8, 10))
        )
      : new Date(value)
  return Number.isNaN(date.getTime()) ? DASH : shortDate.format(date)
}

/** Today's local calendar date as YYYY-MM-DD (for <input type="date">). */
export function todayISO(now = new Date()) {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/**
 * Parses a typed amount. Accepts "0.5", ".5", "1234.56" and US-grouped
 * "1,234.56". Anything else (including "0,5", which would otherwise silently
 * become 5) is rejected as NaN so the form can ask for a dot as decimal mark.
 */
export function parseAmount(text: string) {
  let t = text.trim().replace(/[\s$]/g, "")
  if (t.includes(",")) {
    if (!/^\d{1,3}(,\d{3})+(\.\d*)?$/.test(t)) return Number.NaN
    t = t.replace(/,/g, "")
  }
  if (!/^(\d+\.?\d*|\.\d+)$/.test(t)) return Number.NaN
  return Number(t)
}
