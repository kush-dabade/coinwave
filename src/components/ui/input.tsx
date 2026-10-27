import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-rule-strong bg-surface px-3 text-[0.9375rem] text-ink transition-colors outline-none placeholder:text-ink-3 focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent/30 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-down aria-invalid:focus-visible:outline-down/30 sm:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
