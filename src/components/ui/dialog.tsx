import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogClose = DialogPrimitive.Close

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#0e1013]/45 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
      <DialogPrimitive.Content
        className={cn(
          // Bottom sheet on phones, centred dialog from `sm` up.
          "fixed inset-x-0 bottom-0 z-50 flex max-h-[92svh] flex-col overflow-y-auto rounded-t-xl border border-rule bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-ink shadow-pop outline-none sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[calc(100%-2rem)] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:p-6 data-open:animate-in data-open:slide-in-from-bottom-6 sm:data-open:slide-in-from-bottom-0 sm:data-open:zoom-in-97 data-closed:animate-out data-closed:fade-out-0",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            className="absolute top-3 right-3 inline-flex size-8 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label="Close"
          >
            <XIcon className="size-4" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mb-4 flex flex-col gap-1 pr-8", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mt-6 flex gap-2 sm:justify-end",
        // Phones: the dialog is a scrolling bottom sheet, so the actions stay
        // pinned to its lower edge instead of scrolling out of reach.
        "max-sm:sticky max-sm:bottom-0 max-sm:z-10 max-sm:-mx-5 max-sm:-mb-[max(1.25rem,env(safe-area-inset-bottom))] max-sm:border-t max-sm:border-rule max-sm:bg-surface max-sm:px-5 max-sm:pt-3 max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom))] max-sm:[&>*]:flex-1",
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn(
        "font-serif text-[1.375rem] leading-7 font-medium tracking-[-0.01em]",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-sm text-ink-2", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
}
