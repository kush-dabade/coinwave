import { useMemo } from "react"
import { ExternalLink, RotateCw } from "lucide-react"
import { Link } from "react-router-dom"
import { useIsFetching, useQueryClient } from "@tanstack/react-query"

import { Page, PageHeader, Pane } from "@/components/layout/Page"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/controls"
import { ScrollRegion } from "@/components/data/table"
import { SNAPSHOT_PREFIX } from "@/hooks/queries"
import { useFreshness, useOnline } from "@/hooks/use-freshness"
import { useNow, usePageTitle } from "@/hooks/use-ui"
import { formatAge, formatClock } from "@/lib/format"
import { readJSON } from "@/lib/storage"
import { T } from "@/lib/table"
import { cn } from "@/lib/utils"
import {
  SOURCES,
  useTelemetry,
  type SourceId,
  type SourceState,
} from "@/services/telemetry"

type Health = { label: string; tone: "up" | "down" | "warn" | "neutral" }

function healthOf(s: SourceState): Health {
  if (s.ok === 0 && s.failed === 0)
    return { label: "No requests yet", tone: "neutral" }
  if (s.lastFailure && (!s.lastSuccess || s.lastFailure > s.lastSuccess)) {
    return s.lastError?.includes("429") ||
      s.lastError?.toLowerCase().includes("rate")
      ? { label: "Rate limited", tone: "warn" }
      : { label: "Failing", tone: "down" }
  }
  return { label: "OK", tone: "up" }
}

/** Which parts of CoinWave depend on which source, and what happens when it fails. */
const DEPENDENCIES: {
  feature: string
  to: string
  sources: SourceId[]
  fallback: string
}[] = [
  {
    feature: "Prices, Markets, Screener, Command Center",
    to: "/markets",
    sources: ["coingecko"],
    fallback: "Last good snapshot (up to 24 h old), clearly timestamped.",
  },
  {
    feature: "Asset profiles, venues, categories, search",
    to: "/markets",
    sources: ["coingecko"],
    fallback:
      "Section shows an error with retry; the rest of the page still works.",
  },
  {
    feature: "Chart Studio candles",
    to: "/chart",
    sources: ["binance", "coingecko"],
    fallback:
      "Coarser CoinGecko OHLC when an asset has no Binance USDT pair; the chart says which source it uses.",
  },
  {
    feature: "Compare, Risk Lab, portfolio history",
    to: "/compare",
    sources: ["binance", "coingecko"],
    fallback:
      "CoinGecko daily prices (re-aligned to daily closes) where Binance has no pair; an asset with neither is named as having no history, never estimated.",
  },
  {
    feature: "Fear & Greed",
    to: "/intelligence",
    sources: ["alternative"],
    fallback: "Panel marked unavailable.",
  },
  {
    feature: "Stablecoin supply, DeFi TVL",
    to: "/intelligence",
    sources: ["defillama"],
    fallback: "Panel marked unavailable.",
  },
  {
    feature: "News",
    to: "/news",
    sources: ["news"],
    fallback: "Individual publishers that fail are listed; others still show.",
  },
]

function useSnapshots(now: number) {
  return useMemo(() => {
    const out: { name: string; at: number | null }[] = []
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i)
        if (!key?.startsWith(SNAPSHOT_PREFIX)) continue
        const snap = readJSON<{ at?: unknown } | null>(key, null)
        out.push({
          name: key.slice(SNAPSHOT_PREFIX.length),
          at: typeof snap?.at === "number" ? snap.at : null,
        })
      }
    } catch {
      // Storage unavailable.
    }
    return out.sort((a, b) => a.name.localeCompare(b.name))
    // Re-read on each clock tick so a fresh save shows up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now])
}

