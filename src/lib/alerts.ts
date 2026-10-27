/**
 * Alerts: conditions on market data or portfolio value, checked by the app
 * whenever fresh data arrives. Alerts are evaluated in the browser, so they
 * only run while CoinWave is open; the UI says so plainly.
 */

import {
  formatCompactMoney,
  formatMoney,
  formatPercent,
  formatPrice,
} from "./format"

export type AlertKind =
  | "price_above"
  | "price_below"
  | "change_above"
  | "change_below"
  | "volume_above"
  | "portfolio_above"
  | "portfolio_below"

export type AlertPeriod = "1h" | "24h" | "7d"

/**
 * active: being checked · triggered: condition met, not yet acknowledged ·
 * dismissed: acknowledged after triggering · disabled: paused by the user.
 */
export type AlertStatus = "active" | "triggered" | "dismissed" | "disabled"

export type Alert = {
  id: string
  kind: AlertKind
  assetId: string | null
  symbol: string
  name: string
  threshold: number
  period: AlertPeriod | null
  status: AlertStatus
  note: string
  thesisId: string | null
  createdAt: number
  triggeredAt: number | null
  triggeredValue: number | null
}

export type AlertEvent = {
  id: string
  alertId: string
  at: number
  value: number
  message: string
}

export type AlertsData = { version: 1; alerts: Alert[]; events: AlertEvent[] }

export const ALERT_KINDS: {
  kind: AlertKind
  label: string
  scope: "asset" | "portfolio"
}[] = [
  { kind: "price_above", label: "Price rises above", scope: "asset" },
  { kind: "price_below", label: "Price falls below", scope: "asset" },
  { kind: "change_above", label: "% change is at least", scope: "asset" },
  { kind: "change_below", label: "% change is at most", scope: "asset" },
  { kind: "volume_above", label: "24h volume exceeds", scope: "asset" },
  {
    kind: "portfolio_above",
    label: "Portfolio value rises above",
    scope: "portfolio",
  },
  {
    kind: "portfolio_below",
    label: "Portfolio value falls below",
    scope: "portfolio",
  },
]

export function isAssetAlert(kind: AlertKind) {
  return !kind.startsWith("portfolio")
}

export type AssetQuote = {
  price: number | null
  change1h: number | null
  change24h: number | null
  change7d: number | null
  volume24h: number | null
}

/** The observed value an alert compares against, or null if unknown. */
export function observedValue(
  alert: Pick<Alert, "kind" | "period">,
  ctx: { asset?: AssetQuote | null; portfolioValue?: number | null }
): number | null {
  switch (alert.kind) {
    case "price_above":
    case "price_below":
      return ctx.asset?.price ?? null
    case "change_above":
    case "change_below": {
      const a = ctx.asset
      if (!a) return null
      return alert.period === "1h"
        ? a.change1h
        : alert.period === "7d"
          ? a.change7d
          : a.change24h
    }
    case "volume_above":
      return ctx.asset?.volume24h ?? null
    case "portfolio_above":
    case "portfolio_below":
      return ctx.portfolioValue ?? null
  }
}

/**
 * How far the observed value is from the threshold: the % move needed for
 * price, volume and portfolio alerts, or the gap in percentage points for
 * % change alerts. Null when unknown.
 */
export function alertDistance(
  alert: Pick<Alert, "kind" | "threshold">,
  value: number | null
): { value: number; unit: "%" | "pp" } | null {
  if (value === null || !Number.isFinite(value)) return null
  if (alert.kind.startsWith("change"))
    return { value: alert.threshold - value, unit: "pp" }
  if (value === 0) return null
  return {
    value: ((alert.threshold - value) / Math.abs(value)) * 100,
    unit: "%",
  }
}

/** Signed, compact rendering of alertDistance, e.g. "−12.4%" or "+3.0 pp". */
export function formatDistance(d: { value: number; unit: "%" | "pp" } | null) {
  if (!d) return "—"
  const sign = d.value > 0 ? "+" : d.value < 0 ? "−" : ""
  return `${sign}${Math.abs(d.value).toFixed(1)}${d.unit === "%" ? "%" : " pp"}`
}

/** Whether the condition holds for an observed value. Unknown never triggers. */
export function conditionMet(
  alert: Pick<Alert, "kind" | "threshold">,
  observed: number | null
) {
  if (observed === null || !Number.isFinite(observed)) return false
  switch (alert.kind) {
    case "price_above":
    case "change_above":
    case "volume_above":
    case "portfolio_above":
      return observed >= alert.threshold
    case "price_below":
    case "change_below":
    case "portfolio_below":
      return observed <= alert.threshold
  }
}

