/* eslint-disable react-refresh/only-export-components */
import * as React from "react"

export type Theme = "dark" | "light" | "system"
type ResolvedTheme = "dark" | "light"

type ThemeProviderState = {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

const STORAGE_KEY = "theme"
const QUERY = "(prefers-color-scheme: dark)"

const ThemeContext = React.createContext<ThemeProviderState | undefined>(
  undefined
)

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === "dark" || stored === "light" || stored === "system")
      return stored
  } catch {
    // Storage unavailable; fall through to the default.
  }
  // Dark is CoinWave's primary theme; users can switch in the theme menu.
  return "dark"
}

function systemTheme(): ResolvedTheme {
  return window.matchMedia(QUERY).matches ? "dark" : "light"
}

function apply(resolved: ResolvedTheme) {
  const root = document.documentElement
  // Suppress transitions for one frame so colours swap instantly.
  root.classList.add("theme-switching")
  root.classList.remove("light", "dark")
  root.classList.add(resolved)
  root.style.colorScheme = resolved
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", resolved === "dark" ? "#0a0c10" : "#f2f3f6")
  requestAnimationFrame(() => root.classList.remove("theme-switching"))
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>(readTheme)
  const [system, setSystem] = React.useState<ResolvedTheme>(systemTheme)
  const resolvedTheme = theme === "system" ? system : theme

  React.useEffect(() => {
    const mql = window.matchMedia(QUERY)
    const onChange = () => setSystem(mql.matches ? "dark" : "light")
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  React.useEffect(() => apply(resolvedTheme), [resolvedTheme])

  React.useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setThemeState(readTheme())
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const setTheme = React.useCallback((next: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Preference simply won't persist.
    }
    setThemeState(next)
  }, [])

  const value = React.useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = React.useContext(ThemeContext)
  if (!context) throw new Error("useTheme must be used within a ThemeProvider")
  return context
}