export default function DataStatusPage() {
  usePageTitle("Data status")
  const telemetry = useTelemetry()
  const queryClient = useQueryClient()
  const fetching = useIsFetching()
  const online = useOnline()
  const freshness = useFreshness()
  const now = useNow(5_000)
  const snapshots = useSnapshots(now)
  const queries = queryClient
    .getQueryCache()
    .getAll()
    .filter((q) => q.state.dataUpdatedAt > 0 || q.state.status === "error")
    .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt)

  return (
    <Page>
      <PageHeader
        title="Data status"
        description="Where CoinWave’s data comes from, how fresh it is and which requests are failing. Counters cover this browser session only."
        meta={
          <>
            <span className="inline-flex items-center gap-1.5">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  online ? "bg-up" : "bg-warn"
                )}
                aria-hidden="true"
              />
              {online ? "Online" : "Offline"}
            </span>
            <span>
              Market data updated {formatAge(freshness.updatedAt, now)}
            </span>
            <span>
              {fetching
                ? `${fetching} request${fetching === 1 ? "" : "s"} in flight`
                : "Idle"}
            </span>
          </>
        }
        actions={
          <Button
            size="sm"
            disabled={!online || fetching > 0}
            onClick={() => queryClient.refetchQueries({ type: "active" })}
          >
            <RotateCw
              className={cn(fetching > 0 && "animate-spin")}
              aria-hidden="true"
            />{" "}
            Refresh all
          </Button>
        }
      />

      <div className="space-y-3">
        <Pane id="sources" title="Sources" flush>
          <ScrollRegion label="Data sources" className="overflow-y-hidden">
            <table className={T.table}>
              <caption className="sr-only">
                Data sources and their health this session
              </caption>
              <thead className={T.thead}>
                <tr>
                  <th scope="col" className={cn(T.th, "text-left")}>
                    Source
                  </th>
                  <th scope="col" className={cn(T.th, "text-left")}>
                    Status
                  </th>
                  <th scope="col" className={cn(T.th, "text-right")}>
                    Last success
                  </th>
                  <th scope="col" className={cn(T.th, "text-right")}>
                    Latency
                  </th>
                  <th scope="col" className={cn(T.th, "text-right")}>
                    OK / failed
                  </th>
                  <th scope="col" className={cn(T.th, "text-left")}>
                    Last error
                  </th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(SOURCES) as SourceId[]).map((id) => {
                  const meta = SOURCES[id]
                  const s = telemetry.sources[id]
                  const health = healthOf(s)
                  return (
                    <tr key={id} className={cn(T.tr, "align-top")}>
                      <th
                        scope="row"
                        className={cn(
                          T.td,
                          "h-auto py-2 text-left font-normal whitespace-normal"
                        )}
                      >
                        {meta.url.startsWith("http") ? (
                          <a
                            href={meta.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="font-medium text-ink hover:underline"
                          >
                            {meta.name}
                            <ExternalLink
                              className="ml-1 inline size-3 text-ink-3"
                              aria-hidden="true"
                            />
                          </a>
                        ) : (
                          <span className="font-medium text-ink">
                            {meta.name}
                          </span>
                        )}
                        <p className="max-w-md text-xs text-ink-3">
                          {meta.purpose}
                        </p>
                        <p className="max-w-md text-xs text-ink-3">
                          {meta.limits}
                        </p>
                      </th>
                      <td className={cn(T.td, "py-2")}>
                        <Badge tone={health.tone}>{health.label}</Badge>
                      </td>
                      <td
                        className={cn(T.td, "num py-2 text-right text-ink-2")}
                      >
                        {formatAge(s.lastSuccess, now)}
                      </td>
                      <td
                        className={cn(T.td, "num py-2 text-right text-ink-2")}
                      >
                        {s.lastLatency === null ? "—" : `${s.lastLatency} ms`}
                      </td>
                      <td
                        className={cn(T.td, "num py-2 text-right text-ink-2")}
                      >
                        {s.ok} /{" "}
                        <span className={s.failed ? "text-down" : undefined}>
                          {s.failed}
                        </span>
                      </td>
                      <td
                        className={cn(
                          T.td,
                          "max-w-64 py-2 text-left text-xs whitespace-normal text-ink-3"
                        )}
                      >
                        {s.lastError ? (
                          <>
                            {s.lastError}
                            <span className="block">
                              {formatAge(s.lastFailure, now)}
                            </span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </ScrollRegion>
          <p className="border-t border-rule px-3 py-2 text-xs text-ink-3">
            All sources are free and keyless; no API key is shipped to your
            browser. A rate-limited request is retried with back-off while the
            last good data stays on screen.
          </p>
        </Pane>

        <div className="grid gap-3 xl:grid-cols-2">
          <Pane id="deps" title="What depends on what" flush>
            <ul className="divide-y divide-rule">
              {DEPENDENCIES.map((d) => (
                <li key={d.feature} className="px-3 py-2 text-[0.8125rem]">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link
                      to={d.to}
                      className="font-medium text-ink hover:underline"
                    >
                      {d.feature}
                    </Link>
                    {d.sources.map((s) => {
                      const h = healthOf(telemetry.sources[s])
                      return (
                        <Badge
                          key={s}
                          tone={h.tone === "up" ? "neutral" : h.tone}
                        >
                          {SOURCES[s].name.split(" ")[0]}
                          {h.tone !== "up" && h.tone !== "neutral"
                            ? ` · ${h.label.toLowerCase()}`
                            : ""}
                        </Badge>
                      )
                    })}
                  </div>
                  <p className="text-xs text-ink-3">
                    If unavailable: {d.fallback}
                  </p>
                </li>
              ))}
            </ul>
          </Pane>

          <Pane
            id="cache"
            title="Cache"
            subtitle="Data held in memory for this tab, newest first"
            flush
          >
            <ScrollRegion label="Cached queries" className="max-h-80">
              <table className={T.table}>
                <caption className="sr-only">Cached queries</caption>
                <thead className={T.thead}>
                  <tr>
                    <th scope="col" className={cn(T.th, "text-left")}>
                      Query
                    </th>
                    <th scope="col" className={cn(T.th, "text-left")}>
                      State
                    </th>
                    <th scope="col" className={cn(T.th, "text-right")}>
                      Updated
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {queries.slice(0, 60).map((q) => (
                    <tr key={q.queryHash} className={T.tr}>
                      <td
                        className={cn(
                          T.td,
                          "mono max-w-72 truncate text-left text-xs text-ink-2"
                        )}
                        title={q.queryHash}
                      >
                        {(q.queryKey as unknown[])
                          .map((k) =>
                            typeof k === "object"
                              ? JSON.stringify(k)
                              : String(k)
                          )
                          .join(" · ")}
                      </td>
                      <td className={cn(T.td, "text-left text-xs")}>
                        {q.state.fetchStatus === "fetching" ? (
                          <span className="text-accent">Fetching</span>
                        ) : q.state.status === "error" ? (
                          <span className="text-down">Error</span>
                        ) : q.isStale() ? (
                          <span className="text-ink-3">Stale</span>
                        ) : (
                          <span className="text-ink-2">Fresh</span>
                        )}
                      </td>
                      <td
                        className={cn(
                          T.td,
                          "num text-right text-xs text-ink-3"
                        )}
                      >
                        {formatAge(q.state.dataUpdatedAt, now)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollRegion>
            <div className="border-t border-rule px-3 py-2 text-xs text-ink-3">
              <p>
                Saved for the next visit:{" "}
                {snapshots.length === 0
                  ? "nothing yet."
                  : snapshots.map((s, i) => (
                      <span key={s.name}>
                        {i > 0 && ", "}
                        <span className="text-ink-2">{s.name}</span> (
                        {formatAge(s.at, now)})
                      </span>
                    ))}
              </p>
              <p className="mt-1">
                Clear these in{" "}
                <Link
                  to="/settings#storage-title"
                  className="text-accent underline underline-offset-2"
                >
                  Settings → Your data
                </Link>
                .
              </p>
            </div>
          </Pane>
        </div>

        <Pane
          id="log"
          title="Recent requests"
          subtitle={`Last ${telemetry.log.length} of this session`}
          flush
        >
          {telemetry.log.length === 0 ? (
            <p className="p-3 text-[0.8125rem] text-ink-3">No requests yet.</p>
          ) : (
            <ScrollRegion label="Recent requests" className="max-h-96">
              <table className={T.table}>
                <caption className="sr-only">Recent requests</caption>
                <thead className={T.thead}>
                  <tr>
                    <th scope="col" className={cn(T.th, "text-left")}>
                      Time
                    </th>
                    <th scope="col" className={cn(T.th, "text-left")}>
                      Source
                    </th>
                    <th scope="col" className={cn(T.th, "text-left")}>
                      Request
                    </th>
                    <th scope="col" className={cn(T.th, "text-right")}>
                      Result
                    </th>
                    <th scope="col" className={cn(T.th, "text-right")}>
                      Time taken
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {telemetry.log.map((r, i) => {
                    const ok = typeof r.status === "number" && r.status < 400
                    return (
                      <tr key={`${r.at}-${i}`} className={T.tr}>
                        <td
                          className={cn(
                            T.td,
                            "num text-left text-xs text-ink-3"
                          )}
                        >
                          {formatClock(r.at)}
                        </td>
                        <td
                          className={cn(T.td, "text-left text-xs text-ink-2")}
                        >
                          {SOURCES[r.source].name.split(" ")[0]}
                        </td>
                        <td
                          className={cn(
                            T.td,
                            "mono max-w-[28rem] truncate text-left text-xs text-ink-2"
                          )}
                          title={r.path}
                        >
                          {r.path}
                        </td>
                        <td
                          className={cn(
                            T.td,
                            "num text-right text-xs",
                            ok ? "text-ink-2" : "text-down"
                          )}
                        >
                          {r.status === "network" ? "Network error" : r.status}
                        </td>
                        <td
                          className={cn(
                            T.td,
                            "num text-right text-xs text-ink-3"
                          )}
                        >
                          {r.ms} ms
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </ScrollRegion>
          )}
        </Pane>
      </div>
    </Page>
  )
}
