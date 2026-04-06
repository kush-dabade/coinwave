import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

type FlashDirection = "up" | "down" | null

type AnimatedNumberProps = {
  value: number
  className?: string
  duration?: number
  flash?: boolean
  format?: (value: number) => string
  upClassName?: string
  downClassName?: string
}

export function AnimatedNumber({
  value,
  className,
  duration = 500,
  flash = true,
  format = (v) => v.toLocaleString(undefined, { maximumFractionDigits: 2 }),
  upClassName = "text-emerald-400",
  downClassName = "text-red-400",
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value)
  const [flashDirection, setFlashDirection] = useState<FlashDirection>(null)

  const rafRef = useRef<number | null>(null)
  const flashTimeoutRef = useRef<number | null>(null)
  const previousValueRef = useRef(value)
  const currentDisplayRef = useRef(value)
  const hasMountedRef = useRef(false)

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (flashTimeoutRef.current) window.clearTimeout(flashTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    const previousValue = previousValueRef.current

    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      previousValueRef.current = value
      currentDisplayRef.current = value
      setDisplayValue(value)
      return
    }

    if (value === previousValue) return

    if (flash) {
      setFlashDirection(value > previousValue ? "up" : "down")

      if (flashTimeoutRef.current) {
        window.clearTimeout(flashTimeoutRef.current)
      }

      flashTimeoutRef.current = window.setTimeout(() => {
        setFlashDirection(null)
      }, 420)
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    const from = currentDisplayRef.current
    const to = value
    const start = performance.now()

    const step = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - (1 - progress) ** 3
      const next = from + (to - from) * eased

      currentDisplayRef.current = next
      setDisplayValue(next)

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        currentDisplayRef.current = to
        setDisplayValue(to)
        rafRef.current = null
      }
    }

    rafRef.current = requestAnimationFrame(step)
    previousValueRef.current = value
  }, [duration, flash, value])

  return (
    <span
      className={cn(
        "tabular-nums transition-colors duration-500",
        flashDirection === "up" && upClassName,
        flashDirection === "down" && downClassName,
        className
      )}
    >
      {format(displayValue)}
    </span>
  )
}
