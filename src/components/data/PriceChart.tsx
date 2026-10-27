import { useEffect, useId, useMemo, useRef, useState } from "react"

import {
  downsample,
  linePath,
  nearestIndex,
  niceTicks,
  timeTicks,
} from "@/lib/chart"
import { formatPercent, formatPrice } from "@/lib/format"
import { cn, toneClass } from "@/lib/utils"
import type { HistoryRange, PricePoint } from "@/services/coingecko"

const M = { top: 12, right: 64, bottom: 26, left: 0 }

const tooltipDate: Record<HistoryRange, Intl.DateTimeFormat> = {
  "1D": new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }),
  "7D": new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
  }),
  "30D": new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
  }),
  "90D": new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
  }),
  "1Y": new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }),
}

function axisPrice(value: number) {
  if (value >= 1000)
    return "$" + value.toLocaleString("en-US", { maximumFractionDigits: 0 })
  return formatPrice(value)
}

/**
 * Price over time, drawn against the period's opening price: the area above
 * the open is tinted "up", below it "down", so the reader sees at a glance
 * where the asset traded relative to where the period began.
 */
export function PriceChart({
  points,
  range,
  label,
  dimmed = false,
  className,
}: {
  points: PricePoint[]
  range: HistoryRange
  label: string
  dimmed?: boolean
  className?: string
}) {
  const uid = useId().replace(/:/g, "")
  const boxRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [active, setActive] = useState<number | null>(null)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        w: Math.floor(entry.contentRect.width),
        h: Math.floor(entry.contentRect.height),
      })
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const data = useMemo(
    () => downsample(points, Math.max(120, Math.min(720, size.w || 600))),
    [points, size.w]
  )

  const geo = useMemo(() => {
    const { w, h } = size
    if (data.length < 2 || w < 80 || h < 80) return null
    const plotW = w - M.left - M.right
    const plotH = h - M.top - M.bottom
    let min = Infinity
    let max = -Infinity
    for (const d of data) {
      if (d.p < min) min = d.p
      if (d.p > max) max = d.p
    }
    const pad = (max - min) * 0.08 || Math.abs(max) * 0.01 || 1
    const lo = Math.max(0, min - pad)
    const hi = max + pad
    const t0 = data[0].t
    const t1 = data[data.length - 1].t
    const x = (t: number) => M.left + ((t - t0) / (t1 - t0 || 1)) * plotW
    const y = (p: number) => M.top + (1 - (p - lo) / (hi - lo)) * plotH
    const xs = data.map((d) => x(d.t))
    const ys = data.map((d) => y(d.p))
    const open = data[0].p
    const baseY = y(open)
    const line = linePath(xs, ys)
    const area = `${line}L${xs[xs.length - 1].toFixed(1)} ${baseY.toFixed(1)}L${xs[0].toFixed(1)} ${baseY.toFixed(1)}Z`
    const yTicks = niceTicks(lo, hi, plotH < 200 ? 3 : 4)
      .filter((v) => v >= lo && v <= hi)
      .map((v) => ({ v, y: y(v) }))
    const xTicks = timeTicks(t0, t1, Math.max(2, Math.floor(plotW / 88))).map(
      (tick) => ({
        ...tick,
        x: x(tick.t),
      })
    )
    return {
      w,
      h,
      plotW,
      plotH,
      xs,
      ys,
      line,
      area,
      baseY,
      open,
      yTicks,
      xTicks,
      x,
    }
  }, [data, size])

  const summary = useMemo(() => {
    if (points.length < 2) return null
    const open = points[0].p
    const last = points[points.length - 1].p
    let high = -Infinity
    let low = Infinity
    for (const p of points) {
      if (p.p > high) high = p.p
      if (p.p < low) low = p.p
    }
    return {
      open,
      last,
      high,
      low,
      change: open > 0 ? ((last - open) / open) * 100 : null,
    }
  }, [points])

  const summaryText = summary
    ? `${label}. Opened at ${formatPrice(summary.open)}, latest ${formatPrice(summary.last)}, ` +
      `change ${formatPercent(summary.change)}. High ${formatPrice(summary.high)}, low ${formatPrice(summary.low)}. ` +
      `Use the arrow keys to read individual prices.`
    : label

  const describe = (i: number) => {
    const d = data[i]
    const vsOpen =
      geo && geo.open > 0 ? ((d.p - geo.open) / geo.open) * 100 : null
    return `${tooltipDate[range].format(d.t)}: ${formatPrice(d.p)}, ${formatPercent(vsOpen)} versus open`
  }

  const moveTo = (i: number) =>
    setActive(Math.max(0, Math.min(data.length - 1, i)))

  const onPointer = (event: React.PointerEvent) => {
    if (!geo) return
    const rect = event.currentTarget.getBoundingClientRect()
    const px = event.clientX - rect.left
    const t0 = data[0].t
    const t1 = data[data.length - 1].t
    const t = t0 + ((px - M.left) / geo.plotW) * (t1 - t0)
    setActive(nearestIndex(data, t))
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!geo) return
    const current = active ?? data.length - 1
    const step = event.shiftKey ? 10 : 1
    const keys: Record<string, number> = {
      ArrowLeft: current - step,
      ArrowRight: current + step,
      Home: 0,
      End: data.length - 1,
    }
    if (event.key in keys) {
      event.preventDefault()
      moveTo(keys[event.key])
    } else if (event.key === "Escape") {
      setActive(null)
    }
  }

  const point =
    active !== null && geo
      ? { x: geo.xs[active], y: geo.ys[active], d: data[active] }
      : null
  const vsOpen =
    point && geo && geo.open > 0
      ? ((point.d.p - geo.open) / geo.open) * 100
      : null
  const lastX = geo?.xs[geo.xs.length - 1]
  const lastY = geo?.ys[geo.ys.length - 1]

  const current = active ?? data.length - 1
  return (
    <div className={className}>
      <div
        ref={boxRef}
        // The keyboard cursor moves through time like a slider; screen readers
        // announce aria-valuetext as it moves.
        role={geo ? "slider" : undefined}
        aria-label={label}
        aria-describedby={`summary-${uid}`}
        aria-valuemin={geo ? 0 : undefined}
        aria-valuemax={geo ? data.length - 1 : undefined}
        aria-valuenow={geo ? current : undefined}
        aria-valuetext={geo && data[current] ? describe(current) : undefined}
        aria-orientation="horizontal"
        tabIndex={geo ? 0 : -1}
        onKeyDown={onKeyDown}
        onFocus={() => setActive((a) => a ?? data.length - 1)}
        onBlur={() => setActive(null)}
        className={cn(
          "relative h-[240px] w-full touch-pan-y select-none sm:h-[320px] lg:h-[360px]",
          "rounded-sm transition-opacity duration-200 focus-visible:outline-offset-4",
          dimmed && "opacity-45"
        )}
      >
        {geo && (
          <svg
            width={geo.w}
            height={geo.h}
            className="block overflow-visible"
            aria-hidden="true"
          >
            <defs>
              <clipPath id={`above-${uid}`}>
                <rect
                  x={0}
                  y={0}
                  width={geo.w}
                  height={Math.max(0, geo.baseY)}
                />
              </clipPath>
              <clipPath id={`below-${uid}`}>
                <rect
                  x={0}
                  y={geo.baseY}
                  width={geo.w}
                  height={Math.max(0, geo.h - geo.baseY)}
                />
              </clipPath>
            </defs>

            {geo.yTicks.map((tick) => (
              <g key={tick.v}>
                <line
                  x1={M.left}
                  x2={M.left + geo.plotW}
                  y1={tick.y}
                  y2={tick.y}
                  stroke="var(--rule)"
                  strokeWidth={1}
                />
                {Math.abs(tick.y - geo.baseY) > 14 && (
                  <text
                    x={geo.w - 4}
                    y={tick.y}
                    dy="0.32em"
                    textAnchor="end"
                    className="num fill-ink-3 text-[11px]"
                  >
                    {axisPrice(tick.v)}
                  </text>
                )}
              </g>
            ))}

            <path
              d={geo.area}
              fill="var(--up)"
              fillOpacity={0.12}
              clipPath={`url(#above-${uid})`}
            />
            <path
              d={geo.area}
              fill="var(--down)"
              fillOpacity={0.12}
              clipPath={`url(#below-${uid})`}
            />
            <line
              x1={M.left}
              x2={M.left + geo.plotW}
              y1={geo.baseY}
              y2={geo.baseY}
              stroke="var(--ink-3)"
              strokeOpacity={0.7}
              strokeWidth={1}
            />
            <g transform={`translate(${M.left + geo.plotW + 6} ${geo.baseY})`}>
              <rect
                x={0}
                y={-9}
                width={M.right - 8}
                height={18}
                rx={3}
                fill="var(--surface-2)"
              />
              <text
                x={(M.right - 8) / 2}
                dy="0.32em"
                textAnchor="middle"
                className="fill-ink-2 text-[10px] font-medium"
              >
                Open
              </text>
            </g>

            <path
              d={geo.line}
              fill="none"
              stroke="var(--ink)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {geo.xTicks.map((tick) => {
              const anchor =
                tick.x < 24
                  ? "start"
                  : tick.x > geo.plotW - 24
                    ? "end"
                    : "middle"
              return (
                <text
                  key={tick.t}
                  x={tick.x}
                  y={geo.h - 6}
                  textAnchor={anchor}
                  className="fill-ink-3 text-[11px]"
                >
                  {tick.label}
                </text>
              )
            })}

            {point ? (
              <g>
                <line
                  x1={point.x}
                  x2={point.x}
                  y1={M.top}
                  y2={M.top + geo.plotH}
                  stroke="var(--ink-2)"
                  strokeWidth={1}
                />
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={4.5}
                  fill="var(--ink)"
                  stroke="var(--bg)"
                  strokeWidth={2}
                />
              </g>
            ) : (
              lastX !== undefined &&
              lastY !== undefined && (
                <circle
                  cx={lastX}
                  cy={lastY}
                  r={4}
                  fill="var(--ink)"
                  stroke="var(--bg)"
                  strokeWidth={2}
                />
              )
            )}

            {/* Hit area: the whole plot, so the reader aims at a date, not a line. */}
            <rect
              x={M.left}
              y={0}
              width={geo.plotW}
              height={geo.h}
              fill="transparent"
              onPointerMove={onPointer}
              onPointerDown={onPointer}
              onPointerLeave={() => setActive(null)}
            />
          </svg>
        )}

        {point && geo && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-1 z-10 rounded-md border border-rule bg-surface px-2.5 py-1.5 shadow-pop"
            style={
              point.x > geo.plotW / 2
                ? { right: geo.w - point.x + 10 }
                : { left: point.x + 10 }
            }
          >
            <p className="num text-sm font-semibold whitespace-nowrap text-ink">
              {formatPrice(point.d.p)}
            </p>
            <p className="text-[11px] whitespace-nowrap text-ink-3">
              {tooltipDate[range].format(point.d.t)}
            </p>
            <p
              className={cn(
                "num text-[11px] whitespace-nowrap",
                toneClass(vsOpen)
              )}
            >
              {formatPercent(vsOpen)}{" "}
              <span className="font-sans text-ink-3">vs open</span>
            </p>
          </div>
        )}
      </div>
      <p id={`summary-${uid}`} className="sr-only">
        {summaryText}
      </p>
    </div>
  )
}
