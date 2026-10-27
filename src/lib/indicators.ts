/**
 * Technical indicators. Every function returns an array aligned with its
 * input; positions without enough observations are `null` rather than a
 * guessed value, so charts simply start the line where the maths allows.
 */

export type Series = (number | null)[]

/** Simple moving average over `period` observations. */
export function sma(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null)
  if (period < 1) return out
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= period) sum -= values[i - period]
    if (i >= period - 1) out[i] = sum / period
  }
  return out
}

/** Exponential moving average, seeded with the SMA of the first `period` values. */
export function ema(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null)
  if (period < 1 || values.length < period) return out
  const k = 2 / (period + 1)
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period
  out[period - 1] = prev
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k)
    out[i] = prev
  }
  return out
}

/** EMA over a series that may begin with nulls (used for the MACD signal line). */
function emaOfSeries(values: Series, period: number): Series {
  const start = values.findIndex((v) => v !== null)
  const out: Series = new Array(values.length).fill(null)
  if (start < 0) return out
  const tail = values.slice(start).map((v) => v as number)
  ema(tail, period).forEach((v, i) => (out[start + i] = v))
  return out
}

/**
 * Relative Strength Index with Wilder's smoothing (the standard definition).
 * The first value appears at index `period`.
 */
export function rsi(values: number[], period = 14): Series {
  const out: Series = new Array(values.length).fill(null)
  if (values.length <= period) return out
  let gain = 0
  let loss = 0
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1]
    if (d > 0) gain += d
    else loss -= d
  }
  let avgGain = gain / period
  let avgLoss = loss / period
  const value = () =>
    avgLoss === 0
      ? avgGain === 0
        ? 50
        : 100
      : 100 - 100 / (1 + avgGain / avgLoss)
  out[period] = value()
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1]
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period
    out[i] = value()
  }
  return out
}

/** MACD line (fast EMA − slow EMA), signal line (EMA of MACD), histogram. */
export function macd(values: number[], fast = 12, slow = 26, signal = 9) {
  const f = ema(values, fast)
  const s = ema(values, slow)
  const line: Series = values.map((_, i) =>
    f[i] !== null && s[i] !== null ? f[i]! - s[i]! : null
  )
  const sig = emaOfSeries(line, signal)
  const hist: Series = line.map((v, i) =>
    v !== null && sig[i] !== null ? v - sig[i]! : null
  )
  return { line, signal: sig, histogram: hist }
}

/** Bollinger Bands: SMA ± k population standard deviations. */
export function bollinger(values: number[], period = 20, k = 2) {
  const mid = sma(values, period)
  const upper: Series = new Array(values.length).fill(null)
  const lower: Series = new Array(values.length).fill(null)
  for (let i = period - 1; i < values.length; i++) {
    const m = mid[i]!
    let sq = 0
    for (let j = i - period + 1; j <= i; j++) sq += (values[j] - m) ** 2
    const sd = Math.sqrt(sq / period)
    upper[i] = m + k * sd
    lower[i] = m - k * sd
  }
  return { middle: mid, upper, lower }
}
