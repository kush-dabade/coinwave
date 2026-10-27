import { useEffect, useMemo, useState } from "react"
import { Command } from "cmdk"
import {
  ArrowRight,
  BellPlus,
  BookOpenText,
  CandlestickChart,
  FilePlus2,
  GitCompareArrows,
  ListChecks,
  Monitor,
  Moon,
  NotebookPen,
  Plus,
  ScanSearch,
  Search,
  Sun,
} from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"

import { AssetIcon } from "@/components/data/AssetIcon"
import { Change } from "@/components/data/Change"
import { ALL_NAV } from "@/components/layout/nav"
import { useTheme } from "@/components/theme-provider"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useAssetSearch, useUniverse } from "@/hooks/queries"
import { useCommandPalette } from "@/hooks/use-command-palette"
import { useDebounced } from "@/hooks/use-ui"
import { describeAlert } from "@/lib/alerts"
import { formatPrice } from "@/lib/format"
import { savedScreenQuery } from "@/lib/screener"
import { searchLocalAssets } from "@/lib/search"
import {
  journalActions,
  researchActions,
  useAlerts,
  useJournal,
  useRecentAssets,
  useResearch,
  useSavedScreens,
  useWatchlists,
} from "@/stores"
import type { Asset } from "@/services/coingecko"

const itemClass =
  "flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-3 text-[0.8125rem] text-ink outline-none select-none data-[selected=true]:bg-surface-2 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-ink-3"
const groupClass =
  "px-2 pb-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[0.6875rem] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-ink-3 [&_[cmdk-group-heading]]:uppercase"

const includes = (text: string, q: string) => text.toLowerCase().includes(q)

/**
 * Application-wide search: assets (top 250 plus the whole CoinGecko
 * catalogue), workspaces, watchlists, notes, theses, alerts and actions.
 */
