import { useEffect, useMemo, useState } from "react"
import { Download, MoreHorizontal, Plus, Trash2, Upload } from "lucide-react"
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom"
import { toast } from "sonner"

import { EmptyState, Skeleton } from "@/components/data/states"
import { Page, PageHeader, Pane } from "@/components/layout/Page"
import { AllocationBar } from "@/components/portfolio/AllocationBar"
import type { PickedAsset } from "@/components/portfolio/AssetPicker"
import {
  ClosedPositions,
  HoldingsTable,
} from "@/components/portfolio/HoldingsTable"
import { ImportDialog } from "@/components/portfolio/ImportDialog"
import { Performance } from "@/components/portfolio/Performance"
import { TransactionDialog } from "@/components/portfolio/TransactionDialog"
import { TransactionsTable } from "@/components/portfolio/TransactionsTable"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/controls"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { portfolioActions } from "@/hooks/use-portfolio"
import { usePortfolioValuation } from "@/hooks/use-portfolio-valuation"
import { useNow, usePageTitle } from "@/hooks/use-ui"
import {
  formatAge,
  formatDate,
  formatMoney,
  formatPercent,
  todayISO,
} from "@/lib/format"
import { downloadFile } from "@/lib/download"
import {
  findOversell,
  transactionsToCSV,
  type Transaction,
} from "@/lib/portfolio"
import { cn, toneClass } from "@/lib/utils"

function SummaryFigure({
  label,
  value,
  detail,
  tone,
  className,
}: {
  label: string
  value: string
  detail?: React.ReactNode
  tone?: number | null
  className?: string
}) {
  return (
    <div className={cn("bg-surface px-3 py-2.5", className)}>
      <dt className="text-[0.6875rem] text-ink-3">{label}</dt>
      <dd
        className={cn(
          "figure num mt-0.5 text-lg leading-6",
          tone !== undefined ? toneClass(tone) : "text-ink"
        )}
      >
        {value}
      </dd>
      {detail && (
        <dd className="text-[0.6875rem] leading-4 text-ink-3">{detail}</dd>
      )}
    </div>
  )
}

const TABS = ["holdings", "performance", "transactions"] as const

