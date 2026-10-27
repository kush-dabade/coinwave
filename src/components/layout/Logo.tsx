import { cn } from "@/lib/utils"

/** The CoinWave mark: a coin crossed by a single wave. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("size-6 shrink-0", className)}
    >
      <circle cx="12" cy="12" r="11" fill="var(--accent)" />
      <path
        d="M3.5 13.2c2.2 0 2.9-4.4 5.6-4.4s3 6.4 5.8 6.4 3-4.4 5.6-4.4"
        fill="none"
        stroke="var(--accent-ink)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className="size-5" />
      <span className="text-[0.9375rem] leading-none font-semibold tracking-[-0.02em] text-ink">
        Coin<span className="text-accent">Wave</span>
      </span>
    </span>
  )
}
