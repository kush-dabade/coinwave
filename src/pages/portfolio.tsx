import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { calculatePortfolioValue, COIN_MAP } from "@/lib/portfolio"
import type { Holding } from "@/lib/portfolio"
import AllocationChart from "@/components/portfolio/AllocationChart"
import { columns } from "@/components/portfolio/columns"
import { DataTable } from "@/components/ui/data-table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function PortfolioPage() {
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        // pause if tab inactive (important)
        if (document.hidden) return

        const ids = Object.values(COIN_MAP).join(",")
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`
        )
        const data = await res.json()

        const formatted: Record<string, number> = {}
        Object.entries(COIN_MAP).forEach(([s, id]) => {
          formatted[s] = data[id]?.usd || 0
        })

        setPrices(formatted)
        setLastUpdated(new Date())
      } catch (err) {
        console.error("Price fetch failed", err)
      }
    }

    fetchPrices()

    // 15 sec refresh (sweet spot)
    const interval = setInterval(fetchPrices, 15000)

    return () => clearInterval(interval)
  }, [])

  const [open, setOpen] = useState(false)
  const [holdings, setHoldings] = useState<Holding[]>(() => {
    try {
      const saved = localStorage.getItem("coinwave_holdings")
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [globalSearch, setGlobalSearch] = useState("")

  useEffect(() => {
    localStorage.setItem("coinwave_holdings", JSON.stringify(holdings))
  }, [holdings])

  type Row = {
    symbol: string
    delta: string
    price: string
    search: string
  }

  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(
      holdings.length
        ? holdings.map((h) => ({
            symbol: h.symbol,
            delta: "",
            price: h.avgPrice.toString(),
            search: "",
          }))
        : [{ symbol: "", delta: "", price: "", search: "" }]
    )
  }, [open, holdings, prices])

  const updateRow = (i: number, patch: Partial<Row>) => {
    setRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r))
    )
  }

  const addRow = () =>
    setRows((p) => [...p, { symbol: "", delta: "", price: "", search: "" }])

  const removeRow = (i: number) =>
    setRows((p) => p.filter((_, idx) => idx !== i))

  const coinEntries = useMemo(() => Object.entries(COIN_MAP), [])

  const searchCoins = (q: string) => {
    const s = q.toLowerCase()
    return coinEntries.filter(
      ([sym, id]) =>
        sym.toLowerCase().includes(s) || id.toLowerCase().includes(s)
    )
  }

  const applyChanges = () => {
    const valid = rows.filter((r) => r.symbol && r.price)
    if (!valid.length) return

    setHoldings((prev) => {
      let next = [...prev]

      for (const r of valid) {
        const symbol = r.symbol.toUpperCase()
        const delta = parseFloat(r.delta || "0")
        const price = parseFloat(r.price)

        const idx = next.findIndex((h) => h.symbol === symbol)

        if (idx === -1) {
          if (delta > 0) next.push({ symbol, amount: delta, avgPrice: price })
          continue
        }

        const h = next[idx]
        const newAmt = h.amount + delta

        if (newAmt <= 0) {
          next = next.filter((x) => x.symbol !== symbol)
          continue
        }

        let newAvg = h.avgPrice
        if (delta > 0) {
          newAvg = (h.amount * h.avgPrice + delta * price) / newAmt
        }

        next[idx] = {
          symbol,
          amount: newAmt,
          avgPrice: newAvg,
        }
      }

      return next
    })

    setOpen(false)
  }

  // ===== Portfolio calculations =====
  const totalValue = calculatePortfolioValue(holdings, prices)

  const tableData = holdings.map((h) => {
    const price = prices[h.symbol] || 0
    const value = h.amount * price
    const pnl = (price - h.avgPrice) * h.amount
    const pnlPercent = h.avgPrice
      ? ((price - h.avgPrice) / h.avgPrice) * 100
      : 0
    const allocation = totalValue ? (value / totalValue) * 100 : 0

    return {
      symbol: h.symbol,
      amount: h.amount,
      price,
      value,
      pnl,
      pnlPercent,
      allocation,
    }
  })

  const totalPnL = tableData.reduce((s, x) => s + x.pnl, 0)

  const topHolding = tableData.length
    ? tableData.reduce((a, b) => (a.allocation > b.allocation ? a : b))
    : { symbol: "-", allocation: 0 }

  const diversificationScoreAdvanced = (() => {
    if (!tableData.length) return 0

    const n = tableData.length

    // ideal equal allocation
    const ideal = 100 / n

    // measure deviation from ideal
    const deviation =
      tableData.reduce((sum, asset) => {
        return sum + Math.abs(asset.allocation - ideal)
      }, 0) / n

    // convert to score
    const score = Math.max(0, 100 - deviation)

    return score
  })()

  const chartData = tableData.map((i) => ({
    symbol: i.symbol,
    allocation: i.allocation,
  }))

  if (!Object.keys(prices).length)
    return <div className="p-6 text-gray-400">Loading...</div>

  return (
    <div className="space-y-6 p-2">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Portfolio</h1>
          <p className="text-xs text-gray-400">
            {lastUpdated
              ? `Updated ${lastUpdated.toLocaleTimeString()}`
              : "Fetching prices..."}
          </p>
        </div>

        <Button onClick={() => setOpen(true)}>Edit Holdings</Button>
      </div>
      {/* SUMMARY */}
      <div className="grid grid-cols-3 gap-6 rounded-2xl bg-neutral-900 p-6">
        <div>
          <p className="text-sm text-gray-400">Total Value</p>
          <h2 className="text-3xl font-semibold">
            ${totalValue.toLocaleString()}
          </h2>
        </div>
        <div>
          <p className="text-sm text-gray-400">Total PnL</p>
          <p className={totalPnL >= 0 ? "text-green-400" : "text-red-400"}>
            ${totalPnL.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-400">Top Holding</p>
          <p>{topHolding.symbol}</p>
        </div>
      </div>

      {/* CHART + INSIGHTS */}
      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-2xl bg-neutral-900 p-6">
          <h2 className="mb-4">Allocation</h2>
          <AllocationChart data={chartData} />
        </div>

        <div className="rounded-2xl bg-neutral-900 p-6">
          <h2 className="mb-4 text-lg font-semibold">Insights</h2>

          <div className="space-y-5">
            {/* TOP METRICS */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              {/* Diversification */}
              <div className="rounded-xl bg-white/5 p-3">
                <p className="text-xs text-gray-400">Diversification</p>

                <p className="text-lg font-semibold">
                  {diversificationScoreAdvanced.toFixed(0)}
                  <span className="text-xs text-gray-400"> / 100</span>
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  {tableData.length} assets •{" "}
                  {topHolding.allocation > 50
                    ? "high concentration"
                    : topHolding.allocation > 30
                      ? "moderate concentration"
                      : "well balanced"}
                </p>

                {/* bar */}
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-white"
                    style={{ width: `${diversificationScoreAdvanced}%` }}
                  />
                </div>
              </div>

              {/* Top Holding */}
              <div className="rounded-xl bg-white/5 p-3">
                <p className="text-xs text-gray-400">Top Holding</p>
                <p className="text-lg font-semibold">
                  {topHolding.symbol}
                  <span className="ml-1 text-xs text-gray-400">
                    ({topHolding.allocation.toFixed(1)}%)
                  </span>
                </p>
              </div>
            </div>

            {/* PERFORMANCE */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Best Performer</span>
                <span className="font-medium text-green-400">
                  {tableData.length
                    ? (() => {
                        const best = tableData.reduce((a, b) =>
                          a.pnlPercent > b.pnlPercent ? a : b
                        )
                        return `${best.symbol} (+${best.pnlPercent.toFixed(1)}%)`
                      })()
                    : "-"}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-400">Worst Performer</span>
                <span className="font-medium text-red-400">
                  {tableData.length
                    ? (() => {
                        const worst = tableData.reduce((a, b) =>
                          a.pnlPercent < b.pnlPercent ? a : b
                        )
                        return `${worst.symbol} (${worst.pnlPercent.toFixed(1)}%)`
                      })()
                    : "-"}
                </span>
              </div>
            </div>

            {/* STATUS */}
            <div
              className={`rounded-lg px-3 py-2 text-xs font-medium ${
                totalPnL > 0
                  ? "bg-green-500/10 text-green-400"
                  : "bg-red-500/10 text-red-400"
              }`}
            >
              {totalPnL > 0 ? "Portfolio in Profit" : "Portfolio in Loss"}
            </div>

            {/* SMART MESSAGE */}
            <div className="rounded-xl bg-white/5 p-3 text-xs leading-relaxed text-gray-300">
              {topHolding.allocation > 50
                ? `You are heavily concentrated in ${topHolding.symbol}. Consider diversifying to reduce risk.`
                : diversificationScoreAdvanced > 70
                  ? "Your portfolio is well diversified. Risk is balanced across assets."
                  : "Your portfolio has moderate concentration. Diversifying further can improve stability."}
            </div>
          </div>
        </div>
      </div>
      {/* TABLE */}
      <div className="rounded-2xl bg-neutral-900 p-6">
        <DataTable columns={columns} data={tableData} />
      </div>

      {/* MODAL */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[85vh] max-w-5xl flex-col bg-neutral-950">
          <DialogHeader>
            <DialogTitle>Edit Portfolio</DialogTitle>
          </DialogHeader>

          {/* GLOBAL SEARCH */}
          <div className="relative">
            <input
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Search assets (bitcoin, ethereum...)"
              className="w-full rounded-lg border border-white/10 bg-neutral-900 p-3 text-sm outline-none focus:ring-1 focus:ring-white/20"
            />

            {globalSearch && (
              <div className="absolute z-999 mt-2 max-h-60 w-full overflow-y-auto rounded-xl border border-white/10 bg-neutral-900 shadow-xl">
                {searchCoins(globalSearch)
                  .slice(0, 8)
                  .map(([sym, id]) => (
                    <div
                      key={sym}
                      onClick={() => {
                        setRows((prev) => [
                          {
                            symbol: sym,
                            delta: "",
                            price: (prices[sym] || "").toString(),
                            search: "",
                          },
                          ...prev,
                        ])
                        setGlobalSearch("")
                      }}
                      className="flex cursor-pointer items-center justify-between px-4 py-3 transition hover:bg-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs">
                          {sym[0]}
                        </div>
                        <span className="text-sm capitalize">{id}</span>
                      </div>
                      <span className="text-xs text-gray-400">{sym}</span>
                    </div>
                  ))}

                {searchCoins(globalSearch).length === 0 && (
                  <div className="px-4 py-3 text-sm text-gray-400">
                    No results found
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ROWS */}
          <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
            {rows.map((row, i) => {
              const currentPrice = prices[row.symbol] || 0
              const qty = parseFloat(row.delta || "0")
              const preview = qty * currentPrice

              return (
                <div
                  key={i}
                  className="grid grid-cols-12 items-center gap-2 rounded-xl border border-white/5 bg-neutral-900/70 p-3 transition hover:bg-neutral-900"
                >
                  {/* ASSET */}
                  <div className="col-span-4 flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs">
                      {row.symbol ? row.symbol[0] : "?"}
                    </div>
                    <span className="font-medium">
                      {row.symbol || "Select asset"}
                    </span>
                  </div>

                  {/* QTY */}
                  <input
                    className="col-span-3 rounded bg-neutral-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white/20"
                    value={row.delta}
                    onChange={(e) => updateRow(i, { delta: e.target.value })}
                    placeholder="+2 / -1.5"
                  />

                  {/* PRICE */}
                  <input
                    className="col-span-3 rounded bg-neutral-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white/20"
                    value={row.price}
                    onChange={(e) => updateRow(i, { price: e.target.value })}
                    placeholder="Price"
                  />

                  {/* REMOVE */}
                  <button
                    className="col-span-2 text-right text-sm text-red-400 hover:text-red-300"
                    onClick={() => removeRow(i)}
                  >
                    Remove
                  </button>

                  {/* PREVIEW */}
                  <div className="col-span-12 text-xs text-gray-400">
                    {qty !== 0 && row.symbol && (
                      <>≈ ${preview.toFixed(2)} current value</>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex gap-2">
            <Button onClick={addRow} className="flex-1">
              + Row
            </Button>
            <Button onClick={applyChanges} className="flex-1">
              Apply
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
