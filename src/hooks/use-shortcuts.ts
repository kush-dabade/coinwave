import { useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"

import { ALL_NAV } from "@/components/layout/nav"

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return !!el?.closest(
    "input, textarea, select, [contenteditable='true'], [role='combobox']"
  )
}

/**
 * Global navigation shortcuts: "g" followed by a key opens a workspace,
 * "?" opens the shortcut list. Ignored while typing or with modifier keys,
 * so they never interfere with text entry or browser shortcuts.
 */
export function useShortcuts(onHelp: () => void) {
  const navigate = useNavigate()
  const pending = useRef<number | null>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.repeat ||
        isTyping(event.target)
      )
        return
      if (document.querySelector("[role='dialog'], [role='menu']")) return
      if (pending.current !== null) {
        window.clearTimeout(pending.current)
        pending.current = null
        const item = ALL_NAV.find((n) => n.key === event.key.toLowerCase())
        if (item) {
          event.preventDefault()
          navigate(item.to)
        }
        return
      }
      if (event.key === "g") {
        pending.current = window.setTimeout(
          () => (pending.current = null),
          1200
        )
      } else if (event.key === "?") {
        event.preventDefault()
        onHelp()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
      if (pending.current !== null) window.clearTimeout(pending.current)
    }
  }, [navigate, onHelp])
}
