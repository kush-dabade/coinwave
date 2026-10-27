import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

/** Small dialog asking for a single name (new list, collection, layout…). */
export function NameDialog({
  open,
  onOpenChange,
  title,
  description,
  label = "Name",
  initial = "",
  confirm = "Create",
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  label?: string
  initial?: string
  confirm?: string
  onSubmit: (name: string) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className={description ? undefined : "sr-only"}>
            {description ?? title}
          </DialogDescription>
        </DialogHeader>
        {open && (
          <NameForm
            label={label}
            initial={initial}
            confirm={confirm}
            onCancel={() => onOpenChange(false)}
            onSubmit={(n) => {
              onSubmit(n)
              onOpenChange(false)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function NameForm({
  label,
  initial,
  confirm,
  onCancel,
  onSubmit,
}: {
  label: string
  initial: string
  confirm: string
  onCancel: () => void
  onSubmit: (name: string) => void
}) {
  const [name, setName] = useState(initial)
  const [touched, setTouched] = useState(false)
  const invalid = name.trim() === ""
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setTouched(true)
        if (!invalid) onSubmit(name.trim())
      }}
      noValidate
    >
      <label
        htmlFor="name-dialog-input"
        className="mb-1 block text-xs font-medium text-ink-2"
      >
        {label}
      </label>
      <Input
        id="name-dialog-input"
        autoFocus
        value={name}
        maxLength={80}
        onChange={(e) => setName(e.target.value)}
        aria-invalid={touched && invalid ? true : undefined}
        aria-describedby={touched && invalid ? "name-dialog-error" : undefined}
      />
      {touched && invalid && (
        <p id="name-dialog-error" className="mt-1 text-xs text-down">
          Enter a name.
        </p>
      )}
      <DialogFooter>
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary">
          {confirm}
        </Button>
      </DialogFooter>
    </form>
  )
}
