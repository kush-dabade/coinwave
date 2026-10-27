import { RotateCw } from "lucide-react"
import { Link } from "react-router-dom"
import { useIsFetching, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/controls"
import { useFreshness, type FreshnessState } from "@/hooks/use-freshness"
import { formatAge, formatClock } from "@/lib/format"
import { cn } from "@/lib/utils"
import { describeError } from "@/services/http"

const DOT: Record<FreshnessState, string> = {
  loading: "bg-ink-3",
  fresh: "bg-up",
  paused: "bg-ink-3",
  delayed: "bg-warn",
  offline: "bg-warn",
  unavailable: "bg-down",
}

export function DataStatus() {
  const { state, updatedAt, now, error } = useFreshness()
  const queryClient = useQueryClient()
  const fetching = useIsFetching() > 0
  const online = state !== "offline"
  const short: Record<FreshnessState, string> = {
    loading: "Loading…",
    fresh: `Updated ${formatAge(updatedAt, now)}`,
    paused: `Auto-refresh off · ${formatAge(updatedAt, now)}`,
    delayed: `Delayed · ${formatAge(updatedAt, now)}`,
    offline: "Offline",
    unavailable: "Prices unavailable",
  }

  return (
    <Popover>
      <PopoverTrigger
        className="inline-flex h-8 items-center gap-2 rounded-md px-2 text-xs text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
        aria-label={`Market data status: ${short[state]}`}
      >
        <span className="relative flex size-2">
          {fetching && online && (
            <span
              className={cn(
                "absolute inset-0 animate-ping rounded-full opacity-60",
                DOT[state]
              )}
            />
          )}
          <span className={cn("relative size-2 rounded-full", DOT[state])} />
        </span>
        <span className="hidden whitespace-nowrap xl:inline">
          {short[state]}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-[min(20rem,calc(100vw-24px))] text-[0.8125rem]">
        <p className="font-semibold">{short[state]}</p>
        <p className="mt-1 text-ink-2">
          {state === "offline"
            ? "You’re offline. Figures on screen are from the last successful update."
            : state === "unavailable"
              ? `${describeError(error)} Retrying automatically.`
              : state === "delayed"
                ? "The last refresh failed or is overdue, so figures may be out of date. Retrying automatically."
                : state === "paused"
                  ? "Automatic refresh is off in Settings. Use Refresh now to update."
                  : "Market data comes from free public APIs and can lag exchanges by a minute or two."}
        </p>
        {updatedAt && (
          <p className="mt-2 text-xs text-ink-3">
            Last successful update{" "}
            <span className="num text-ink-2">{formatClock(updatedAt)}</span>
          </p>
        )}
        <div className="mt-3 flex items-center gap-2">
          <Button
            size="sm"
            disabled={fetching || !online}
            onClick={() => queryClient.refetchQueries({ type: "active" })}
          >
            <RotateCw
              className={cn(fetching && "animate-spin")}
              aria-hidden="true"
            />
            {fetching ? "Refreshing…" : "Refresh now"}
          </Button>
          <Link
            to="/status"
            className="text-xs font-medium text-accent hover:underline"
          >
            Source details
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
