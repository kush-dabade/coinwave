import { createContext, useContext } from "react"

type CommandPaletteContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
}

export const CommandPaletteContext = createContext<CommandPaletteContextValue>({
  open: false,
  setOpen: () => {},
})

export function useCommandPalette() {
  return useContext(CommandPaletteContext)
}
