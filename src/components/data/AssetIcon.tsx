import { useState } from "react"

import { cn } from "@/lib/utils"

/**
 * Asset logo with a lettered fallback when the image is missing or fails.
 * Decorative: the asset's name is always rendered next to it.
 */
export function AssetIcon({
  src,
  symbol,
  size = 24,
  className,
}: {
  src: string | null | undefined
  symbol: string
  size?: number
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const style = { width: size, height: size }
  if (!src || failed) {
    // Up to four letters, so USDT and USDC stay distinguishable.
    const label =
      (symbol || "?").length <= 4 ? symbol || "?" : symbol.slice(0, 3)
    const scale = label.length >= 4 ? 0.27 : label.length === 3 ? 0.34 : 0.4
    return (
      <span
        aria-hidden="true"
        style={{ ...style, fontSize: Math.max(8, size * scale) }}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full bg-surface-2 font-semibold text-ink-2",
          className
        )}
      >
        {label}
      </span>
    )
  }
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      style={style}
      className={cn("shrink-0 rounded-full bg-surface-2", className)}
    />
  )
}
