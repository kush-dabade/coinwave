import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { useQuotes } from "@/hooks/queries"
import { usePortfolioValuation } from "@/hooks/use-portfolio-valuation"
import {
  describeAlert,
  evaluateAlerts,
  formatObserved,
  isAssetAlert,
  type Alert,
} from "@/lib/alerts"
import { alertActions, useAlerts, useSettings } from "@/stores"

function notify(title: string, body: string) {
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, tag: `coinwave-${title}` })
    }
  } catch {
    // Some browsers throw outside a secure context; the in-app toast still shows.
  }
}

/**
 * Checks active alerts whenever fresh market or portfolio data arrives.
 * Runs only while CoinWave is open in a tab, and only against data fetched
 * in this session, so a cached snapshot can never trigger an alert.
 */
export function AlertMonitor() {
  const { alerts } = useAlerts()
  const settings = useSettings()
  const [sessionStart] = useState(() => Date.now())
  const active = useMemo(
    () => alerts.filter((a) => a.status === "active"),
    [alerts]
  )
  const assetIds = useMemo(
    () => [
      ...new Set(
        active
          .filter((a) => isAssetAlert(a.kind) && a.assetId)
          .map((a) => a.assetId!)
      ),
    ],
    [active]
  )
  const quotes = useQuotes(assetIds)
  const portfolio = usePortfolioValuation()

  useEffect(() => {
    const fire = (fired: { alert: Alert; value: number }[], at: number) => {
      if (fired.length === 0) return
      const run = () => {
        const done = alertActions.fireIfActive(
          fired.map((f) => ({
            ...f,
            message: `${describeAlert(f.alert)} · observed ${formatObserved(f.alert.kind, f.value)}`,
          })),
          at
        )
        for (const f of done) {
          const title = describeAlert(f.alert)
          const body = `Observed ${formatObserved(f.alert.kind, f.value)}`
          toast(title, { description: body, duration: 10_000 })
          if (settings.notifications) notify(title, body)
        }
      }
      // With CoinWave open in several tabs, only one may fire each alert.
      if (typeof navigator !== "undefined" && navigator.locks)
        void navigator.locks.request("coinwave:alerts", run)
      else run()
    }

    const assetAlerts = active.filter((a) => isAssetAlert(a.kind))
    if (
      quotes.updatedAt &&
      quotes.updatedAt >= sessionStart &&
      assetAlerts.length
    ) {
      fire(
        evaluateAlerts(assetAlerts, {
          observedAt: quotes.updatedAt,
          quote: (id) => quotes.assets.get(id),
          portfolioValue: null,
        }),
        quotes.updatedAt
      )
    }
    const portfolioAlerts = active.filter((a) => !isAssetAlert(a.kind))
    const at = portfolio.pricesUpdatedAt
    if (
      at &&
      at >= sessionStart &&
      portfolioAlerts.length &&
      !portfolio.sample
    ) {
      fire(
        evaluateAlerts(portfolioAlerts, {
          observedAt: at,
          quote: () => null,
          portfolioValue: portfolio.summary.value,
        }),
        at
      )
    }
  }, [
    active,
    quotes,
    portfolio.pricesUpdatedAt,
    portfolio.summary.value,
    portfolio.sample,
    settings.notifications,
    sessionStart,
  ])

  return null
}
