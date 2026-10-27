import { useEffect, useMemo, useRef, useState } from "react"
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  PriceScaleMode,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type SeriesType,
  type UTCTimestamp,
} from "lightweight-charts"

import { alpha, useChartTheme } from "@/components/charts/useChartTheme"
import { bollinger, ema, macd, rsi, sma, type Series } from "@/lib/indicators"
import { formatCompactMoney, formatPercent, formatPrice } from "@/lib/format"
import type { IndicatorConfig, ChartType } from "@/lib/workspace"
import type { Candle } from "@/services/coingecko"

const toTime = (t: number) => Math.floor(t / 1000) as UTCTimestamp

/** Bars in view when a chart first opens. */
const DEFAULT_BARS = 180

export type CompareSeries = { id: string; label: string; candles: Candle[] }

type Legend = {
  candle: Candle | null
  prevClose: number | null
  values: { label: string; value: string; color: string }[]
}

function line(times: UTCTimestamp[], values: Series) {
  const out: { time: UTCTimestamp; value: number }[] = []
  values.forEach(
    (v, i) =>
      v !== null && Number.isFinite(v) && out.push({ time: times[i], value: v })
  )
  return out
}

/**
 * The Chart Studio canvas: price (candles/line/area) with overlays, plus
 * optional volume, RSI and MACD panes. Comparison series switch the price
 * scale to percentage mode so assets of any price compare fairly.
 */
