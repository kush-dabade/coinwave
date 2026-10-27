import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { Bell, ChevronsLeft, ChevronsRight, Menu, Search } from "lucide-react"
import {
  Link,
  NavLink,
  Outlet,
  ScrollRestoration,
  useLocation,
} from "react-router-dom"
import { Toaster } from "sonner"

import { AlertMonitor } from "@/components/alerts/AlertMonitor"
import { Change } from "@/components/data/Change"
import { Skeleton } from "@/components/data/states"
import { CommandPalette } from "@/components/layout/CommandPalette"
import { DataStatus } from "@/components/layout/DataStatus"
import { Logo, LogoMark } from "@/components/layout/Logo"
import {
  ALL_NAV,
  MOBILE_TABS,
  NAV,
  SYSTEM_NAV,
  type NavItem,
} from "@/components/layout/nav"
import { ThemeMenu } from "@/components/layout/ThemeMenu"
import { useTheme } from "@/components/theme-provider"
import { Kbd } from "@/components/ui/controls"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { useFearGreed, useGlobalMarket, useUniverse } from "@/hooks/queries"
import {
  CommandPaletteContext,
  useCommandPalette,
} from "@/hooks/use-command-palette"
import { useShortcuts } from "@/hooks/use-shortcuts"
import {
  formatCompactMoney,
  formatPrice,
  formatShare,
  isNum,
} from "@/lib/format"
import { readJSON, writeJSON } from "@/lib/storage"
import { cn } from "@/lib/utils"
import { useAlerts } from "@/stores"

const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)

function SideLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          "group relative flex h-8 items-center gap-2.5 rounded-md px-2 text-[0.8125rem] transition-colors",
          isActive
            ? "bg-surface-2 font-medium text-ink"
            : "text-ink-2 hover:bg-surface-2/60 hover:text-ink",
          collapsed && "justify-center px-0"
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-accent" />
          )}
          <Icon
            className={cn(
              "size-4 shrink-0",
              isActive ? "text-accent" : "text-ink-3 group-hover:text-ink-2"
            )}
            aria-hidden="true"
          />
          <span className={cn(collapsed && "sr-only")}>{item.label}</span>
        </>
      )}
    </NavLink>
  )
}

