import { ApiError, fetchJson } from "./http"

/**
 * The Crypto Fear & Greed Index published daily by Alternative.me.
 * https://alternative.me/crypto/fear-and-greed-index/
 * One request returns a year of daily readings; the latest is "today".
 */
export type FearGreedReading = {
  value: number
  label: string
  timestamp: number
}

export type FearGreed = FearGreedReading & {
  previous: { value: number; label: string } | null
  /** Daily readings, oldest first (up to 365). */
  history: FearGreedReading[]
}

type Raw = {
  data?: { value?: string; value_classification?: string; timestamp?: string }[]
}

export async function fetchFearGreed(signal?: AbortSignal): Promise<FearGreed> {
  const json = await fetchJson<Raw>(
    "https://api.alternative.me/fng/?limit=365",
    signal
  )
  const readings = (json.data ?? [])
    .map((entry) => ({
      value: Number(entry.value),
      label: entry.value_classification ?? "",
      timestamp: Number(entry.timestamp) * 1000,
    }))
    .filter((r) => Number.isFinite(r.value) && Number.isFinite(r.timestamp))
  const [today, yesterday] = readings
  if (!today) throw new ApiError("server", "Unexpected Fear & Greed payload")
  return {
    ...today,
    previous: yesterday
      ? { value: yesterday.value, label: yesterday.label }
      : null,
    history: [...readings].reverse(),
  }
}
