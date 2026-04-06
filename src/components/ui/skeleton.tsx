import { cn } from "@/lib/utils"

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "skeleton-shimmer rounded-md bg-white/[0.07]",
        className
      )}
    />
  )
}

function CardSkeleton({
  className,
  lines = 3,
}: {
  className?: string
  lines?: number
}) {
  return (
    <div className={cn("space-y-4 rounded-xl border border-white/10 p-4", className)}>
      <div className="space-y-2">
        <Skeleton className="h-3 w-24 rounded-full" />
        <Skeleton className="h-7 w-32" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <Skeleton
            key={index}
            className={cn("h-3 rounded-full", index === lines - 1 ? "w-2/3" : "w-full")}
          />
        ))}
      </div>
    </div>
  )
}

function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      <Skeleton className="h-4 w-24 rounded-full" />
      <div className="relative h-32 overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] p-3">
        <div className="absolute inset-x-3 bottom-3 flex h-20 items-end gap-2">
          <Skeleton className="h-7 flex-1 rounded-sm" />
          <Skeleton className="h-11 flex-1 rounded-sm" />
          <Skeleton className="h-9 flex-1 rounded-sm" />
          <Skeleton className="h-16 flex-1 rounded-sm" />
          <Skeleton className="h-[52px] flex-1 rounded-sm" />
          <Skeleton className="h-[72px] flex-1 rounded-sm" />
        </div>
      </div>
    </div>
  )
}

function TableSkeleton({
  rows = 6,
  columns = 5,
  className,
}: {
  rows?: number
  columns?: number
  className?: string
}) {
  return (
    <div className={cn("w-full overflow-hidden rounded-xl border border-white/10", className)}>
      <div className="grid border-b border-white/10 bg-white/[0.03] px-4 py-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={`head-${index}`} className="h-3 w-3/4 rounded-full" />
        ))}
      </div>

      <div>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            className="grid items-center border-b border-white/6 px-4 py-3 last:border-b-0 even:bg-white/[0.015]"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton
                key={`cell-${rowIndex}-${colIndex}`}
                className={cn("h-3 rounded-full", colIndex === 0 ? "w-11/12" : "w-3/4")}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export { Skeleton, CardSkeleton, ChartSkeleton, TableSkeleton }
