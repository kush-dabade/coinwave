import { useEffect, useMemo, useRef, useState } from "react"
import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  LineSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type UTCTimestamp,
} from "lightweight-charts"

import { alpha, useChartTheme } from "@/components/charts/useChartTheme"
import {
  formatCompactMoney,
  formatMoney,
  formatPercent,
  formatPrice,
} from "@/lib/format"
import { cn } from "@/lib/utils"

export type LinePoint = { t: number; v: number }
export type LineSeriesDef = {
  id: string
  label: string
  color?: string
  points: LinePoint[]
  dashed?: boolean
}
export type ValueFormat =
  | "percent"
  | "price"
  | "money"
  | "compact"
  | "index"
  | "number"

function formatValue(v: number | null | undefined, format: ValueFormat) {
  switch (format) {
    case "percent":
      return formatPercent(v)
    case "price":
      return formatPrice(v)
    case "money":
      return formatMoney(v)
    case "compact":
      return formatCompactMoney(v)
    case "index":
      return v === null || v === undefined || !Number.isFinite(v)
        ? "—"
        : v.toFixed(1)
    case "number":
      return v === null || v === undefined || !Number.isFinite(v)
        ? "—"
        : v.toLocaleString("en-US", { maximumFractionDigits: 2 })
  }
}

const toTime = (t: number) => Math.floor(t / 1000) as UTCTimestamp

function clean(points: LinePoint[]) {
  const map = new Map<number, number>()
  for (const p of points) if (Number.isFinite(p.v)) map.set(toTime(p.t), p.v)
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([time, value]) => ({ time: time as UTCTimestamp, value }))
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
})

/**
 * Multi-series line chart. The first series may render as an area. A
 * baseline (e.g. 0% for performance) can be drawn. Hovering or focusing
 * shows every series' value at that date.
 */
export function LineChart({
  series,
  format,
  area = false,
  baseline,
  summary,
  className,
  height = "h-[300px]",
}: {
  series: LineSeriesDef[]
  format: ValueFormat
  area?: boolean
  baseline?: number
  /** Screen-reader description of what the chart shows. */
  summary: string
  className?: string
  height?: string
}) {
  const theme = useChartTheme()
  const ref = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRefs = useRef<ISeriesApi<"Line" | "Area">[]>([])
  const [hover, setHover] = useState<{
    time: number
    values: (number | null)[]
  } | null>(null)

  const colored = useMemo(
    () =>
      series.map((s, i) => ({
        ...s,
        color: s.color ?? theme.series[i % theme.series.length],
      })),
    [series, theme]
  )

  useEffect(() => {
    if (!ref.current) return
    const chart = createChart(ref.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: theme.muted,
        fontFamily: "Geist Variable, ui-sans-serif, system-ui",
        fontSize: 11,
        // Small panes: the logo would cover data. The licence's attribution
        // and tradingview.com link are in the app footer on every page
        // (Chart Studio keeps the on-chart logo).
        attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: theme.grid } },
      rightPriceScale: { borderVisible: false },
      timeScale: {
        borderVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { color: theme.rule, labelBackgroundColor: theme.ink },
        horzLine: { color: theme.rule, labelBackgroundColor: theme.ink },
      },
      localization: { priceFormatter: (v: number) => formatValue(v, format) },
      handleScroll: { vertTouchDrag: false },
    })
    chartRef.current = chart
    return () => {
      chart.remove()
      chartRef.current = null
      seriesRefs.current = []
    }
    // Recreate only when the theme changes; data updates are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    for (const s of seriesRefs.current) chart.removeSeries(s)
    seriesRefs.current = colored.map((s, i) => {
      const common = {
        priceLineVisible: false,
        lastValueVisible: true,
        priceFormat: {
          type: "custom" as const,
          formatter: (v: number) => formatValue(v, format),
          minMove: 0.0001,
        },
      }
      const api =
        area && i === 0
          ? chart.addSeries(AreaSeries, {
              ...common,
              lineColor: s.color,
              topColor: alpha(s.color, 0.22),
              bottomColor: alpha(s.color, 0.02),
              lineWidth: 2,
            })
          : chart.addSeries(LineSeries, {
              ...common,
              color: s.color,
              lineWidth: 2,
              lineStyle: s.dashed ? LineStyle.Dashed : LineStyle.Solid,
            })
      api.setData(clean(s.points))
      if (i === 0 && baseline !== undefined) {
        api.createPriceLine({
          price: baseline,
          color: theme.rule,
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: false,
          title: "",
        })
      }
      return api
    })
    chart.timeScale().fitContent()

    const onMove = (param: MouseEventParams) => {
      if (!param.time) return setHover(null)
      setHover({
        time: Number(param.time) * 1000,
        values: seriesRefs.current.map((api) => {
          const d = param.seriesData.get(api) as { value?: number } | undefined
          return d?.value ?? null
        }),
      })
    }
    chart.subscribeCrosshairMove(onMove)
    return () => chart.unsubscribeCrosshairMove(onMove)
  }, [colored, format, area, baseline, theme])

  const latest = colored.map((s) => s.points[s.points.length - 1]?.v ?? null)
  const values = hover?.values ?? latest
  const when = hover ? dateFmt.format(hover.time) : "Latest"

  return (
    <figure className={cn("relative", className)}>
      <div
        className="pointer-events-none absolute top-1 left-1 z-[2] flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded bg-surface/85 px-1.5 py-0.5 text-[0.6875rem]"
        aria-hidden="true"
      >
        <span className="text-ink-3">{when}</span>
        {colored.map((s, i) => (
          <span key={s.id} className="inline-flex items-center gap-1">
            <span
              className="h-0.5 w-3 rounded"
              style={{ background: s.color }}
            />
            <span className="num font-semibold text-ink">
              {formatValue(values[i], format)}
            </span>
            <span className="text-ink-3">{s.label}</span>
          </span>
        ))}
      </div>
      <div ref={ref} className={cn("w-full", height)} />
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  )
}
