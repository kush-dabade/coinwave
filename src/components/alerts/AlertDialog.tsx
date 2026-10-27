import { useMemo, useState } from "react"
import { toast } from "sonner"

import {
  AssetPicker,
  type PickedAsset,
} from "@/components/portfolio/AssetPicker"
import { Button } from "@/components/ui/button"
import { Field, Select, Textarea } from "@/components/ui/controls"
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
import { usePortfolioValuation } from "@/hooks/use-portfolio-valuation"
import {
  ALERT_KINDS,
  conditionMet,
  describeAlert,
  formatObserved,
  isAssetAlert,
  observedValue,
  type Alert,
  type AlertKind,
  type AlertPeriod,
} from "@/lib/alerts"
import { parseAmount } from "@/lib/format"
import { alertActions, journalActions, useJournal } from "@/stores"

export type AlertDraft = {
  asset?: PickedAsset | null
  kind?: AlertKind
  threshold?: number
  period?: AlertPeriod
  thesisId?: string | null
  note?: string
}

function AlertForm({
  draft,
  editing,
  onDone,
}: {
  draft: AlertDraft
  editing: Alert | null
  onDone: () => void
}) {
  const { theses } = useJournal()
  const [asset, setAsset] = useState<PickedAsset | null>(
    editing?.assetId
      ? {
          id: editing.assetId,
          name: editing.name,
          symbol: editing.symbol,
          image: null,
        }
      : (draft.asset ?? null)
  )
  const [kind, setKind] = useState<AlertKind>(
    editing?.kind ?? draft.kind ?? "price_above"
  )
  const [threshold, setThreshold] = useState(
    editing
      ? String(editing.threshold)
      : draft.threshold !== undefined
        ? String(Number(draft.threshold.toPrecision(8)))
        : ""
  )
  const [period, setPeriod] = useState<AlertPeriod>(
    editing?.period ?? draft.period ?? "24h"
  )
  const [note, setNote] = useState(editing?.note ?? draft.note ?? "")
  const [thesisId, setThesisId] = useState<string>(
    editing?.thesisId ?? draft.thesisId ?? ""
  )
  const [submitted, setSubmitted] = useState(false)

  const assetScope = isAssetAlert(kind)
  const live = useAsset(assetScope && asset ? asset.id : "")
  const portfolio = usePortfolioValuation()
  const value =
    parseAmount(threshold.replace(/^\+/, "").replace(/^-/, "")) *
    (threshold.trim().startsWith("-") ? -1 : 1)

  const current = useMemo(
    () =>
      observedValue(
        { kind, period: kind.startsWith("change") ? period : null },
        {
          asset: assetScope ? live.asset : null,
          portfolioValue: assetScope ? null : portfolio.summary.value,
        }
      ),
    [kind, period, assetScope, live.asset, portfolio.summary.value]
  )

  const errors = {
    asset: assetScope && !asset ? "Choose an asset." : null,
    threshold: !threshold.trim()
      ? "Enter a threshold."
      : !Number.isFinite(value)
        ? "Enter a number, using a dot for decimals."
        : (kind.startsWith("price") ||
              kind === "volume_above" ||
              kind.startsWith("portfolio")) &&
            value <= 0
          ? "The threshold must be greater than zero."
          : null,
  }
  const alreadyMet =
    current !== null &&
    Number.isFinite(value) &&
    conditionMet({ kind, threshold: value }, current)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (errors.asset || errors.threshold) return
    const base = {
      kind,
      assetId: assetScope ? asset!.id : null,
      symbol: assetScope ? asset!.symbol : "",
      name: assetScope ? asset!.name : "Portfolio",
      threshold: value,
      period: kind.startsWith("change") ? period : null,
      note: note.trim(),
      thesisId: thesisId || null,
    }
    if (editing) {
      alertActions.update(editing.id, base)
      toast("Alert updated")
    } else {
      const created = alertActions.create(base)
      if (thesisId) {
        const t = theses.find((x) => x.id === thesisId)
        if (t)
          journalActions.update(t.id, { alertIds: [...t.alertIds, created.id] })
      }
      toast(`Alert created: ${describeAlert(created)}`)
    }
    onDone()
  }

  const unit = kind.startsWith("change") ? "%" : "USD"
  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <Field label="Condition" htmlFor="alert-kind">
        <Select
          id="alert-kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as AlertKind)}
          className="w-full"
        >
          <optgroup label="Asset">
            {ALERT_KINDS.filter((k) => k.scope === "asset").map((k) => (
              <option key={k.kind} value={k.kind}>
                {k.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Portfolio">
            {ALERT_KINDS.filter((k) => k.scope === "portfolio").map((k) => (
              <option key={k.kind} value={k.kind}>
                {k.label}
              </option>
            ))}
          </optgroup>
        </Select>
      </Field>
      {assetScope && (
        <Field
          label="Asset"
          htmlFor="alert-asset"
          error={submitted ? errors.asset : null}
        >
          <AssetPicker
            inputId="alert-asset"
            value={asset}
            onChange={setAsset}
            suggestedIds={[]}
            invalid={submitted && !!errors.asset}
          />
        </Field>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label={`Threshold (${unit})`}
          htmlFor="alert-threshold"
          error={submitted ? errors.threshold : null}
          hint={
            current !== null
              ? `Now: ${formatObserved(kind, current)}`
              : undefined
          }
        >
          <Input
            id="alert-threshold"
            inputMode="decimal"
            autoComplete="off"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            placeholder={unit === "%" ? "e.g. 10 or -10" : "e.g. 100000"}
            aria-invalid={submitted && !!errors.threshold ? true : undefined}
            className="num"
          />
        </Field>
        {kind.startsWith("change") && (
          <Field label="Over" htmlFor="alert-period">
            <Select
              id="alert-period"
              value={period}
              onChange={(e) => setPeriod(e.target.value as AlertPeriod)}
              className="w-full"
            >
              <option value="1h">1 hour</option>
              <option value="24h">24 hours</option>
              <option value="7d">7 days</option>
            </Select>
          </Field>
        )}
      </div>
      {alreadyMet && (
        <p
          className="rounded-md bg-warn-soft px-3 py-2 text-xs text-warn"
          role="status"
        >
          This condition is already true, so the alert will trigger at the next
          data refresh.
        </p>
      )}
      <Field label="Linked thesis (optional)" htmlFor="alert-thesis">
        <Select
          id="alert-thesis"
          value={thesisId}
          onChange={(e) => setThesisId(e.target.value)}
          className="w-full"
        >
          <option value="">None</option>
          {theses.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title || "Untitled thesis"}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Note (optional)" htmlFor="alert-note">
        <Textarea
          id="alert-note"
          rows={2}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why this level matters"
        />
      </Field>
      <DialogFooter>
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary">
          {editing ? "Save alert" : "Create alert"}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function AlertDialog({
  open,
  onOpenChange,
  draft = {},
  editing = null,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  draft?: AlertDraft
  editing?: Alert | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit alert" : "New alert"}</DialogTitle>
          <DialogDescription>
            Alerts are checked against fresh data while CoinWave is open in a
            browser tab. They cannot run in the background or when the tab is
            closed.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <AlertForm
            key={editing?.id ?? draft.asset?.id ?? "new"}
            draft={draft}
            editing={editing}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
