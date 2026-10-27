import { useEffect, useMemo, useRef, useState } from "react"
import {
  BellPlus,
  ChevronDown,
  LayoutTemplate,
  Maximize2,
  Minimize2,
  Plus,
  Save,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react"
import { Link, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { AlertDialog } from "@/components/alerts/AlertDialog"
import { StudioChart } from "@/components/charts/StudioChart"
import { AssetIcon } from "@/components/data/AssetIcon"
import { Change } from "@/components/data/Change"
import { ErrorNotice, Skeleton } from "@/components/data/states"
import { WatchButton } from "@/components/data/WatchButton"
import { Page } from "@/components/layout/Page"
import {
  AssetPicker,
  type PickedAsset,
} from "@/components/portfolio/AssetPicker"
import { Button } from "@/components/ui/button"
import {
  Badge,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Segmented,
  Switch,
} from "@/components/ui/controls"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { NameDialog } from "@/components/ui/name-dialog"
import { isFailing, useAsset, useCandles } from "@/hooks/queries"
import { usePageTitle } from "@/hooks/use-ui"
import { formatPrice } from "@/lib/format"
import { newId } from "@/lib/portfolio"
import {
  type ChartInterval,
  type ChartType,
  type IndicatorConfig,
} from "@/lib/workspace"
import {
  layoutsStore,
  updateSettings,
  useChartLayouts,
  useSettings,
} from "@/stores"

const INTERVALS: { value: ChartInterval; label: string; title: string }[] = [
  { value: "15m", label: "15m", title: "15-minute candles" },
  { value: "1h", label: "1H", title: "Hourly candles" },
  { value: "4h", label: "4H", title: "4-hour candles" },
  { value: "1d", label: "1D", title: "Daily candles" },
  { value: "1w", label: "1W", title: "Weekly candles" },
]

function PeriodInput({
  label,
  value,
  onChange,
  max = 400,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  max?: number
}) {
  const [text, setText] = useState(String(value))
  const commit = () => {
    const n = Math.round(Number(text))
    if (Number.isFinite(n) && n >= 1 && n <= max) onChange(n)
    else setText(String(value))
  }
  return (
    <label className="flex items-center gap-1 text-xs text-ink-3">
      {label}
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        inputMode="numeric"
        className="num h-7 w-14 px-1.5"
      />
    </label>
  )
}

function IndicatorsMenu({
  value,
  onChange,
  disabled,
}: {
  value: IndicatorConfig
  onChange: (v: IndicatorConfig) => void
  disabled: boolean
}) {
  const set = <K extends keyof IndicatorConfig>(k: K, v: IndicatorConfig[K]) =>
    onChange({ ...value, [k]: v })
  const count = [
    value.sma.enabled,
    value.ema.enabled,
    value.bollinger.enabled,
    value.volume,
    value.rsi.enabled,
    value.macd.enabled,
  ].filter(Boolean).length
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          disabled={disabled}
          title={
            disabled
              ? "Indicators are hidden while comparing assets"
              : undefined
          }
        >
          <SlidersHorizontal aria-hidden="true" /> Indicators{" "}
          <Badge>{count}</Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3">
        <div>
          <Switch
            label="Simple moving averages"
            checked={value.sma.enabled}
            onChange={(v) => set("sma", { ...value.sma, enabled: v })}
          />
          {value.sma.enabled && (
            <div className="mt-1.5 flex gap-2">
              {value.sma.periods.map((p, i) => (
                <PeriodInput
                  key={i}
                  label={`SMA ${i + 1}`}
                  value={p}
                  onChange={(n) =>
                    set("sma", {
                      ...value.sma,
                      periods: value.sma.periods.map((x, j) =>
                        j === i ? n : x
                      ),
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>
        <div>
          <Switch
            label="Exponential moving average"
            checked={value.ema.enabled}
            onChange={(v) => set("ema", { ...value.ema, enabled: v })}
          />
          {value.ema.enabled && (
            <div className="mt-1.5">
              <PeriodInput
                label="Period"
                value={value.ema.periods[0]}
                onChange={(n) => set("ema", { ...value.ema, periods: [n] })}
              />
            </div>
          )}
        </div>
        <div>
          <Switch
            label="Bollinger Bands"
            description="SMA ± 2 standard deviations"
            checked={value.bollinger.enabled}
            onChange={(v) =>
              set("bollinger", { ...value.bollinger, enabled: v })
            }
          />
          {value.bollinger.enabled && (
            <div className="mt-1.5">
              <PeriodInput
                label="Period"
                value={value.bollinger.period}
                onChange={(n) =>
                  set("bollinger", { ...value.bollinger, period: n })
                }
              />
            </div>
          )}
        </div>
        <Switch
          label="Volume"
          description="Quote volume per candle (Binance only)"
          checked={value.volume}
          onChange={(v) => set("volume", v)}
        />
        <div>
          <Switch
            label="RSI"
            description="Wilder’s Relative Strength Index"
            checked={value.rsi.enabled}
            onChange={(v) => set("rsi", { ...value.rsi, enabled: v })}
          />
          {value.rsi.enabled && (
            <div className="mt-1.5">
              <PeriodInput
                label="Period"
                value={value.rsi.period}
                max={100}
                onChange={(n) => set("rsi", { ...value.rsi, period: n })}
              />
            </div>
          )}
        </div>
        <div>
          <Switch
            label="MACD"
            checked={value.macd.enabled}
            onChange={(v) => set("macd", { ...value.macd, enabled: v })}
          />
          {value.macd.enabled && (
            <div className="mt-1.5 flex gap-2">
              <PeriodInput
                label="Fast"
                value={value.macd.fast}
                max={100}
                onChange={(n) => set("macd", { ...value.macd, fast: n })}
              />
              <PeriodInput
                label="Slow"
                value={value.macd.slow}
                max={200}
                onChange={(n) => set("macd", { ...value.macd, slow: n })}
              />
              <PeriodInput
                label="Signal"
                value={value.macd.signal}
                max={100}
                onChange={(n) => set("macd", { ...value.macd, signal: n })}
              />
            </div>
          )}
        </div>
        <p className="text-[0.6875rem] text-ink-3">
          Indicators need enough candles; lines start where the calculation is
          defined.
        </p>
      </PopoverContent>
    </Popover>
  )
}

function AssetSwitcher({
  asset,
  onPick,
  label,
}: {
  asset: PickedAsset | null
  onPick: (a: PickedAsset) => void
  label: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {asset ? (
          <button
            type="button"
            className="inline-flex h-8 items-center gap-2 rounded-md border border-rule-strong bg-surface px-2 text-[0.8125rem] font-medium text-ink hover:bg-surface-2"
            aria-label={`${label}: ${asset.name}. Change`}
          >
            <AssetIcon src={asset.image} symbol={asset.symbol} size={18} />
            {asset.name}
            <ChevronDown className="size-3.5 text-ink-3" aria-hidden="true" />
          </button>
        ) : (
          <Button size="sm">
            <Plus aria-hidden="true" /> {label}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-2">
        <AssetPicker
          inputId={`picker-${label.replace(/\s+/g, "-")}`}
          value={null}
          suggestedIds={[]}
          onChange={(a) => {
            if (a) {
              onPick(a)
              setOpen(false)
            }
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

export default function ChartStudioPage() {
  const [params, setParams] = useSearchParams()
  const settings = useSettings()
  const layouts = useChartLayouts()
  const assetId = params.get("asset") || "bitcoin"
  const interval = (INTERVALS.find((i) => i.value === params.get("i"))?.value ??
    settings.chartDefaults.interval) as ChartInterval
  const type = (
    ["candles", "line", "area"].includes(params.get("t") ?? "")
      ? params.get("t")
      : settings.chartDefaults.type
  ) as ChartType
  const log = params.get("log") === "1"
  const compareIds = (params.get("cmp") ?? "")
    .split(",")
    .filter((x) => x && x !== assetId)
    .slice(0, 3)
  const indicators = settings.chartDefaults.indicators

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace: true })
  }

  const main = useAsset(assetId)
  const c1 = useAsset(compareIds[0] ?? "")
  const c2 = useAsset(compareIds[1] ?? "")
  const c3 = useAsset(compareIds[2] ?? "")
  const candles = useCandles(main.asset, interval)
  const k1 = useCandles(compareIds[0] ? c1.asset : null, interval)
  const k2 = useCandles(compareIds[1] ? c2.asset : null, interval)
  const k3 = useCandles(compareIds[2] ? c3.asset : null, interval)
  usePageTitle(main.asset ? `${main.asset.symbol} chart` : "Chart Studio")

  const compare = useMemo(
    () =>
      [
        [c1.asset, k1.data] as const,
        [c2.asset, k2.data] as const,
        [c3.asset, k3.data] as const,
      ].flatMap(([a, d]) =>
        a && d ? [{ id: a.id, label: a.symbol, candles: d.candles }] : []
      ),
    [c1.asset, c2.asset, c3.asset, k1.data, k2.data, k3.data]
  )

  const frame = useRef<HTMLDivElement>(null)
  const [fullscreen, setFullscreen] = useState(false)
  useEffect(() => {
    const onChange = () =>
      setFullscreen(document.fullscreenElement === frame.current)
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void frame.current?.requestFullscreen?.()
  }

  const [picked, setPicked] = useState<number | null>(null)
  const [alertOpen, setAlertOpen] = useState(false)
  const [savingLayout, setSavingLayout] = useState(false)

  const source = candles.data?.source
  const asset = main.asset
  const intraday = interval === "15m" || interval === "1h" || interval === "4h"
  const coarse = source?.kind === "coingecko"

  return (
    <Page className="max-w-none">
      <h1 className="sr-only">Chart Studio{asset ? `: ${asset.name}` : ""}</h1>
      <div
        ref={frame}
        className="flex flex-col rounded-md border border-rule bg-surface data-[full=true]:h-svh data-[full=true]:rounded-none"
        data-full={fullscreen}
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-rule px-2 py-1.5">
          <AssetSwitcher
            label="Asset"
            asset={
              asset
                ? {
                    id: asset.id,
                    name: asset.name,
                    symbol: asset.symbol,
                    image: asset.image,
                  }
                : null
            }
            onPick={(a) =>
              set({
                asset: a.id,
                cmp: compareIds.filter((x) => x !== a.id).join(",") || null,
              })
            }
          />
          {asset && (
            <span className="flex items-baseline gap-2 px-1">
              <span className="num text-base font-semibold text-ink">
                {formatPrice(asset.price)}
              </span>
              <Change value={asset.change24h} className="text-xs" />
            </span>
          )}
          <Segmented
            label="Candle interval"
            size="sm"
            value={interval}
            onChange={(v) => set({ i: v })}
            options={INTERVALS}
          />
          <Segmented
            label="Chart type"
            size="sm"
            value={type}
            onChange={(v) => {
              set({ t: v })
              updateSettings({
                chartDefaults: { ...settings.chartDefaults, type: v },
              })
            }}
            options={[
              { value: "candles", label: "Candles" },
              { value: "line", label: "Line" },
              { value: "area", label: "Area" },
            ]}
          />
          <IndicatorsMenu
            value={indicators}
            disabled={compareIds.length > 0}
            onChange={(v) =>
              updateSettings({
                chartDefaults: { ...settings.chartDefaults, indicators: v },
              })
            }
          />
          <label className="flex items-center gap-1.5 text-xs text-ink-2">
            <input
              type="checkbox"
              checked={log}
              onChange={(e) => set({ log: e.target.checked ? "1" : null })}
              disabled={compareIds.length > 0}
              className="accent-[var(--accent)]"
            />
            Log scale
          </label>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {asset && (
              <WatchButton id={asset.id} name={asset.name} variant="labeled" />
            )}
            <Button
              size="sm"
              disabled={!asset}
              onClick={() => setAlertOpen(true)}
            >
              <BellPlus aria-hidden="true" />{" "}
              {picked ? `Alert at ${formatPrice(picked)}` : "Alert"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm">
                  <LayoutTemplate aria-hidden="true" /> Layouts
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onSelect={() => setSavingLayout(true)}
                  disabled={!asset}
                >
                  <Save aria-hidden="true" /> Save current layout…
                </DropdownMenuItem>
                {layouts.length > 0 && <DropdownMenuSeparator />}
                {layouts.length > 0 && (
                  <DropdownMenuLabel>Saved layouts</DropdownMenuLabel>
                )}
                {layouts.map((l) => (
                  <DropdownMenuItem
                    key={l.id}
                    onSelect={() => {
                      updateSettings({
                        chartDefaults: {
                          interval: l.interval,
                          type: l.type,
                          indicators: l.indicators,
                        },
                      })
                      setParams(
                        new URLSearchParams({
                          asset: l.assetId,
                          i: l.interval,
                          t: l.type,
                          ...(l.log ? { log: "1" } : {}),
                          ...(l.compare.length
                            ? { cmp: l.compare.join(",") }
                            : {}),
                        }),
                        { replace: true }
                      )
                    }}
                  >
                    {l.name}
                  </DropdownMenuItem>
                ))}
                {layouts.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    {layouts.map((l) => (
                      <DropdownMenuItem
                        key={`del-${l.id}`}
                        tone="danger"
                        onSelect={() =>
                          layoutsStore.set((p) =>
                            p.filter((x) => x.id !== l.id)
                          )
                        }
                      >
                        <Trash2 aria-hidden="true" /> Delete “{l.name}”
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={fullscreen ? "Exit full screen" : "Full screen"}
              onClick={toggleFullscreen}
            >
              {fullscreen ? (
                <Minimize2 aria-hidden="true" />
              ) : (
                <Maximize2 aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-rule px-2 py-1.5 text-xs">
          <span className="text-ink-3">Compare:</span>
          {compareIds.map((id, i) => {
            const a = [c1, c2, c3][i].asset
            return (
              <span
                key={id}
                className="inline-flex h-6 items-center gap-1 rounded-full border border-rule-strong pr-1 pl-2 text-ink-2"
              >
                <span
                  className="h-0.5 w-3 rounded"
                  style={{ background: `var(--series-${((i + 1) % 6) + 1})` }}
                  aria-hidden="true"
                />
                {a?.symbol ?? id}
                <button
                  type="button"
                  aria-label={`Remove ${a?.name ?? id} from comparison`}
                  onClick={() =>
                    set({
                      cmp: compareIds.filter((x) => x !== id).join(",") || null,
                    })
                  }
                  className="inline-flex size-4 items-center justify-center rounded-full hover:bg-surface-2"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </span>
            )
          })}
          {compareIds.length < 3 && (
            <AssetSwitcher
              label="Add comparison"
              asset={null}
              onPick={(a) =>
                a.id !== assetId &&
                set({ cmp: [...compareIds, a.id].join(",") })
              }
            />
          )}
          <span className="ml-auto text-ink-3">
            {source?.kind === "binance"
              ? `Binance ${source.pair.replace("USDT", "/USDT")} · ${INTERVALS.find((i) => i.value === interval)?.title.toLowerCase()} · USDT as USD proxy`
              : source?.kind === "coingecko"
                ? `CoinGecko OHLC · ${source.granularity} candles · no volume (no Binance pair)`
                : ""}
          </span>
          {asset && (
            <Link
              to={`/markets/${asset.id}`}
              className="font-medium text-accent hover:underline"
            >
              Research {asset.symbol}
            </Link>
          )}
        </div>

        {coarse && (
          <p className="border-b border-rule bg-warn-soft px-3 py-1.5 text-xs text-warn">
            This asset has no Binance USDT pair, so candles come from CoinGecko
            at a fixed, coarser granularity and the selected interval is
            approximate.
          </p>
        )}

        <div className="min-h-0 flex-1 p-2">
          {main.notFound ? (
            <p className="p-6 text-center text-ink-2">
              That asset couldn’t be found.
            </p>
          ) : candles.data && candles.data.candles.length > 1 ? (
            <StudioChart
              candles={candles.data.candles}
              type={type}
              log={log}
              indicators={indicators}
              compare={compare}
              intraday={intraday}
              onPick={setPicked}
              className={
                fullscreen
                  ? "flex h-[calc(100svh-7rem)] flex-col"
                  : "flex h-[min(78svh,760px)] min-h-[420px] flex-col"
              }
            />
          ) : isFailing(candles) ? (
            <ErrorNotice
              error={candles.failureReason}
              onRetry={() => candles.refetch()}
              title="Couldn’t load candles"
            />
          ) : candles.data ? (
            <p className="p-6 text-center text-ink-2">
              No candle data for this asset and interval.
            </p>
          ) : (
            <Skeleton className="h-[min(78svh,760px)] min-h-[420px] w-full" />
          )}
        </div>
        <p className="border-t border-rule px-3 py-1.5 text-[0.6875rem] text-ink-3">
          Click the chart to pick a price for an alert. Scroll or pinch to zoom,
          drag to pan.
        </p>
      </div>

      <AlertDialog
        open={alertOpen}
        onOpenChange={setAlertOpen}
        draft={{
          asset: asset
            ? {
                id: asset.id,
                name: asset.name,
                symbol: asset.symbol,
                image: asset.image,
              }
            : null,
          kind:
            picked && asset?.price
              ? picked >= asset.price
                ? "price_above"
                : "price_below"
              : "price_above",
          threshold: picked ?? asset?.price ?? undefined,
        }}
      />
      <NameDialog
        open={savingLayout}
        onOpenChange={setSavingLayout}
        title="Save chart layout"
        description="Saves the asset, interval, chart type, indicators and comparisons."
        confirm="Save"
        initial={asset ? `${asset.symbol} ${interval}` : ""}
        onSubmit={(name) => {
          layoutsStore.set((prev) => [
            {
              id: newId(),
              name,
              assetId,
              interval,
              type,
              log,
              indicators,
              compare: compareIds,
              createdAt: Date.now(),
            },
            ...prev,
          ])
          toast(`Layout “${name}” saved`)
        }}
      />
    </Page>
  )
}
