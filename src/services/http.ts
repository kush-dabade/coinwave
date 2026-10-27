import { recordRequest, sourceFor } from "./telemetry"

/**
 * Shared JSON fetcher for every external source.
 *
 * Public crypto APIs rate-limit hard, and CoinGecko's 429 responses carry no
 * CORS headers, so in a browser a rate limit surfaces as a generic network
 * TypeError. Errors are classified conservatively; callers (TanStack Query)
 * keep the last good data on screen while backing off.
 */

export type ApiErrorKind =
  | "unreachable"
  | "offline"
  | "rate-limit"
  | "not-found"
  | "server"

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status?: number

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message)
    this.name = "ApiError"
    this.kind = kind
    this.status = status
  }
}

export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.kind) {
      case "offline":
        return "You appear to be offline."
      case "rate-limit":
      case "unreachable":
        return "The data source is busy or unreachable (free APIs rate-limit heavily)."
      case "not-found":
        return "The data source has no data for this request."
      case "server":
        return "The data source returned an error."
    }
  }
  return "Something went wrong while loading data."
}

function pathOf(url: string) {
  try {
    const u = new URL(url, window.location.origin)
    return (
      u.pathname +
      (u.search.length > 60 ? u.search.slice(0, 60) + "…" : u.search)
    )
  } catch {
    return url
  }
}

export async function fetchJson<T>(
  url: string,
  signal?: AbortSignal
): Promise<T> {
  const source = sourceFor(url)
  const started = performance.now()
  const record = (status: number | "network" | "aborted", error?: string) =>
    recordRequest(
      {
        at: Date.now(),
        source,
        path: pathOf(url),
        status,
        ms: Math.round(performance.now() - started),
      },
      error
    )

  let response: Response
  try {
    response = await fetch(url, {
      signal,
      headers: { accept: "application/json" },
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      record("aborted")
      throw error
    }
    record("network", "Network error (often a rate limit hidden by CORS)")
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      throw new ApiError("offline", "Offline")
    }
    throw new ApiError("unreachable", "Request failed")
  }
  record(response.status, response.ok ? undefined : `HTTP ${response.status}`)
  if (response.status === 429)
    throw new ApiError("rate-limit", "Rate limited", 429)
  if (response.status === 404) throw new ApiError("not-found", "Not found", 404)
  if (!response.ok)
    throw new ApiError("server", `HTTP ${response.status}`, response.status)
  try {
    return (await response.json()) as T
  } catch {
    throw new ApiError("server", "Malformed response", response.status)
  }
}

// ---------------------------------------------------------------------------
// Normalisation helpers shared by the service modules.

export function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

export function positive(value: unknown): number | null {
  const n = num(value)
  return n !== null && n > 0 ? n : null
}

export function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null
}

export function time(value: unknown): number | null {
  const s = str(value)
  if (!s) return null
  const t = Date.parse(s)
  return Number.isFinite(t) ? t : null
}
