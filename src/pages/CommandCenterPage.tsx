import { useSearchParams } from "react-router-dom"
import { ArrowDown, ArrowUp, SlidersHorizontal } from "lucide-react"

import {
  AlertsWidget,
  MajorsWidget,
  MapWidget,
  MoversWidget,
  NewsWidget,
  PortfolioWidget,
  PulseWidget,
  RecentWidget,
  ResearchWidget,
  SectorsWidget,
  WatchlistWidget,
} from "@/components/command/widgets"
import { Page, PageHeader } from "@/components/layout/Page"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/controls"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { usePageTitle } from "@/hooks/use-ui"
import { cn } from "@/lib/utils"
import { DEFAULT_SETTINGS, WIDGETS, type WidgetId } from "@/lib/workspace"
import { updateSettings, useSettings } from "@/stores"

const RENDER: Record<WidgetId, { node: () => React.ReactNode; span: string }> =
  {
    pulse: { node: () => <PulseWidget />, span: "lg:col-span-12" },
    majors: {
      node: () => <MajorsWidget />,
      span: "lg:col-span-6 xl:col-span-4",
    },
    portfolio: {
      node: () => <PortfolioWidget />,
      span: "lg:col-span-6 xl:col-span-4",
    },
    alerts: {
      node: () => <AlertsWidget />,
      span: "lg:col-span-6 xl:col-span-4",
    },
    watchlist: { node: () => <WatchlistWidget />, span: "lg:col-span-6" },
    movers: { node: () => <MoversWidget />, span: "lg:col-span-6" },
    research: {
      node: () => <ResearchWidget />,
      span: "lg:col-span-6 xl:col-span-4",
    },
    news: { node: () => <NewsWidget />, span: "lg:col-span-6 xl:col-span-4" },
    recent: {
      node: () => <RecentWidget />,
      span: "lg:col-span-6 xl:col-span-4",
    },
    sectors: {
      node: () => <SectorsWidget />,
      span: "lg:col-span-6 xl:col-span-4",
    },
    map: { node: () => <MapWidget />, span: "lg:col-span-6" },
  }

const dayLine = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
})

export default function CommandCenterPage() {
  usePageTitle("Command Center")
  const { widgets } = useSettings()
  // Kept in the URL so Settings can link straight to the customize sheet.
  const [params, setParams] = useSearchParams()
  const customizing = params.get("customize") === "1"
  const setCustomizing = (open: boolean) =>
    setParams(open ? { customize: "1" } : {}, { replace: true })
  const visible = widgets.filter((w) => w.visible)

  const move = (id: WidgetId, delta: -1 | 1) => {
    const i = widgets.findIndex((w) => w.id === id)
    const j = i + delta
    if (j < 0 || j >= widgets.length) return
    const next = [...widgets]
    ;[next[i], next[j]] = [next[j], next[i]]
    updateSettings({ widgets: next })
  }

  return (
    <Page>
      <PageHeader
        title="Command Center"
        description={`${dayLine.format(new Date())} · prices in USD`}
        actions={
          <Button size="sm" onClick={() => setCustomizing(true)}>
            <SlidersHorizontal aria-hidden="true" /> Customize
          </Button>
        }
      />
      {visible.length === 0 ? (
        <p className="text-ink-2">
          All widgets are hidden. Use Customize to show some.
        </p>
      ) : (
        <div className="grid grid-flow-row-dense grid-cols-1 gap-3 lg:grid-cols-12">
          {visible.map((w) => (
            <div
              key={w.id}
              // Panes stretch to the row so neighbours line up without holes.
              className={cn("min-w-0 [&>section]:h-full", RENDER[w.id].span)}
            >
              {RENDER[w.id].node()}
            </div>
          ))}
        </div>
      )}

      <Sheet open={customizing} onOpenChange={setCustomizing}>
        <SheetContent
          title="Customize Command Center"
          description="Show, hide and reorder widgets. Saved in this browser."
        >
          <ol className="divide-y divide-rule">
            {widgets.map((w, i) => {
              const label = WIDGETS.find((x) => x.id === w.id)?.label ?? w.id
              return (
                <li key={w.id} className="flex items-center gap-2 px-4 py-2.5">
                  <div className="flex-1">
                    <Switch
                      label={label}
                      checked={w.visible}
                      onChange={(v) =>
                        updateSettings({
                          widgets: widgets.map((x) =>
                            x.id === w.id ? { ...x, visible: v } : x
                          ),
                        })
                      }
                    />
                  </div>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Move ${label} up`}
                    disabled={i === 0}
                    onClick={() => move(w.id, -1)}
                  >
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Move ${label} down`}
                    disabled={i === widgets.length - 1}
                    onClick={() => move(w.id, 1)}
                  >
                    <ArrowDown aria-hidden="true" />
                  </Button>
                </li>
              )
            })}
          </ol>
          <div className="px-4 py-3">
            <Button
              size="sm"
              onClick={() =>
                updateSettings({ widgets: DEFAULT_SETTINGS.widgets })
              }
            >
              Reset to default
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </Page>
  )
}
