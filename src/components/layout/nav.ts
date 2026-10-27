import {
  Activity,
  BellRing,
  BookOpenText,
  CandlestickChart,
  Filter,
  GitCompareArrows,
  LayoutDashboard,
  LineChart,
  ListChecks,
  Newspaper,
  NotebookPen,
  Settings,
  ShieldAlert,
  Signal,
  Wallet,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  /** Second key of the "g" navigation shortcut (g then key). */
  key: string
  description: string
  end?: boolean
}

export type NavGroup = { label: string | null; items: NavItem[] }

/**
 * The single definition of CoinWave's workspaces. Sidebar, mobile menu,
 * command palette and keyboard shortcuts are all derived from it.
 */
export const NAV: NavGroup[] = [
  {
    label: null,
    items: [
      {
        to: "/",
        label: "Command Center",
        icon: LayoutDashboard,
        key: "h",
        end: true,
        description:
          "Market conditions, your positions, alerts and research at a glance.",
      },
    ],
  },
  {
    label: "Markets",
    items: [
      {
        to: "/markets",
        label: "Markets",
        icon: LineChart,
        key: "m",
        description:
          "The 250 largest assets: sortable, filterable, with categories and watchlists.",
      },
      {
        to: "/screener",
        label: "Screener",
        icon: Filter,
        key: "s",
        description: "Combine real criteria, use presets and save screens.",
      },
      {
        to: "/chart",
        label: "Chart Studio",
        icon: CandlestickChart,
        key: "c",
        description: "Candlesticks, indicators and comparisons.",
      },
      {
        to: "/compare",
        label: "Compare",
        icon: GitCompareArrows,
        key: "o",
        description:
          "Normalised performance, volatility and correlation side by side.",
      },
      {
        to: "/intelligence",
        label: "Intelligence",
        icon: Activity,
        key: "i",
        description: "Breadth, sectors, sentiment, stablecoin liquidity.",
      },
      {
        to: "/news",
        label: "News",
        icon: Newspaper,
        key: "n",
        description: "Headlines from major crypto publishers, tagged by asset.",
      },
    ],
  },
  {
    label: "Portfolio",
    items: [
      {
        to: "/portfolio",
        label: "Portfolio",
        icon: Wallet,
        key: "p",
        description: "Holdings, performance, attribution and transactions.",
      },
      {
        to: "/risk",
        label: "Risk Lab",
        icon: ShieldAlert,
        key: "k",
        description:
          "Concentration, volatility, correlation and stress scenarios.",
      },
    ],
  },
  {
    label: "Workflow",
    items: [
      {
        to: "/watchlists",
        label: "Watchlists",
        icon: ListChecks,
        key: "w",
        description: "Several named lists with notes and context.",
      },
      {
        to: "/alerts",
        label: "Alerts",
        icon: BellRing,
        key: "a",
        description: "Price, change, volume and portfolio conditions.",
      },
      {
        to: "/research",
        label: "Research",
        icon: BookOpenText,
        key: "r",
        description: "Notes, saved articles and collections.",
      },
      {
        to: "/journal",
        label: "Journal",
        icon: NotebookPen,
        key: "j",
        description: "Theses, decisions and their outcomes.",
      },
    ],
  },
]

export const SYSTEM_NAV: NavItem[] = [
  {
    to: "/status",
    label: "Data status",
    icon: Signal,
    key: "d",
    description: "Source health, freshness and cached data.",
  },
  {
    to: "/settings",
    label: "Settings",
    icon: Settings,
    key: ",",
    description: "Preferences, local data, export and import.",
  },
]

export const ALL_NAV: NavItem[] = [
  ...NAV.flatMap((g) => g.items),
  ...SYSTEM_NAV,
]

/** Phone tab bar: the checks people make on the go. */
export const MOBILE_TABS = ["/", "/markets", "/watchlists", "/portfolio"]
