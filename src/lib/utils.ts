import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

import { direction } from "./format"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const TONE = { up: "text-up", down: "text-down", flat: "text-ink-3" } as const

/** Text colour for a signed change: up, down, or neutral when ~0 or unknown. */
export function toneClass(value: number | null | undefined) {
  return TONE[direction(value)]
}
