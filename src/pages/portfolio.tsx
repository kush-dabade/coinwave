import { useEffect, useState } from "react"

import {
  mockHoldings,
  calculatePortfolioValue,
  COIN_MAP,
} from "@/lib/portfolio"

import { columns } from "@/components/portfolio/columns"
import { DataTable } from "@/components/ui/data-table"

export default function PortfolioPage() {
  // ✅ State for live prices
  const [prices, setPrices] = useState<Record<string, number>>({})

  // ✅ Fetch prices from CoinGecko
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const ids = Object.values(COIN_MAP).join(",")

        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`
        )

        const data = await res.json()

        const formattedPrices: Record<string, number> = {}

        Object.entries(COIN_MAP).forEach(([symbol, id]) => {
          formattedPrices[symbol] = data[id]?.usd || 0
        })

        setPrices(formattedPrices)
      } catch (err) {
        console.error("Error fetching prices:", err)
      }
    }

    fetchPrices()
  }, [])

  // ✅ Transform data
  // ✅ Total value FIRST
  const totalValue = calculatePortfolioValue(mockHoldings, prices)

  // ✅ THEN table data
  const tableData = mockHoldings.map((holding) => {
    const price = prices[holding.symbol] || 0
    const value = holding.amount * price

    const pnl = (price - holding.avgPrice) * holding.amount

    const pnlPercent =
      holding.avgPrice === 0
        ? 0
        : ((price - holding.avgPrice) / holding.avgPrice) * 100

    const allocation = totalValue === 0 ? 0 : (value / totalValue) * 100

    return {
      symbol: holding.symbol,
      amount: holding.amount,
      price,
      value,
      pnl,
      pnlPercent,
      allocation,
    }
  })

  if (Object.keys(prices).length === 0) {
    return <div className="p-6 text-gray-400">Loading portfolio...</div>
  }

  return (
    <div className="p-2">
      {/* Page Title */}
      <h1 className="mb-4 text-2xl font-semibold">Portfolio</h1>

      {/* Portfolio Summary */}
      <div className="rounded-2xl bg-neutral-900 p-6 shadow">
        <p className="text-sm text-gray-400">Total Value</p>
        <h2 className="mt-2 text-3xl font-bold">
          ${totalValue.toLocaleString()}
        </h2>
      </div>

      {/* Holdings Table */}
      <div className="mt-6 rounded-2xl bg-neutral-900 p-6">
        <h2 className="mb-4 text-lg font-semibold">Your Holdings</h2>

        <DataTable columns={columns} data={tableData} />
      </div>
    </div>
  )
}
