import { useState } from "react"
import { Plus, Star } from "lucide-react"
import { toast } from "sonner"

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NameDialog } from "@/components/ui/name-dialog"
import { cn } from "@/lib/utils"
import { useWatchlists, watchlistActions } from "@/stores"

/**
 * Add or remove an asset from any watchlist. The star fills when the asset
 * is on at least one list; the menu shows which.
 */
export function WatchButton({
  id,
  name,
  variant = "icon",
  className,
}: {
  id: string
  name: string
  variant?: "icon" | "labeled"
  className?: string
}) {
  const { lists, listsFor } = useWatchlists()
  const [creating, setCreating] = useState(false)
  const on = listsFor(id)
  const active = on.length > 0

  const toggle = (listId: string, listName: string) => {
    const added = watchlistActions.toggle(listId, id)
    toast(
      added
        ? `${name} added to ${listName}`
        : `${name} removed from ${listName}`,
      {
        action: {
          label: "Undo",
          onClick: () => watchlistActions.toggle(listId, id),
        },
      }
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          onClick={(e) => e.stopPropagation()}
          aria-label={
            active
              ? `${name} is on ${on.length} watchlist${on.length > 1 ? "s" : ""}. Change watchlists`
              : `Add ${name} to a watchlist`
          }
          className={cn(
            variant === "icon"
              ? "relative z-10 inline-flex size-8 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
              : "inline-flex h-8 items-center gap-1.5 rounded-md border border-rule-strong bg-surface px-2.5 text-[0.8125rem] font-medium text-ink transition-colors hover:bg-surface-2",
            className
          )}
        >
          <Star
            className={cn(
              "size-4",
              active ? "fill-accent text-accent" : "text-ink-3"
            )}
            aria-hidden="true"
          />
          {variant === "labeled" &&
            (active ? `Watching (${on.length})` : "Watch")}
        </DropdownMenuTrigger>
        <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
          <DropdownMenuLabel>Watchlists</DropdownMenuLabel>
          {lists.map((l) => (
            <DropdownMenuCheckboxItem
              key={l.id}
              checked={on.some((x) => x.id === l.id)}
              onCheckedChange={() => toggle(l.id, l.name)}
              onSelect={(e) => e.preventDefault()}
            >
              {l.name}
            </DropdownMenuCheckboxItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setCreating(true)}>
            <Plus aria-hidden="true" /> New list with {name}…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <NameDialog
        open={creating}
        onOpenChange={setCreating}
        title="New watchlist"
        description={`${name} will be added to it.`}
        onSubmit={(listName) => {
          const listId = watchlistActions.create(listName)
          watchlistActions.add(listId, id)
          toast(`${name} added to ${listName}`)
        }}
      />
    </>
  )
}