function formatThreshold(kind: AlertKind, value: number) {
  if (kind.startsWith("price")) return formatPrice(value)
  if (kind.startsWith("change")) return formatPercent(value)
  if (kind === "volume_above") return formatCompactMoney(value)
  return formatMoney(value)
}

export function describeAlert(
  alert: Pick<Alert, "kind" | "threshold" | "period" | "name" | "symbol">
) {
  const subject = isAssetAlert(alert.kind)
    ? alert.name || alert.symbol
    : "Portfolio"
  const t = formatThreshold(alert.kind, alert.threshold)
  switch (alert.kind) {
    case "price_above":
      return `${subject} price at or above ${t}`
    case "price_below":
      return `${subject} price at or below ${t}`
    case "change_above":
      return `${subject} ${alert.period ?? "24h"} change at or above ${t}`
    case "change_below":
      return `${subject} ${alert.period ?? "24h"} change at or below ${t}`
    case "volume_above":
      return `${subject} 24h volume at or above ${t}`
    case "portfolio_above":
      return `Portfolio value at or above ${t}`
    case "portfolio_below":
      return `Portfolio value at or below ${t}`
  }
}

export function formatObserved(kind: AlertKind, value: number) {
  return formatThreshold(kind, value)
}

/**
 * Evaluates active alerts against fresh observations. Returns the alerts
 * that trigger now; callers persist the new status and log the events.
 * Data observed before an alert existed never triggers it.
 */
export function evaluateAlerts(
  alerts: Alert[],
  ctx: {
    observedAt: number
    quote: (assetId: string) => AssetQuote | null | undefined
    portfolioValue: number | null
  }
) {
  const fired: { alert: Alert; value: number }[] = []
  for (const alert of alerts) {
    if (alert.status !== "active" || ctx.observedAt <= alert.createdAt) continue
    const value = observedValue(alert, {
      asset: alert.assetId ? ctx.quote(alert.assetId) : null,
      portfolioValue: ctx.portfolioValue,
    })
    if (value !== null && conditionMet(alert, value))
      fired.push({ alert, value })
  }
  return fired
}

const KINDS = new Set(ALERT_KINDS.map((k) => k.kind))
const STATUSES = new Set<AlertStatus>([
  "active",
  "triggered",
  "dismissed",
  "disabled",
])

export function sanitizeAlert(raw: unknown): Alert | null {
  if (!raw || typeof raw !== "object") return null
  const a = raw as Record<string, unknown>
  const kind = a.kind as AlertKind
  const threshold = Number(a.threshold)
  if (
    typeof a.id !== "string" ||
    !KINDS.has(kind) ||
    !Number.isFinite(threshold)
  )
    return null
  const assetId = typeof a.assetId === "string" && a.assetId ? a.assetId : null
  if (isAssetAlert(kind) && !assetId) return null
  const period =
    a.period === "1h" || a.period === "24h" || a.period === "7d"
      ? a.period
      : null
  const num = (v: unknown) =>
    Number.isFinite(Number(v)) && v !== null ? Number(v) : null
  return {
    id: a.id,
    kind,
    assetId,
    symbol: typeof a.symbol === "string" ? a.symbol : "",
    name: typeof a.name === "string" ? a.name : "",
    threshold,
    period: kind.startsWith("change") ? (period ?? "24h") : null,
    status: STATUSES.has(a.status as AlertStatus)
      ? (a.status as AlertStatus)
      : "active",
    note: typeof a.note === "string" ? a.note : "",
    thesisId: typeof a.thesisId === "string" && a.thesisId ? a.thesisId : null,
    createdAt: num(a.createdAt) ?? 0,
    triggeredAt: num(a.triggeredAt),
    triggeredValue: num(a.triggeredValue),
  }
}

export function sanitizeAlertsData(raw: unknown): AlertsData {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >
  const alerts = Array.isArray(d.alerts)
    ? d.alerts.map(sanitizeAlert).filter((a): a is Alert => a !== null)
    : []
  const events = Array.isArray(d.events)
    ? d.events
        .filter(
          (e): e is AlertEvent =>
            !!e &&
            typeof e === "object" &&
            typeof (e as AlertEvent).id === "string" &&
            typeof (e as AlertEvent).alertId === "string" &&
            Number.isFinite((e as AlertEvent).at) &&
            Number.isFinite((e as AlertEvent).value) &&
            typeof (e as AlertEvent).message === "string"
        )
        .slice(0, 200)
    : []
  return { version: 1, alerts, events }
}