export default function PortfolioPage() {
  usePageTitle("Portfolio")
  const location = useLocation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const now = useNow(15_000)
  const {
    transactions,
    sample,
    positions,
    closed,
    summary,
    pricesLoading,
    pricesUpdatedAt,
    isVolatile,
  } = usePortfolioValuation()
  const tab = TABS.find((t) => t === params.get("tab")) ?? "holdings"
  const [assetFilter, setAssetFilter] = useState("")

  const [dialog, setDialog] = useState<{
    open: boolean
    editing: Transaction | null
    asset: PickedAsset | null
  }>({ open: false, editing: null, asset: null })
  const [confirmClear, setConfirmClear] = useState(false)
  const [importing, setImporting] = useState(false)

  // Deep links from elsewhere ("Add a transaction", "Record a purchase").
  useEffect(() => {
    const state = location.state as {
      addTransaction?: boolean
      asset?: PickedAsset
    } | null
    if (!state?.addTransaction) return
    if (sample) portfolioActions.clear()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- opening a dialog requested via navigation state
    setDialog({ open: true, editing: null, asset: state.asset ?? null })
    navigate(location.pathname + location.search, {
      replace: true,
      state: null,
    })
  }, [location.state, location.pathname, location.search, navigate, sample])

  const openAdd = () => setDialog({ open: true, editing: null, asset: null })
  const startOwn = () => {
    portfolioActions.clear()
    openAdd()
  }

  const remove = (tx: Transaction) => {
    const problem = findOversell(
      transactions.filter((t) => t.id !== tx.id),
      tx.assetId
    )
    if (problem) {
      toast.error(`Can’t delete this ${tx.side}`, {
        description: `Your sale on ${formatDate(problem.date)} depends on it. Delete or edit that sale first.`,
      })
      return
    }
    const removed = portfolioActions.remove(tx.id)
    if (removed)
      toast(`Deleted ${tx.side} of ${tx.name}`, {
        action: {
          label: "Undo",
          onClick: () => portfolioActions.restore(removed),
        },
      })
  }

  const clearAll = () => {
    const before = portfolioActions.get()
    portfolioActions.clear()
    setConfirmClear(false)
    toast("Portfolio cleared", {
      action: {
        label: "Undo",
        onClick: () => portfolioActions.replace(before),
      },
    })
  }

  const empty = transactions.length === 0
  const noPrices = summary.value === null
  const meta = useMemo(
    () =>
      new Map(
        [...positions, ...closed].map(
          (p) => [p.assetId, { name: p.name, image: p.image }] as const
        )
      ),
    [positions, closed]
  )
  const filtered = assetFilter
    ? transactions.filter((t) => t.assetId === assetFilter)
    : transactions
  const fees = transactions.reduce((s, t) => s + (t.fee ?? 0), 0)

  return (
    <Page>
      <PageHeader
        title="Portfolio"
        description={
          empty
            ? "Record what you own to see value, returns, risk and attribution."
            : "Valued at current prices with average-cost accounting. Stored only in this browser."
        }
        actions={
          <>
            {!empty &&
              (sample ? (
                <Button size="sm" variant="primary" onClick={startOwn}>
                  <Plus aria-hidden="true" /> Start your own
                </Button>
              ) : (
                <Button size="sm" variant="primary" onClick={openAdd}>
                  <Plus aria-hidden="true" /> Add transaction
                </Button>
              ))}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" aria-label="More portfolio actions">
                  <MoreHorizontal aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => setImporting(true)}>
                  <Upload aria-hidden="true" /> Import transactions (CSV)…
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={empty}
                  onSelect={() =>
                    downloadFile(
                      `coinwave-transactions-${todayISO()}.csv`,
                      transactionsToCSV(transactions),
                      "text/csv;charset=utf-8"
                    )
                  }
                >
                  <Download aria-hidden="true" /> Export transactions (CSV)
                </DropdownMenuItem>
                {!empty && <DropdownMenuSeparator />}
                {!empty && (
                  <DropdownMenuItem
                    tone="danger"
                    onSelect={() => setConfirmClear(true)}
                  >
                    <Trash2 aria-hidden="true" />{" "}
                    {sample ? "Remove sample" : "Clear portfolio"}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {isVolatile && (
        <p
          role="status"
          className="mb-3 rounded-md border border-rule bg-warn-soft px-3 py-2 text-[0.8125rem] text-warn"
        >
          This browser isn’t allowing CoinWave to save data, so changes will be
          lost when you close the tab.
        </p>
      )}
      {sample && (
        <div className="mb-3 flex flex-col gap-2 rounded-md border border-rule bg-surface px-3 py-2 sm:flex-row sm:items-center">
          <p className="flex-1 text-[0.8125rem] text-ink-2">
            <span className="font-medium text-ink">
              You’re exploring a sample portfolio.
            </span>{" "}
            Example transactions, not real holdings, valued at today’s real
            prices.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="primary" onClick={startOwn}>
              Start your own
            </Button>
            <Button size="sm" onClick={() => portfolioActions.clear()}>
              Remove sample
            </Button>
          </div>
        </div>
      )}

      {empty ? (
        <EmptyState
          title="Your portfolio is empty"
          action={
            <>
              <Button variant="primary" onClick={openAdd}>
                <Plus aria-hidden="true" /> Add your first transaction
              </Button>
              <Button onClick={() => setImporting(true)}>
                <Upload aria-hidden="true" /> Import CSV
              </Button>
              <Button onClick={() => portfolioActions.loadSample()}>
                Explore a sample portfolio
              </Button>
            </>
          }
        >
          Record what you bought or sold, with the date, price and any fee.
          CoinWave values holdings at live prices, separates today’s market move
          from your overall return, and rebuilds performance from your history.
          Nothing leaves this browser.
        </EmptyState>
      ) : (
        <>
          <section aria-label="Summary">
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-rule bg-rule lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
              <div className="col-span-2 bg-surface px-3 py-2.5 lg:col-span-1">
                <dt className="text-[0.6875rem] text-ink-3">Holdings value</dt>
                <dd className="mt-0.5">
                  {pricesLoading ? (
                    <Skeleton className="h-9 w-48" />
                  ) : (
                    <span className="figure num block text-[2rem] leading-10 text-ink">
                      {formatMoney(summary.value)}
                    </span>
                  )}
                </dd>
                <dd className="text-[0.6875rem] text-ink-3">
                  {summary.openCount}{" "}
                  {summary.openCount === 1 ? "asset" : "assets"}
                  {pricesUpdatedAt
                    ? ` · prices ${formatAge(pricesUpdatedAt, now)}`
                    : ""}
                  {fees > 0 ? ` · ${formatMoney(fees)} fees recorded` : ""}
                </dd>
              </div>
              <SummaryFigure
                label="Today (market move)"
                value={formatMoney(summary.change24hValue, { signed: true })}
                tone={summary.change24hValue}
                detail={
                  noPrices ? (
                    "Needs current prices"
                  ) : (
                    <>
                      <span className={toneClass(summary.change24hPct)}>
                        {formatPercent(summary.change24hPct)}
                      </span>{" "}
                      over 24h for what you hold now
                      {summary.change24hExcluded.length > 0 && (
                        <span className="block text-warn">
                          Excludes {summary.change24hExcluded.join(", ")} (no
                          24h data)
                        </span>
                      )}
                    </>
                  )
                }
              />
              <SummaryFigure
                label="Unrealised P&L"
                value={formatMoney(summary.unrealizedPnL, { signed: true })}
                tone={summary.unrealizedPnL}
                detail={
                  noPrices ? (
                    "Needs current prices"
                  ) : summary.openCount === 0 ? (
                    "No open positions"
                  ) : (
                    <>
                      <span className={toneClass(summary.unrealizedPct)}>
                        {formatPercent(summary.unrealizedPct)}
                      </span>{" "}
                      on {formatMoney(summary.costBasis)} cost
                    </>
                  )
                }
              />
              <SummaryFigure
                label="Realised P&L"
                value={formatMoney(summary.realizedPnL, { signed: true })}
                tone={summary.realizedPnL}
                detail="Locked in by sales, after fees"
              />
              <SummaryFigure
                label="Total return"
                value={formatMoney(summary.totalPnL, { signed: true })}
                tone={summary.totalPnL}
                detail="Unrealised + realised (your performance)"
              />
            </dl>
            {noPrices ? (
              <p className="mt-2 text-[0.8125rem] text-warn">
                Current prices are unavailable, so value and returns can’t be
                calculated right now. Realised P&amp;L is unaffected.
              </p>
            ) : (
              summary.unpriced.length > 0 && (
                <p className="mt-2 text-[0.8125rem] text-warn">
                  No current price for {summary.unpriced.join(", ")}.{" "}
                  {summary.unpriced.length === 1 ? "It is" : "They are"} left
                  out of the totals rather than counted as zero.
                </p>
              )
            )}
          </section>

          <Tabs
            value={tab}
            onValueChange={(v) =>
              setParams(v === "holdings" ? {} : { tab: v }, { replace: true })
            }
            className="mt-3 rounded-md border border-rule bg-surface"
          >
            <TabsList aria-label="Portfolio views">
              <TabsTrigger value="holdings">Holdings</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="transactions">
                Transactions ({transactions.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="holdings" className="space-y-4 p-3">
              {positions.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="eyebrow">Allocation</h2>
                    <Link
                      to="/risk"
                      className="text-xs font-medium text-accent hover:underline"
                    >
                      Concentration and risk →
                    </Link>
                  </div>
                  {pricesLoading ? (
                    <Skeleton className="h-24" />
                  ) : noPrices ? (
                    <p className="text-[0.8125rem] text-ink-3">
                      Allocation appears once current prices load.
                    </p>
                  ) : (
                    <AllocationBar
                      positions={positions}
                      transactions={transactions}
                      effectivePositions={summary.effectivePositions}
                    />
                  )}
                </div>
              )}
              {positions.length > 0 && (
                <div>
                  <h2 className="eyebrow mb-1">Holdings</h2>
                  <div className="overflow-x-auto">
                    <HoldingsTable positions={positions} />
                  </div>
                </div>
              )}
              {closed.length > 0 && (
                <div>
                  <h2 className="eyebrow mb-1">Closed positions</h2>
                  <ClosedPositions positions={closed} />
                </div>
              )}
            </TabsContent>

            <TabsContent value="performance" className="p-3">
              {sample && (
                <p className="mb-2 text-xs text-ink-3">
                  Performance of the sample transactions, using real historical
                  prices.
                </p>
              )}
              <Performance transactions={transactions} />
            </TabsContent>

            <TabsContent value="transactions" className="p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <Select
                  aria-label="Filter transactions by asset"
                  value={assetFilter}
                  onChange={(e) => setAssetFilter(e.target.value)}
                  className="w-48"
                >
                  <option value="">All assets</option>
                  {[...meta.entries()].map(([id, m]) => (
                    <option key={id} value={id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
                <span className="text-xs text-ink-3">
                  {filtered.length} entries
                </span>
              </div>
              <TransactionsTable
                transactions={filtered}
                readOnly={sample}
                meta={meta}
                onEdit={(tx) =>
                  setDialog({ open: true, editing: tx, asset: null })
                }
                onDelete={remove}
              />
            </TabsContent>
          </Tabs>
        </>
      )}

      <TransactionDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        editing={dialog.editing}
        initialAsset={dialog.asset}
      />
      <ImportDialog open={importing} onOpenChange={setImporting} />
      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {sample
                ? "Remove the sample portfolio?"
                : "Clear your portfolio?"}
            </DialogTitle>
            <DialogDescription>
              {sample
                ? "The example transactions will be removed."
                : `All ${transactions.length} transactions will be deleted from this browser. Export a CSV first if you want a copy.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setConfirmClear(false)}>Cancel</Button>
            <Button variant="danger" onClick={clearAll}>
              {sample ? "Remove sample" : "Clear portfolio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Pane title="Accounting notes" className="mt-3">
        <ul className="list-disc space-y-1 pl-4 text-xs leading-5 text-ink-2">
          <li>
            Average-cost method: a sale removes quantity at the current average
            cost; the difference from proceeds is realised P&amp;L.
          </li>
          <li>
            Buy fees are added to cost basis; sale fees reduce proceeds. Amounts
            are in US dollars.
          </li>
          <li>
            “Today” is the 24h change in value of what you hold now (market
            movement). “Total return” is your own performance since purchase.
          </li>
          <li>
            Transfers between your own wallets don’t need recording. Crypto
            received from elsewhere (airdrops, income) can be entered as a buy
            at the price you consider its cost, or at zero.
          </li>
          <li>
            Assets are identified by CoinGecko id, never by ticker, because
            tickers are not unique.
          </li>
        </ul>
      </Pane>
    </Page>
  )
}
