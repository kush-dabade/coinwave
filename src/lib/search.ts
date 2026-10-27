import type { Asset } from "@/services/coingecko"

/** Lower is better; null means no match. */
function matchScore(asset: Asset, q: string) {
  const symbol = asset.symbol.toLowerCase()
  const name = asset.name.toLowerCase()
  if (symbol === q) return 0
  if (name === q) return 1
  if (symbol.startsWith(q)) return 2
  if (name.startsWith(q)) return 3
  if (name.split(/[\s-]+/).some((word) => word.startsWith(q))) return 4
  if (name.includes(q) || asset.id.includes(q)) return 5
  return null
}

export function searchLocalAssets(assets: Asset[], query: string, limit = 8) {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return assets
    .map((asset) => ({ asset, score: matchScore(asset, q) }))
    .filter((r): r is { asset: Asset; score: number } => r.score !== null)
    .sort(
      (a, b) =>
        a.score - b.score || (a.asset.rank ?? 1e9) - (b.asset.rank ?? 1e9)
    )
    .slice(0, limit)
    .map((r) => r.asset)
}
