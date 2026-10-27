import { useId, useMemo, useState } from "react"
import { toast } from "sonner"

import {
  AssetPicker,
  type PickedAsset,
} from "@/components/portfolio/AssetPicker"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useAsset } from "@/hooks/queries"
import { portfolioActions, usePortfolio } from "@/hooks/use-portfolio"
import {
  formatDate,
  formatMoney,
  formatPrice,
  formatQuantity,
  isNum,
  parseAmount,
  todayISO,
} from "@/lib/format"
import {
  findOversell,
  newId,
  quantityHeldOn,
  type Side,
  type Transaction,
} from "@/lib/portfolio"
import { cn } from "@/lib/utils"

type Errors = Partial<
  Record<"asset" | "quantity" | "price" | "fee" | "date", string>
>

function CurrentPrice({
  assetId,
  onUse,
}: {
  assetId: string
  onUse: (price: number) => void
}) {
  const { asset } = useAsset(assetId)
  if (!asset || !isNum(asset.price)) return null
  return (
    <button
      type="button"
      onClick={() => onUse(asset.price!)}
      className="text-xs font-medium text-accent hover:underline"
    >
      Use current price ({formatPrice(asset.price)})
    </button>
  )
}

function TransactionForm({
  editing,
  initialAsset,
  onDone,
}: {
  editing: Transaction | null
  initialAsset: PickedAsset | null
  onDone: () => void
}) {
  const ids = useId()
  const field = (name: string) => `${ids}-${name}`
  const { transactions, heldIds } = usePortfolio()

  const [side, setSide] = useState<Side>(editing?.side ?? "buy")
  const [asset, setAsset] = useState<PickedAsset | null>(
    editing
      ? {
          id: editing.assetId,
          name: editing.name,
          symbol: editing.symbol,
          image: editing.image,
        }
      : initialAsset
  )
  const [quantity, setQuantity] = useState(
    editing ? String(editing.quantity) : ""
  )
  const [price, setPrice] = useState(editing ? String(editing.price) : "")
  // Imported entries have no recorded date; keep it unknown unless the user sets one.
  const dateWasUnknown = editing !== null && editing.date === null
  const [date, setDate] = useState(editing ? (editing.date ?? "") : todayISO())
  const [note, setNote] = useState(editing?.note ?? "")
  const [fee, setFee] = useState(editing?.fee ? String(editing.fee) : "")
  const [submitted, setSubmitted] = useState(false)

  const qty = parseAmount(quantity)
  const unitPrice = parseAmount(price)
  const feeAmount = fee.trim() ? parseAmount(fee) : 0
  const today = todayISO()

  const available = useMemo(
    () =>
      asset && date
        ? quantityHeldOn(transactions, asset.id, date, editing?.id)
        : 0,
    [asset, date, transactions, editing]
  )

  const errors: Errors = useMemo(() => {
    const e: Errors = {}
    if (!asset) e.asset = "Choose the asset you bought or sold."
    if (!quantity.trim()) e.quantity = "Enter a quantity."
    else if (!isNum(qty))
      e.quantity = "Enter a number such as 0.5, using a dot for decimals."
    else if (qty <= 0) e.quantity = "Quantity must be greater than zero."
    else if (qty > 1e15) e.quantity = "That quantity is too large."
    if (!price.trim()) e.price = "Enter the price per unit."
    else if (!isNum(unitPrice))
      e.price = "Enter a number such as 61250.50, using a dot for decimals."
    if (!isNum(feeAmount)) e.fee = "Enter the fee in USD, or leave it empty."
    if (!date && !dateWasUnknown) e.date = "Choose a date."
    else if (date > today) e.date = "The date can’t be in the future."

    if (!e.asset && !e.quantity && !e.date) {
      const effectiveDate = date || null
      const candidate: Transaction = {
        id: editing?.id ?? "candidate",
        assetId: asset!.id,
        symbol: asset!.symbol,
        name: asset!.name,
        image: asset!.image,
        side,
        quantity: qty,
        price: isNum(unitPrice) ? unitPrice : 0,
        date: effectiveDate,
        // A new entry sorts after existing ones on the same day, as it will once saved.
        createdAt: editing?.createdAt ?? Number.MAX_SAFE_INTEGER,
      }
      const others = transactions.filter((t) => t.id !== editing?.id)
      if (side === "sell" && qty > available + 1e-12) {
        e.quantity =
          available > 0
            ? `You held ${formatQuantity(available)} ${asset!.symbol} on ${formatDate(date)}.`
            : `You held no ${asset!.symbol} on ${formatDate(date)}.`
      } else {
        const problem = findOversell([...others, candidate], asset!.id)
        if (problem) {
          e.quantity = `This would leave your later sale on ${formatDate(problem.date)} short by ${formatQuantity(problem.shortBy)} ${asset!.symbol}.`
        }
      }
    }
    return e
  }, [
    asset,
    quantity,
    qty,
    price,
    unitPrice,
    date,
    today,
    side,
    available,
    transactions,
    editing,
    dateWasUnknown,
    feeAmount,
  ])

  const show = (key: keyof Errors) => (submitted ? errors[key] : undefined)
  const gross = isNum(qty) && isNum(unitPrice) ? qty * unitPrice : null
  const fees = isNum(feeAmount) ? feeAmount : 0
  const total =
    gross === null ? null : side === "buy" ? gross + fees : gross - fees

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(errors).length > 0) {
      const first = (
        ["asset", "quantity", "price", "fee", "date"] as const
      ).find((k) => errors[k])
      if (first) document.getElementById(field(first))?.focus()
      return
    }
    const tx: Transaction = {
      id: editing?.id ?? newId(),
      assetId: asset!.id,
      symbol: asset!.symbol,
      name: asset!.name,
      image: asset!.image,
      side,
      quantity: qty,
      price: unitPrice,
      ...(fees > 0 ? { fee: fees } : {}),
      date: date || null,
      createdAt: editing?.createdAt ?? Date.now(),
      note: note.trim() || undefined,
    }
    if (editing) portfolioActions.update(tx)
    else portfolioActions.add(tx)
    toast(
      `${editing ? "Updated" : "Recorded"} ${side === "buy" ? "purchase" : "sale"} of ${formatQuantity(qty)} ${asset!.symbol}`
    )
    onDone()
  }

  const errorText = (key: keyof Errors) =>
    show(key) ? (
      <p id={field(`${key}-error`)} className="mt-1.5 text-xs text-down">
        {show(key)}
      </p>
    ) : null

  return (
    <form onSubmit={submit} noValidate>
      <fieldset className="mb-5">
        <legend className="sr-only">Transaction type</legend>
        <div className="grid grid-cols-2 rounded-md border border-rule-strong p-0.5">
          {(["buy", "sell"] as const).map((s) => (
            <label
              key={s}
              className={cn(
                "flex h-9 cursor-pointer items-center justify-center rounded-[5px] text-sm font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent",
                side === s ? "bg-ink text-bg" : "text-ink-2 hover:text-ink"
              )}
            >
              <input
                type="radio"
                name={field("side")}
                value={s}
                checked={side === s}
                onChange={() => setSide(s)}
                className="sr-only"
              />
              {s === "buy" ? "Buy" : "Sell"}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-4">
        <div>
          <label
            htmlFor={field("asset")}
            className="mb-1.5 block text-sm font-medium text-ink"
          >
            Asset
          </label>
          <AssetPicker
            inputId={field("asset")}
            value={asset}
            onChange={setAsset}
            suggestedIds={heldIds}
            invalid={!!show("asset")}
            describedBy={show("asset") ? field("asset-error") : undefined}
          />
          {errorText("asset")}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor={field("quantity")}
              className="mb-1.5 block text-sm font-medium text-ink"
            >
              Quantity{asset ? ` (${asset.symbol})` : ""}
            </label>
            <Input
              id={field("quantity")}
              inputMode="decimal"
              autoComplete="off"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0.00"
              aria-invalid={!!show("quantity") || undefined}
              aria-describedby={
                [
                  show("quantity") && field("quantity-error"),
                  side === "sell" && asset && field("quantity-hint"),
                ]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
              className="num h-11"
            />
            {/* Stays visible alongside an error, so "Sell all" is one click away. */}
            {side === "sell" && asset && (
              <p
                id={field("quantity-hint")}
                className="mt-1.5 text-xs text-ink-3"
              >
                Held on that date: {formatQuantity(available)} {asset.symbol}
                {available > 0 && (
                  <>
                    {" · "}
                    <button
                      type="button"
                      className="font-medium text-accent hover:underline"
                      onClick={() =>
                        setQuantity(String(Number(available.toPrecision(12))))
                      }
                    >
                      Sell all
                    </button>
                  </>
                )}
              </p>
            )}
            {errorText("quantity")}
          </div>
          <div>
            <label
              htmlFor={field("price")}
              className="mb-1.5 block text-sm font-medium text-ink"
            >
              Price per unit (USD)
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-3">
                $
              </span>
              <Input
                id={field("price")}
                inputMode="decimal"
                autoComplete="off"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                aria-invalid={!!show("price") || undefined}
                aria-describedby={
                  show("price") ? field("price-error") : undefined
                }
                className="num h-11 pl-6"
              />
            </div>
            {asset && !show("price") && (
              <p className="mt-1.5">
                <CurrentPrice
                  assetId={asset.id}
                  onUse={(p) => setPrice(String(p))}
                />
              </p>
            )}
            {errorText("price")}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor={field("date")}
              className="mb-1.5 block text-sm font-medium text-ink"
            >
              Date
            </label>
            <Input
              id={field("date")}
              type="date"
              max={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={!!show("date") || undefined}
              aria-describedby={
                show("date")
                  ? field("date-error")
                  : dateWasUnknown
                    ? field("date-hint")
                    : undefined
              }
              className="h-11"
            />
            {dateWasUnknown && !date && !show("date") && (
              <p id={field("date-hint")} className="mt-1.5 text-xs text-ink-3">
                The original date wasn’t recorded. Leave it blank to keep it
                unknown.
              </p>
            )}
            {errorText("date")}
          </div>
          <div>
            <label
              htmlFor={field("fee")}
              className="mb-1.5 block text-sm font-medium text-ink"
            >
              Fee (USD){" "}
              <span className="font-normal text-ink-3">(optional)</span>
            </label>
            <Input
              id={field("fee")}
              inputMode="decimal"
              autoComplete="off"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              placeholder="0.00"
              aria-invalid={!!show("fee") || undefined}
              aria-describedby={show("fee") ? field("fee-error") : undefined}
              className="num h-11"
            />
            {errorText("fee")}
          </div>
        </div>
        <div>
          <label
            htmlFor={field("note")}
            className="mb-1.5 block text-sm font-medium text-ink"
          >
            Note <span className="font-normal text-ink-3">(optional)</span>
          </label>
          <Input
            id={field("note")}
            value={note}
            maxLength={140}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. exchange or wallet"
            className="h-11"
          />
        </div>
      </div>

      <div className="mt-5 flex items-baseline justify-between border-t border-rule pt-4">
        <span className="text-sm text-ink-2">
          {side === "buy" ? "Total cost" : "Net proceeds"}
          {fees > 0 && (
            <span className="block text-xs text-ink-3">
              {side === "buy" ? "includes" : "after"} {formatMoney(fees)} fee
            </span>
          )}
        </span>
        <span className="num text-lg font-semibold text-ink" aria-live="polite">
          {formatMoney(total)}
        </span>
      </div>

      <DialogFooter className="mt-5">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary">
          {editing
            ? "Save changes"
            : side === "buy"
              ? "Record purchase"
              : "Record sale"}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function TransactionDialog({
  open,
  onOpenChange,
  editing,
  initialAsset = null,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: Transaction | null
  initialAsset?: PickedAsset | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit transaction" : "Add a transaction"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Changes recalculate your holdings and returns."
              : "Record a purchase or sale. Holdings and returns are calculated from these entries."}
          </DialogDescription>
        </DialogHeader>
        {/* Remount per open so the form always starts from its initial values. */}
        {open && (
          <TransactionForm
            key={editing?.id ?? initialAsset?.id ?? "new"}
            editing={editing}
            initialAsset={initialAsset}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