function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-svh shrink-0 flex-col border-r border-rule bg-surface lg:flex",
        collapsed ? "w-14" : "w-56"
      )}
    >
      <div
        className={cn(
          "flex h-12 items-center border-b border-rule",
          collapsed ? "justify-center" : "px-3"
        )}
      >
        <Link
          to="/"
          aria-label="CoinWave Command Center"
          className="rounded-sm"
        >
          {collapsed ? <LogoMark /> : <Logo />}
        </Link>
      </div>
      <nav aria-label="Workspaces" className="flex-1 overflow-y-auto px-2 py-2">
        {NAV.map((group, gi) => (
          <div key={gi} className={cn(gi > 0 && "mt-4")}>
            {group.label && !collapsed && (
              <p className="eyebrow mb-1 px-2">{group.label}</p>
            )}
            {group.label && collapsed && (
              <div className="mx-2 mb-2 border-t border-rule" />
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <SideLink item={item} collapsed={collapsed} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-rule px-2 py-2">
        <ul className="space-y-0.5">
          {SYSTEM_NAV.map((item) => (
            <li key={item.to}>
              <SideLink item={item} collapsed={collapsed} />
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "mt-1 flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-[0.8125rem] text-ink-3 hover:bg-surface-2/60 hover:text-ink",
            collapsed && "justify-center px-0"
          )}
        >
          {collapsed ? (
            <ChevronsRight className="size-4" aria-hidden="true" />
          ) : (
            <ChevronsLeft className="size-4" aria-hidden="true" />
          )}
          {!collapsed && "Collapse"}
        </button>
      </div>
    </aside>
  )
}

/** Always-on market context, built from data the app already holds. */
function MarketTape() {
  const universe = useUniverse()
  const global = useGlobalMarket()
  const fg = useFearGreed()
  const assets = useMemo(() => universe.data ?? [], [universe.data])
  const majors = ["bitcoin", "ethereum", "solana"]
    .map((id) => assets.find((a) => a.id === id))
    .filter((a) => !!a)
  const agg = useMemo(() => {
    let cap = 0
    let now = 0
    let before = 0
    for (const a of assets) {
      if (!isNum(a.marketCap)) continue
      cap += a.marketCap
      if (isNum(a.marketCapChange24h)) {
        now += a.marketCap
        before += a.marketCap - a.marketCapChange24h
      }
    }
    return { cap, change: before > 0 ? (now / before - 1) * 100 : null }
  }, [assets])

  if (!universe.data)
    return (
      <div
        className="hidden h-8 border-b border-rule bg-bg lg:block"
        aria-hidden="true"
      />
    )
  return (
    <div
      // Fades out at the right edge where the strip is cut by narrower screens.
      className="hidden h-8 items-center gap-5 overflow-x-auto border-b border-rule bg-bg [mask-image:linear-gradient(to_right,#000_calc(100%-3rem),transparent)] px-4 text-xs whitespace-nowrap lg:flex"
      aria-label="Market summary"
    >
      {majors.map((a) => (
        <Link
          key={a.id}
          to={`/markets/${a.id}`}
          className="inline-flex items-center gap-1.5 hover:text-ink"
        >
          <span className="mono font-medium text-ink-2">{a.symbol}</span>
          <span className="num text-ink">{formatPrice(a.price)}</span>
          <Change value={a.change24h} className="text-[0.6875rem]" />
        </Link>
      ))}
      <span className="h-3 w-px bg-rule-strong" aria-hidden="true" />
      <span className="inline-flex items-center gap-1.5">
        <span className="text-ink-3">Top 250 cap</span>
        <span className="num text-ink">{formatCompactMoney(agg.cap)}</span>
        <Change value={agg.change} className="text-[0.6875rem]" />
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="text-ink-3">BTC dominance</span>
        <span className="num text-ink">
          {formatShare(global.data?.btcDominance)}
        </span>
      </span>
      {fg.data && (
        <span className="inline-flex items-center gap-1.5">
          <span className="text-ink-3">Fear &amp; Greed</span>
          <span className="num text-ink">{fg.data.value}</span>
          <span className="text-ink-3">{fg.data.label}</span>
        </span>
      )}
    </div>
  )
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const { setOpen } = useCommandPalette()
  const { alerts } = useAlerts()
  const triggered = alerts.filter((a) => a.status === "triggered").length
  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <div className="flex h-12 items-center gap-2 px-3 sm:px-4">
        <Link
          to="/"
          aria-label="CoinWave Command Center"
          className="rounded-sm lg:hidden"
        >
          <Logo />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="ml-auto hidden h-8 w-72 items-center gap-2 rounded-md border border-rule-strong bg-bg px-2.5 text-[0.8125rem] text-ink-3 transition-colors hover:border-ink-3 hover:text-ink-2 md:flex lg:ml-0"
        >
          <Search className="size-4" aria-hidden="true" />
          <span className="flex-1 text-left">
            Search assets, notes, actions…
          </span>
          <Kbd>{isMac ? "⌘K" : "Ctrl K"}</Kbd>
        </button>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Search"
            className="inline-flex size-8 items-center justify-center rounded-md text-ink-2 hover:bg-surface-2 hover:text-ink md:hidden"
          >
            <Search className="size-[18px]" aria-hidden="true" />
          </button>
          <DataStatus />
          <Link
            to="/alerts"
            aria-label={triggered ? `Alerts: ${triggered} triggered` : "Alerts"}
            className="relative inline-flex size-8 items-center justify-center rounded-md text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            <Bell className="size-[18px]" aria-hidden="true" />
            {triggered > 0 && (
              <span className="num absolute top-0.5 right-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-warn px-1 text-[10px] leading-4 font-semibold text-bg">
                {triggered}
              </span>
            )}
          </Link>
          <ThemeMenu />
          <button
            type="button"
            onClick={onMenu}
            aria-label="All workspaces"
            className="inline-flex size-8 items-center justify-center rounded-md text-ink-2 hover:bg-surface-2 hover:text-ink lg:hidden"
          >
            <Menu className="size-[18px]" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  )
}

function MobileTabs({ onMore }: { onMore: () => void }) {
  const items = MOBILE_TABS.map((to) => ALL_NAV.find((n) => n.to === to)!)
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto grid h-14 max-w-lg grid-cols-5">
        {items.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "relative flex h-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
                  isActive
                    ? "text-ink before:absolute before:inset-x-4 before:top-0 before:h-0.5 before:bg-accent"
                    : "text-ink-3"
                )
              }
            >
              <Icon className="size-5" aria-hidden="true" />
              {label === "Command Center" ? "Home" : label}
            </NavLink>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={onMore}
            className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-ink-3"
          >
            <Menu className="size-5" aria-hidden="true" />
            More
          </button>
        </li>
      </ul>
    </nav>
  )
}

function MoreSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  // Close on the user's own navigation rather than on a pathname change:
  // route changes commit late (after a lazy page loads), which would shut a
  // sheet opened in the meantime.
  useEffect(() => {
    if (!open) return
    const close = () => onOpenChange(false)
    window.addEventListener("popstate", close)
    return () => window.removeEventListener("popstate", close)
  }, [open, onOpenChange])
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="All workspaces" side="bottom">
        <nav
          aria-label="All workspaces"
          className="grid gap-4 p-3 sm:grid-cols-2"
        >
          {[...NAV, { label: "System", items: SYSTEM_NAV }].map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <p className="eyebrow mb-1 px-2">{group.label}</p>
              )}
              <ul>
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={() => onOpenChange(false)}
                      className={({ isActive }) =>
                        cn(
                          "flex items-start gap-3 rounded-md px-2 py-2",
                          isActive ? "bg-surface-2" : "hover:bg-surface-2/60"
                        )
                      }
                    >
                      <item.icon
                        className="mt-0.5 size-4 shrink-0 text-ink-3"
                        aria-hidden="true"
                      />
                      <span>
                        <span className="block text-[0.8125rem] font-medium text-ink">
                          {item.label}
                        </span>
                        <span className="block text-xs text-ink-3">
                          {item.description}
                        </span>
                      </span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  )
}

