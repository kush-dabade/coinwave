import { lazy } from "react"
import { Navigate, RouterProvider, createBrowserRouter } from "react-router-dom"

import { AppShell } from "@/components/layout/AppShell"
import CommandCenterPage from "@/pages/CommandCenterPage"

// The Command Center is the landing page and ships in the main bundle;
// every other workspace loads on first visit.
const MarketsPage = lazy(() => import("@/pages/MarketsPage"))
const AssetPage = lazy(() => import("@/pages/AssetPage"))
const ScreenerPage = lazy(() => import("@/pages/ScreenerPage"))
const ChartStudioPage = lazy(() => import("@/pages/ChartStudioPage"))
const ComparePage = lazy(() => import("@/pages/ComparePage"))
const IntelligencePage = lazy(() => import("@/pages/IntelligencePage"))
const NewsPage = lazy(() => import("@/pages/NewsPage"))
const PortfolioPage = lazy(() => import("@/pages/PortfolioPage"))
const RiskPage = lazy(() => import("@/pages/RiskPage"))
const WatchlistsPage = lazy(() => import("@/pages/WatchlistsPage"))
const AlertsPage = lazy(() => import("@/pages/AlertsPage"))
const ResearchPage = lazy(() => import("@/pages/ResearchPage"))
const JournalPage = lazy(() => import("@/pages/JournalPage"))
const DataStatusPage = lazy(() => import("@/pages/DataStatusPage"))
const SettingsPage = lazy(() => import("@/pages/SettingsPage"))
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"))

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <CommandCenterPage /> },
      { path: "markets", element: <MarketsPage /> },
      { path: "markets/:id", element: <AssetPage /> },
      { path: "screener", element: <ScreenerPage /> },
      { path: "chart", element: <ChartStudioPage /> },
      { path: "compare", element: <ComparePage /> },
      { path: "intelligence", element: <IntelligencePage /> },
      { path: "news", element: <NewsPage /> },
      { path: "portfolio", element: <PortfolioPage /> },
      { path: "risk", element: <RiskPage /> },
      { path: "watchlists", element: <WatchlistsPage /> },
      { path: "alerts", element: <AlertsPage /> },
      { path: "research", element: <ResearchPage /> },
      { path: "journal", element: <JournalPage /> },
      { path: "journal/:id", element: <JournalPage /> },
      { path: "status", element: <DataStatusPage /> },
      { path: "settings", element: <SettingsPage /> },
      // Routes from earlier versions.
      { path: "dashboard", element: <Navigate to="/" replace /> },
      { path: "analysis", element: <Navigate to="/intelligence" replace /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
