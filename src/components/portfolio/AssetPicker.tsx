import { useMemo, useState } from "react"
import { Command } from "cmdk"
import { Search } from "lucide-react"

import { AssetIcon } from "@/components/data/AssetIcon"
import { useAssetSearch, useTopAssets } from "@/hooks/queries"
import { useDebounced } from "@/hooks/use-ui"
import { formatPrice } from "@/lib/format"
import { searchLocalAssets } from "@/lib/search"

export type PickedAsset = {
  id: string
  name: string
  symbol: string
  image: string | null
}

/**
 * Search-as-you-type asset selector: the live top 100 first, then the whole
 * CoinGecko catalogue. Assets are identified by CoinGecko id, so two tokens
 * sharing a ticker can never be confused.
 */
export function AssetPicker({
  value,
  onChange,
  suggestedIds,
  invalid,
  describedBy,
  inputId,
}: {
  value: PickedAsset | null
  onChange: (asset: PickedAsset | null) => void
  suggestedIds: string[]
  invalid?: boolean
  describedBy?: string
  inputId: string
}) {
  const [query, setQuery] = useState("")
  const top = useTopAssets()
  const assets = useMemo(() => top.data ?? [], [top.data])
  const debounced = useDebounced(query, 300)
  const remote = useAssetSearch(debounced)

  if (value) {
    return (
      <div className="flex h-11 items-center gap-3 rounded-md border border-rule-strong bg-surface px-3">
        <AssetIcon src={value.image} symbol={value.symbol} size={22} />
        <span className="min-w-0 flex-1 truncate text-sm text-ink">
          {value.name} <span className="text-ink-3">{value.symbol}</span>
        </span>
        <button
          type="button"
          id={inputId}
          onClick={() => onChange(null)}
          className="text-sm font-medium text-accent hover:underline"
          aria-label={`Change asset (currently ${value.name})`}
        >
          Change
        </button>
      </div>
    )
  }

  const q = query.trim()
  const local = q
    ? searchLocalAssets(assets, q, 6)
    : [
        ...suggestedIds
          .map((id) => assets.find((a) => a.id === id))
          .filter((a) => !!a),
        ...assets.slice(0, 6).filter((a) => !suggestedIds.includes(a.id)),
      ].slice(0, 6)
  const localIds = new Set(local.map((a) => a!.id))
  const remoteHits =
    q.length >= 2 && debounced.trim() === q
      ? (remote.data ?? []).filter((h) => !localIds.has(h.id)).slice(0, 5)
      : []

  const item =
    "flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2.5 text-sm text-ink data-[selected=true]:bg-surface-2"

  return (
    <Command
      shouldFilter={false}
      loop
      label="Choose an asset"
      className="rounded-md border border-rule-strong bg-surface"
    >
      <div className="flex items-center gap-2 border-b border-rule px-3">
        <Search className="size-4 text-ink-3" aria-hidden="true" />
        <Command.Input
          id={inputId}
          value={query}
          onValueChange={setQuery}
          placeholder="Search by name or symbol"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className="h-10 w-full bg-transparent text-base text-ink outline-none placeholder:text-ink-3 sm:text-sm"
        />
      </div>
      <Command.List className="max-h-56 overflow-y-auto p-1">
        {!q && (
          <p className="px-2.5 pt-1.5 pb-1 text-[11px] text-ink-3">
            {suggestedIds.length
              ? "Your assets and the largest by market cap"
              : "Largest by market cap"}
          </p>
        )}
        {local.map((a) => (
          <Command.Item
            key={a!.id}
            value={a!.id}
            onSelect={() =>
              onChange({
                id: a!.id,
                name: a!.name,
                symbol: a!.symbol,
                image: a!.image,
              })
            }
            className={item}
          >
            <AssetIcon src={a!.image} symbol={a!.symbol} size={20} />
            <span className="min-w-0 flex-1 truncate">
              {a!.name} <span className="text-ink-3">{a!.symbol}</span>
            </span>
            <span className="num text-xs text-ink-3">
              {formatPrice(a!.price)}
            </span>
          </Command.Item>
        ))}
        {remoteHits.map((h) => (
          <Command.Item
            key={h.id}
            value={h.id}
            onSelect={() =>
              onChange({
                id: h.id,
                name: h.name,
                symbol: h.symbol,
                image: h.thumb,
              })
            }
            className={item}
          >
            <AssetIcon src={h.thumb} symbol={h.symbol} size={20} />
            <span className="min-w-0 flex-1 truncate">
              {h.name} <span className="text-ink-3">{h.symbol}</span>
            </span>
            <span className="text-xs text-ink-3">
              {h.rank ? `#${h.rank}` : "Unranked"}
            </span>
          </Command.Item>
        ))}
        {q.length >= 2 && remote.isFetching && remoteHits.length === 0 && (
          <p className="px-2.5 py-2 text-sm text-ink-3">
            Searching all assets…
          </p>
        )}
        {q &&
          local.length === 0 &&
          remoteHits.length === 0 &&
          !remote.isFetching &&
          (q.length < 2 || debounced.trim() === q) && (
            <p className="px-2.5 py-2 text-sm text-ink-3">
              {q.length < 2
                ? "Keep typing to search all assets."
                : `No assets match “${q}”.`}
            </p>
          )}
      </Command.List>
    </Command>
  )
}