export function CommandPalette() {
  const { open, setOpen } = useCommandPalette()
  const [query, setQuery] = useState("")
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { setTheme } = useTheme()
  const universe = useUniverse()
  const assets = useMemo(() => universe.data ?? [], [universe.data])
  const recent = useRecentAssets()
  const { lists, defaultList } = useWatchlists()
  const { notes } = useResearch()
  const { theses } = useJournal()
  const screens = useSavedScreens()
  const { alerts } = useAlerts()
  const debounced = useDebounced(query, 300)
  const remote = useAssetSearch(open ? debounced : "")

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = !!target?.closest(
        "input, textarea, select, [contenteditable='true']"
      )
      if (
        (event.key === "k" || event.key === "K") &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault()
        setOpen(!open)
      } else if (
        event.key === "/" &&
        !typing &&
        !open &&
        !document.querySelector("[role='dialog']")
      ) {
        event.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, setOpen])

  const q = query.trim().toLowerCase()
  const byId = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets])
  const contextAsset = pathname.startsWith("/markets/")
    ? (byId.get(decodeURIComponent(pathname.slice(9))) ?? null)
    : null

  const local = q ? searchLocalAssets(assets, q, 7) : []
  const localIds = new Set(local.map((a) => a.id))
  const remoteHits =
    q.length >= 2 && debounced.trim().toLowerCase() === q
      ? (remote.data ?? []).filter((h) => !localIds.has(h.id)).slice(0, 5)
      : []
  const suggestions = q
    ? []
    : [
        ...new Set([
          ...recent,
          ...(defaultList?.items.map((i) => i.assetId) ?? []),
        ]),
      ]
        .map((id) => byId.get(id))
        .filter((a): a is Asset => !!a)
        .slice(0, 6)

  const pages = ALL_NAV.filter(
    (p) => !q || includes(p.label, q) || includes(p.description, q)
  ).slice(0, q ? 6 : 16)
  const listHits = q ? lists.filter((l) => includes(l.name, q)).slice(0, 4) : []
  const noteHits = q
    ? notes
        .filter(
          (n) =>
            includes(n.title, q) ||
            n.tags.some((t) => includes(t, q)) ||
            includes(n.body, q)
        )
        .slice(0, 5)
    : []
  const thesisHits = q
    ? theses
        .filter((t) => includes(t.title, q) || includes(t.summary, q))
        .slice(0, 4)
    : []
  const alertHits = q
    ? alerts.filter((a) => includes(describeAlert(a), q)).slice(0, 4)
    : []
  const screenHits = q
    ? screens.filter((s) => includes(s.name, q)).slice(0, 4)
    : []

  const close = () => {
    setOpen(false)
    setQuery("")
  }
  const go = (path: string) => {
    navigate(path)
    close()
  }

  const actions = [
    ...(contextAsset
      ? [
          {
            id: "ctx-chart",
            label: `Open ${contextAsset.name} in Chart Studio`,
            icon: CandlestickChart,
            run: () => navigate(`/chart?asset=${contextAsset.id}`),
          },
          {
            id: "ctx-alert",
            label: `Create an alert for ${contextAsset.name}`,
            icon: BellPlus,
            run: () => navigate(`/alerts?new=${contextAsset.id}`),
          },
          {
            id: "ctx-note",
            label: `New note about ${contextAsset.name}`,
            icon: FilePlus2,
            run: () => {
              const n = researchActions.createNote({
                title: `${contextAsset.name} notes`,
                assetIds: [contextAsset.id],
              })
              navigate(`/research?note=${n.id}`)
            },
          },
        ]
      : []),
    {
      id: "note",
      label: "New research note",
      icon: FilePlus2,
      run: () => navigate(`/research?note=${researchActions.createNote().id}`),
    },
    {
      id: "thesis",
      label: "New thesis",
      icon: NotebookPen,
      run: () => navigate(`/journal/${journalActions.create().id}`),
    },
    {
      id: "tx",
      label: "Add a transaction",
      icon: Plus,
      run: () => navigate("/portfolio", { state: { addTransaction: true } }),
    },
    {
      id: "alert",
      label: "Create an alert",
      icon: BellPlus,
      run: () => navigate("/alerts?new=1"),
    },
    {
      id: "compare",
      label: "Compare assets",
      icon: GitCompareArrows,
      run: () => navigate("/compare"),
    },
    {
      id: "light",
      label: "Use light theme",
      icon: Sun,
      run: () => setTheme("light"),
    },
    {
      id: "dark",
      label: "Use dark theme",
      icon: Moon,
      run: () => setTheme("dark"),
    },
    {
      id: "system",
      label: "Match system theme",
      icon: Monitor,
      run: () => setTheme("system"),
    },
  ].filter((a) => !q || includes(a.label, q))

  const assetItem = (a: Asset, prefix: string) => (
    <Command.Item
      key={prefix + a.id}
      value={`${prefix}${a.id}`}
      onSelect={() => go(`/markets/${a.id}`)}
      className={itemClass}
    >
      <AssetIcon src={a.image} symbol={a.symbol} size={20} />
      <span className="min-w-0 flex-1 truncate">
        {a.name} <span className="mono text-xs text-ink-3">{a.symbol}</span>
      </span>
      <span className="num text-ink-2">{formatPrice(a.price)}</span>
      <Change
        value={a.change24h}
        className="hidden w-16 text-right text-xs sm:inline"
      />
    </Command.Item>
  )

  const nothing =
    q.length > 0 &&
    !local.length &&
    !remoteHits.length &&
    !pages.length &&
    !actions.length &&
    !listHits.length &&
    !noteHits.length &&
    !thesisHits.length &&
    !alertHits.length

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
    >
      <DialogContent
        showCloseButton={false}
        className="gap-0 p-0 sm:top-[10vh] sm:max-w-2xl sm:translate-y-0 sm:p-0"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Search CoinWave</DialogTitle>
        <Command
          shouldFilter={false}
          loop
          label="Search assets, workspaces, saved work and actions"
        >
          <div className="flex items-center gap-2 border-b border-rule px-4">
            <Search className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search assets, notes, theses, watchlists, actions…"
              className="h-12 w-full bg-transparent text-base text-ink outline-none placeholder:text-ink-3 sm:text-sm"
            />
          </div>
          <Command.List className="max-h-[min(62svh,30rem)] overflow-y-auto overscroll-contain pb-2">
            {nothing && !remote.isFetching && (
              <p className="px-5 py-8 text-center text-[0.8125rem] text-ink-2">
                Nothing matches “{query.trim()}”.
              </p>
            )}
            {suggestions.length > 0 && (
              <Command.Group
                heading="Recent and watched"
                className={groupClass}
              >
                {suggestions.map((a) => assetItem(a, "s:"))}
              </Command.Group>
            )}
            {local.length > 0 && (
              <Command.Group heading="Assets" className={groupClass}>
                {local.map((a) => assetItem(a, "a:"))}
              </Command.Group>
            )}
            {q.length >= 2 && (remoteHits.length > 0 || remote.isFetching) && (
              <Command.Group
                heading="All assets on CoinGecko"
                className={groupClass}
              >
                {remoteHits.map((hit) => (
                  <Command.Item
                    key={hit.id}
                    value={`r:${hit.id}`}
                    onSelect={() => go(`/markets/${hit.id}`)}
                    className={itemClass}
                  >
                    <AssetIcon src={hit.thumb} symbol={hit.symbol} size={20} />
                    <span className="min-w-0 flex-1 truncate">
                      {hit.name}{" "}
                      <span className="mono text-xs text-ink-3">
                        {hit.symbol}
                      </span>
                    </span>
                    <span className="text-xs text-ink-3">
                      {hit.rank ? `#${hit.rank}` : "Unranked"}
                    </span>
                  </Command.Item>
                ))}
                {remote.isFetching && remoteHits.length === 0 && (
                  <Command.Loading>
                    <p className="px-3 py-2 text-[0.8125rem] text-ink-3">
                      Searching CoinGecko…
                    </p>
                  </Command.Loading>
                )}
              </Command.Group>
            )}
            {listHits.length > 0 && (
              <Command.Group heading="Watchlists" className={groupClass}>
                {listHits.map((l) => (
                  <Command.Item
                    key={l.id}
                    value={`w:${l.id}`}
                    onSelect={() => go(`/watchlists?list=${l.id}`)}
                    className={itemClass}
                  >
                    <ListChecks aria-hidden="true" />
                    <span className="flex-1 truncate">{l.name}</span>
                    <span className="text-xs text-ink-3">
                      {l.items.length} assets
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
            {noteHits.length > 0 && (
              <Command.Group heading="Research" className={groupClass}>
                {noteHits.map((n) => (
                  <Command.Item
                    key={n.id}
                    value={`n:${n.id}`}
                    onSelect={() => go(`/research?note=${n.id}`)}
                    className={itemClass}
                  >
                    <BookOpenText aria-hidden="true" />
                    <span className="flex-1 truncate">
                      {n.title || "Untitled note"}
                    </span>
                    <span className="text-xs text-ink-3">
                      {n.kind === "article"
                        ? "Saved article"
                        : n.kind === "comparison"
                          ? "Comparison"
                          : "Note"}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
            {thesisHits.length > 0 && (
              <Command.Group heading="Theses" className={groupClass}>
                {thesisHits.map((t) => (
                  <Command.Item
                    key={t.id}
                    value={`t:${t.id}`}
                    onSelect={() => go(`/journal/${t.id}`)}
                    className={itemClass}
                  >
                    <NotebookPen aria-hidden="true" />
                    <span className="flex-1 truncate">
                      {t.title || "Untitled thesis"}
                    </span>
                    <span className="text-xs text-ink-3 capitalize">
                      {t.status}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
            {alertHits.length > 0 && (
              <Command.Group heading="Alerts" className={groupClass}>
                {alertHits.map((a) => (
                  <Command.Item
                    key={a.id}
                    value={`al:${a.id}`}
                    onSelect={() => go("/alerts")}
                    className={itemClass}
                  >
                    <BellPlus aria-hidden="true" />
                    <span className="flex-1 truncate">{describeAlert(a)}</span>
                    <span className="text-xs text-ink-3 capitalize">
                      {a.status}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
            {screenHits.length > 0 && (
              <Command.Group heading="Saved screens" className={groupClass}>
                {screenHits.map((sc) => (
                  <Command.Item
                    key={sc.id}
                    value={`sc:${sc.id}`}
                    onSelect={() => go(`/screener?${savedScreenQuery(sc)}`)}
                    className={itemClass}
                  >
                    <ScanSearch aria-hidden="true" />
                    <span className="flex-1 truncate">{sc.name}</span>
                    <span className="text-xs text-ink-3">Screen</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
            {pages.length > 0 && (
              <Command.Group heading="Go to" className={groupClass}>
                {pages.map(({ to, label, icon: Icon, key }) => (
                  <Command.Item
                    key={to}
                    value={`p:${to}`}
                    onSelect={() => go(to)}
                    className={itemClass}
                  >
                    <Icon aria-hidden="true" />
                    <span className="flex-1">{label}</span>
                    <span className="mono text-[10px] text-ink-3">g {key}</span>
                    <ArrowRight aria-hidden="true" />
                  </Command.Item>
                ))}
              </Command.Group>
            )}
            {actions.length > 0 && (
              <Command.Group heading="Actions" className={groupClass}>
                {actions.map(({ id, label, icon: Icon, run }) => (
                  <Command.Item
                    key={id}
                    value={`x:${id}`}
                    onSelect={() => {
                      run()
                      close()
                    }}
                    className={itemClass}
                  >
                    <Icon aria-hidden="true" />
                    <span className="flex-1">{label}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
