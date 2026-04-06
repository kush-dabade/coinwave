export function toSafeNumber(value: number | null | undefined, fallback = 0) {
  const next = Number(value)
  return Number.isFinite(next) ? next : fallback
}

export function safeNumber(value: number | null | undefined, decimals = 2) {
  return toSafeNumber(value).toFixed(decimals)
}
