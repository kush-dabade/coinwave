import { useMemo, useState } from "react"
import { Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/controls"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { portfolioActions, usePortfolio } from "@/hooks/use-portfolio"
import { formatDate, formatQuantity } from "@/lib/format"
import {
  findAnyOversell,
  parseTransactionsCSV,
  transactionKey,
} from "@/lib/portfolio"

/**
 * Imports transactions from CSV (CoinWave's export format). Shows a preview
 * with errors and duplicates before anything changes; never replaces data
 * silently.
 */
export function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Import transactions</DialogTitle>
          <DialogDescription>
            CSV with columns date, side, asset_id, quantity, price_usd and
            optionally symbol, name, fee_usd, note, as produced by Export.
            asset_id is the CoinGecko id (for example “bitcoin”).
          </DialogDescription>
        </DialogHeader>
        {open && <ImportForm onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function ImportForm({ onDone }: { onDone: () => void }) {
  const { transactions, sample } = usePortfolio()
  const [text, setText] = useState("")
  const [fileName, setFileName] = useState<string | null>(null)

  const result = useMemo(
    () => (text.trim() ? parseTransactionsCSV(text) : null),
    [text]
  )
  // The bundled sample is replaced, never merged with imported rows.
  const base = useMemo(
    () => (sample ? [] : transactions),
    [transactions, sample]
  )
  const fresh = useMemo(() => {
    const existing = new Set(base.map(transactionKey))
    return (
      result?.transactions.filter((t) => !existing.has(transactionKey(t))) ?? []
    )
  }, [base, result])
  const duplicates = (result?.transactions.length ?? 0) - fresh.length
  const oversell = useMemo(
    () =>
      findAnyOversell(
        [...base, ...fresh],
        fresh.map((t) => t.assetId)
      ),
    [base, fresh]
  )

  const onFile = async (file: File | undefined) => {
    if (!file) return
    if (file.size > 2_000_000) {
      toast.error(
        "That file is too large to be a transaction export (limit 2 MB)."
      )
      return
    }
    setFileName(file.name)
    setText(await file.text())
  }

  const apply = () => {
    if (!fresh.length || oversell) return
    if (sample) portfolioActions.clear()
    fresh.forEach((t) => portfolioActions.add(t))
    toast(
      `Imported ${fresh.length} transaction${fresh.length === 1 ? "" : "s"}${duplicates ? `, skipped ${duplicates} duplicate${duplicates === 1 ? "" : "s"}` : ""}`
    )
    onDone()
  }

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-rule-strong px-3 py-3 text-[0.8125rem] text-ink-2 hover:border-ink-3">
        <Upload className="size-4 text-ink-3" aria-hidden="true" />
        <span className="flex-1">{fileName ?? "Choose a .csv file"}</span>
        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </label>
      <div>
        <label
          htmlFor="csv-paste"
          className="mb-1 block text-xs font-medium text-ink-2"
        >
          …or paste CSV
        </label>
        <Textarea
          id="csv-paste"
          rows={5}
          className="mono text-xs"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setFileName(null)
          }}
          placeholder={
            "date,side,asset_id,quantity,price_usd\n2025-03-14,buy,bitcoin,0.1,61250"
          }
        />
      </div>
      {result && (
        <div
          className="space-y-2 rounded-md border border-rule bg-surface-2/50 p-3 text-[0.8125rem]"
          role="status"
        >
          <p>
            <span className="num font-semibold text-ink">{fresh.length}</span>{" "}
            new · <span className="num">{duplicates}</span> already in your
            ledger (skipped) ·{" "}
            <span className={result.errors.length ? "text-down" : ""}>
              <span className="num">{result.errors.length}</span> invalid rows
            </span>
          </p>
          {sample && fresh.length > 0 && (
            <p className="text-xs text-warn">
              The sample portfolio will be removed and replaced by these
              transactions.
            </p>
          )}
          {oversell && (
            <p className="text-xs text-down">
              Can’t import: sales of{" "}
              {fresh.find((t) => t.assetId === oversell.assetId)?.symbol ??
                oversell.assetId}{" "}
              would exceed holdings on {formatDate(oversell.date)} by{" "}
              {formatQuantity(oversell.shortBy)}. Add the missing purchases to
              the file first.
            </p>
          )}
          {result.errors.length > 0 && (
            <ul className="max-h-28 overflow-y-auto text-xs text-ink-2">
              {result.errors.slice(0, 20).map((e) => (
                <li key={e.line}>
                  Line {e.line}: {e.message}
                </li>
              ))}
              {result.errors.length > 20 && (
                <li>…and {result.errors.length - 20} more</li>
              )}
            </ul>
          )}
        </div>
      )}
      <DialogFooter>
        <Button onClick={onDone}>Cancel</Button>
        <Button
          variant="primary"
          disabled={!fresh.length || !!oversell}
          onClick={apply}
        >
          Import {fresh.length || ""} transaction{fresh.length === 1 ? "" : "s"}
        </Button>
      </DialogFooter>
    </div>
  )
}