export function StudioChart({
  candles,
  type,
  log,
  indicators,
  compare,
  intraday,
  onPick,
  className,
}: {
  candles: Candle[]
  type: ChartType
  log: boolean
  indicators: IndicatorConfig
  compare: CompareSeries[]
  intraday: boolean
  /** Called with the price under the pointer when the chart is clicked. */
  onPick?: (price: number) => void
  className?: string
}) {
  const theme = useChartTheme()
  const ref = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const shownData = useRef<unknown>(null)
  // Time of the bar under the crosshair; null shows the latest bar.
  const [hoverTime, setHoverTime] = useState<number | null>(null)
  const onPickRef = useRef(onPick)
  useEffect(() => {
    onPickRef.current = onPick
  }, [onPick])

  const data = useMemo(() => {
    const sorted = [
      ...new Map(candles.map((c) => [toTime(c.t), c])).entries(),
    ].sort((a, b) => a[0] - b[0])
    const times = sorted.map(([t]) => t)
    const list = sorted.map(([, c]) => c)
    const closes = list.map((c) => c.c)
    return { times, list, closes }
  }, [candles])

  const hasVolume = data.list.some((c) => c.v !== null)
  const comparing = compare.length > 0

  // Indicator values are computed once per input change and shared by the
  // chart series and the legend.
  const studies = useMemo(() => {
    const { closes } = data
    const overlays: {
      label: string
      color: string
      values: Series
      dashed: boolean
    }[] = []
    let rsiValues: Series = []
    let m: ReturnType<typeof macd> | null = null
    if (!comparing) {
      if (indicators.sma.enabled)
        indicators.sma.periods.forEach((p, i) =>
          overlays.push({
            label: `SMA ${p}`,
            values: sma(closes, p),
            color: theme.series[i % 6],
            dashed: false,
          })
        )
      if (indicators.ema.enabled)
        indicators.ema.periods.forEach((p, i) =>
          overlays.push({
            label: `EMA ${p}`,
            values: ema(closes, p),
            color: theme.series[(i + 3) % 6],
            dashed: false,
          })
        )
      if (indicators.bollinger.enabled) {
        const b = bollinger(
          closes,
          indicators.bollinger.period,
          indicators.bollinger.k
        )
        const n = indicators.bollinger.period
        overlays.push({
          label: `BB ${n} upper`,
          values: b.upper,
          color: theme.muted,
          dashed: true,
        })
        overlays.push({
          label: `BB ${n} mid`,
          values: b.middle,
          color: theme.muted,
          dashed: false,
        })
        overlays.push({
          label: `BB ${n} lower`,
          values: b.lower,
          color: theme.muted,
          dashed: true,
        })
      }
      if (indicators.rsi.enabled) rsiValues = rsi(closes, indicators.rsi.period)
      if (indicators.macd.enabled)
        m = macd(
          closes,
          indicators.macd.fast,
          indicators.macd.slow,
          indicators.macd.signal
        )
    }
    return { overlays, rsiValues, m }
  }, [data, indicators, comparing, theme])

  useEffect(() => {
    if (!ref.current) return
    const chart = createChart(ref.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: theme.muted,
        fontFamily: "Geist Variable, ui-sans-serif, system-ui",
        fontSize: 11,
        attributionLogo: true,
        panes: {
          separatorColor: theme.rule,
          separatorHoverColor: theme.rule,
          enableResize: true,
        },
      },
      grid: {
        vertLines: { color: theme.grid },
        horzLines: { color: theme.grid },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, rightOffset: 4 },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: theme.rule, labelBackgroundColor: theme.ink },
        horzLine: { color: theme.rule, labelBackgroundColor: theme.ink },
      },
    })
    chartRef.current = chart
    const onClick = (param: MouseEventParams) => {
      if (!param.point || !onPickRef.current) return
      const main = chart.panes()[0]?.getSeries()[0]
      const price = main?.coordinateToPrice(param.point.y)
      if (typeof price === "number" && Number.isFinite(price) && price > 0)
        onPickRef.current(price)
    }
    chart.subscribeClick(onClick)
    return () => {
      chart.unsubscribeClick(onClick)
      chart.remove()
      chartRef.current = null
      shownData.current = null
    }
  }, [theme])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    // Toggling an indicator keeps the user's zoom; new data starts fresh.
    const keepRange =
      shownData.current === data
        ? chart.timeScale().getVisibleLogicalRange()
        : null
    shownData.current = data
    // Rebuild every series and pane from scratch on any input change.
    for (const pane of [...chart.panes()].reverse())
      for (const s of pane.getSeries()) chart.removeSeries(s)
    while (chart.panes().length > 1) chart.removePane(chart.panes().length - 1)

    const { times, list } = data
    const { overlays, rsiValues, m } = studies
    const priceFmt = {
      type: "custom" as const,
      formatter: (v: number) => formatPrice(v),
      minMove: 1e-8,
    }
    let main: ISeriesApi<SeriesType>
    if (type === "candles") {
      main = chart.addSeries(CandlestickSeries, {
        upColor: theme.up,
        downColor: theme.down,
        borderVisible: false,
        wickUpColor: theme.up,
        wickDownColor: theme.down,
        priceFormat: priceFmt,
        priceLineVisible: false,
      })
      main.setData(
        list.map((c, i) => ({
          time: times[i],
          open: c.o,
          high: c.h,
          low: c.l,
          close: c.c,
        }))
      )
    } else if (type === "area") {
      main = chart.addSeries(AreaSeries, {
        lineColor: theme.ink,
        topColor: alpha(theme.accent, 0.18),
        bottomColor: alpha(theme.accent, 0.01),
        lineWidth: 2,
        priceFormat: priceFmt,
        priceLineVisible: false,
      })
      main.setData(list.map((c, i) => ({ time: times[i], value: c.c })))
    } else {
      main = chart.addSeries(LineSeries, {
        color: theme.ink,
        lineWidth: 2,
        priceFormat: priceFmt,
        priceLineVisible: false,
      })
      main.setData(list.map((c, i) => ({ time: times[i], value: c.c })))
    }
    main.priceScale().applyOptions({
      mode: comparing
        ? PriceScaleMode.Percentage
        : log
          ? PriceScaleMode.Logarithmic
          : PriceScaleMode.Normal,
      scaleMargins: { top: 0.08, bottom: 0.08 },
    })

    for (const o of overlays) {
      const s = chart.addSeries(LineSeries, {
        color: o.color,
        lineWidth: 1,
        lineStyle: o.dashed ? LineStyle.Dashed : LineStyle.Solid,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        priceFormat: priceFmt,
      })
      s.setData(line(times, o.values))
    }

    compare.forEach((c, i) => {
      const s = chart.addSeries(LineSeries, {
        color: theme.series[(i + 1) % 6],
        lineWidth: 2,
        priceLineVisible: false,
        priceFormat: priceFmt,
      })
      const map = new Map(c.candles.map((k) => [toTime(k.t), k.c]))
      s.setData(
        [...map.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([time, value]) => ({ time, value }))
      )
    })

    let pane = 1
    // Relative to the price pane (stretch factor 1).
    const paneHeights: number[] = []
    if (indicators.volume && hasVolume && !comparing) {
      const vol = chart.addSeries(
        HistogramSeries,
        {
          priceFormat: {
            type: "custom",
            formatter: (v: number) => formatCompactMoney(v),
            minMove: 1,
          },
          priceLineVisible: false,
          lastValueVisible: false,
        },
        pane
      )
      vol.setData(
        list.map((c, i) => ({
          time: times[i],
          value: c.v ?? 0,
          color: alpha(c.c >= c.o ? theme.up : theme.down, 0.5),
        }))
      )
      paneHeights[pane] = 0.14
      pane++
    }
    if (rsiValues.length) {
      const r = chart.addSeries(
        LineSeries,
        {
          color: theme.accent,
          lineWidth: 1,
          priceLineVisible: false,
          priceFormat: {
            type: "custom",
            formatter: (v: number) => v.toFixed(0),
            minMove: 0.1,
          },
        },
        pane
      )
      r.setData(line(times, rsiValues))
      for (const level of [70, 30])
        r.createPriceLine({
          price: level,
          color: theme.rule,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: false,
          title: "",
        })
      paneHeights[pane] = 0.18
      pane++
    }
    if (m) {
      const fmt = {
        type: "custom" as const,
        formatter: (v: number) => formatPrice(v),
        minMove: 1e-8,
      }
      const h = chart.addSeries(
        HistogramSeries,
        { priceFormat: fmt, priceLineVisible: false, lastValueVisible: false },
        pane
      )
      h.setData(
        m.histogram
          .map((v, i) =>
            v === null
              ? null
              : {
                  time: times[i],
                  value: v,
                  color: alpha(v >= 0 ? theme.up : theme.down, 0.55),
                }
          )
          .filter(
            (x): x is { time: UTCTimestamp; value: number; color: string } =>
              x !== null
          )
      )
      const l = chart.addSeries(
        LineSeries,
        {
          color: theme.accent,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          priceFormat: fmt,
        },
        pane
      )
      l.setData(line(times, m.line))
      const sg = chart.addSeries(
        LineSeries,
        {
          color: theme.warn,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          priceFormat: fmt,
        },
        pane
      )
      sg.setData(line(times, m.signal))
      paneHeights[pane] = 0.2
      pane++
    }
    chart
      .panes()
      .forEach((p, i) =>
        p.setStretchFactor(i === 0 ? 1 : (paneHeights[i] ?? 0.2))
      )
    chart.applyOptions({
      timeScale: { timeVisible: intraday, secondsVisible: false },
    })
    if (keepRange) chart.timeScale().setVisibleLogicalRange(keepRange)
    else if (list.length > DEFAULT_BARS)
      // Open on recent history (about six months of daily candles); scroll
      // or zoom out for the rest.
      chart.timeScale().setVisibleLogicalRange({
        from: list.length - DEFAULT_BARS,
        to: list.length + 3,
      })
    else chart.timeScale().fitContent()

    const onMove = (param: MouseEventParams) =>
      setHoverTime(param.time ? Number(param.time) : null)
    chart.subscribeCrosshairMove(onMove)
    return () => chart.unsubscribeCrosshairMove(onMove)
  }, [
    data,
    studies,
    type,
    log,
    indicators,
    compare,
    comparing,
    hasVolume,
    intraday,
    theme,
  ])

  const indexOf = useMemo(
    () => new Map(data.times.map((t, i) => [t as number, i])),
    [data]
  )
  const legend = useMemo((): Legend | null => {
    const { list } = data
    const { overlays, rsiValues, m } = studies
    const i =
      (hoverTime !== null ? indexOf.get(hoverTime) : undefined) ??
      list.length - 1
    if (!list[i]) return null
    const values = overlays
      .filter((o) => o.values[i] !== null)
      .map((o) => ({
        label: o.label,
        value: formatPrice(o.values[i]),
        color: o.color,
      }))
    const r = rsiValues[i]
    if (r !== undefined && r !== null)
      values.push({
        label: `RSI ${indicators.rsi.period}`,
        value: r.toFixed(1),
        color: theme.accent,
      })
    if (m && m.line[i] !== null && m.signal[i] !== null)
      values.push({
        label: "MACD / signal",
        value: `${formatPrice(m.line[i])} / ${formatPrice(m.signal[i])}`,
        color: theme.warn,
      })
    return { candle: list[i], prevClose: i > 0 ? list[i - 1].c : null, values }
  }, [data, studies, hoverTime, indexOf, indicators.rsi.period, theme])

  const c = legend?.candle
  const change =
    c && legend?.prevClose ? (c.c / legend.prevClose - 1) * 100 : null
  return (
    <div className={className}>
      <div
        className="flex min-h-6 flex-wrap items-center gap-x-3 gap-y-0.5 px-1 text-[0.6875rem]"
        aria-live="off"
      >
        {c && !comparing && (
          <>
            <span className="num text-ink-3">
              O <span className="text-ink">{formatPrice(c.o)}</span> H{" "}
              <span className="text-ink">{formatPrice(c.h)}</span> L{" "}
              <span className="text-ink">{formatPrice(c.l)}</span> C{" "}
              <span className="text-ink">{formatPrice(c.c)}</span>
            </span>
            <span
              className={
                change === null
                  ? "text-ink-3"
                  : change >= 0
                    ? "num text-up"
                    : "num text-down"
              }
            >
              {formatPercent(change)}
            </span>
            {c.v !== null && (
              <span className="num text-ink-3">
                Vol {formatCompactMoney(c.v)}
              </span>
            )}
          </>
        )}
        {legend?.values.map((v) => (
          <span
            key={v.label}
            className="inline-flex items-center gap-1 text-ink-3"
          >
            <span
              className="h-0.5 w-3 rounded"
              style={{ background: v.color }}
            />
            {v.label} <span className="num text-ink">{v.value}</span>
          </span>
        ))}
        {comparing && (
          <span className="text-ink-3">
            Percentage change from the first visible bar
          </span>
        )}
      </div>
      <div ref={ref} className="h-full min-h-[320px] w-full" />
    </div>
  )
}