function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Shortcuts are ignored while you are typing in a field.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[0.8125rem]">
          <dt className="flex gap-1">
            <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
            <Kbd>K</Kbd>
          </dt>
          <dd className="text-ink-2">Search everything</dd>
          <dt>
            <Kbd>/</Kbd>
          </dt>
          <dd className="text-ink-2">Search</dd>
          <dt>
            <Kbd>?</Kbd>
          </dt>
          <dd className="text-ink-2">This list</dd>
          {ALL_NAV.map((n) => (
            <div key={n.to} className="contents">
              <dt className="flex gap-1">
                <Kbd>g</Kbd>
                <Kbd>{n.key}</Kbd>
              </dt>
              <dd className="text-ink-2">{n.label}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  )
}

function PageFallback() {
  return (
    <div className="px-5 pt-5" aria-busy="true">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="mt-4 h-64 w-full" />
    </div>
  )
}

/** Moves focus to the page content after client-side navigation. */
function useRouteFocus() {
  const { pathname } = useLocation()
  const first = useRef(true)
  const mainRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    mainRef.current?.focus({ preventScroll: true })
  }, [pathname])
  return mainRef
}

const SIDEBAR_KEY = "coinwave:sidebar-collapsed"

export function AppShell() {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(
    () => readJSON<boolean>(SIDEBAR_KEY, false) === true
  )
  const { resolvedTheme } = useTheme()
  const mainRef = useRouteFocus()
  const openHelp = useCallback(() => setHelpOpen(true), [])
  useShortcuts(openHelp)

  const toggleSidebar = () => {
    setCollapsed((c) => {
      writeJSON(SIDEBAR_KEY, !c)
      return !c
    })
  }

  return (
    <CommandPaletteContext.Provider
      value={{ open: paletteOpen, setOpen: setPaletteOpen }}
    >
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-accent px-3 py-2 text-accent-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <div className="flex min-h-svh">
        <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar onMenu={() => setMoreOpen(true)} />
          <MarketTape />
          <main
            id="main"
            ref={mainRef}
            tabIndex={-1}
            className="min-w-0 flex-1 outline-none"
          >
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </main>
          <footer className="border-t border-rule px-4 py-4 text-[0.6875rem] leading-5 text-ink-3 sm:px-5">
            Data: CoinGecko, Binance public market data, Alternative.me,
            DefiLlama and publisher RSS feeds, refreshed while this tab is open
            and possibly delayed. Charts: TradingView Lightweight Charts™,
            copyright © TradingView, Inc.,{" "}
            <a
              href="https://www.tradingview.com/"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-ink"
            >
              tradingview.com
            </a>
            . Your portfolio, watchlists, alerts and research are stored only in
            this browser. CoinWave is an information tool, not financial advice,
            and never executes trades.
          </footer>
          <div
            className="h-[calc(3.5rem+env(safe-area-inset-bottom))] lg:hidden"
            aria-hidden="true"
          />
        </div>
      </div>
      <MobileTabs onMore={() => setMoreOpen(true)} />
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
      <ShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
      <CommandPalette />
      <AlertMonitor />
      <Toaster
        theme={resolvedTheme}
        position="bottom-right"
        mobileOffset={{ bottom: 72 }}
        toastOptions={{
          classNames: {
            toast: "!bg-surface !text-ink !border-rule !shadow-pop !rounded-md",
            description: "!text-ink-2",
            actionButton: "!bg-accent !text-accent-ink",
          },
        }}
      />
      <ScrollRestoration />
    </CommandPaletteContext.Provider>
  )
}
