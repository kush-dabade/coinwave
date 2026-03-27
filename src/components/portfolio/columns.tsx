"use client"

import type { ColumnDef } from "@tanstack/react-table"

export type HoldingRow = {
  symbol: string
  amount: number
  price: number
  value: number
  pnl: number
  pnlPercent: number
  allocation: number
}

export const columns: ColumnDef<HoldingRow>[] = [
  {
    accessorKey: "symbol",
    header: "Coin",
  },
  {
    accessorKey: "amount",
    header: "Amount",
  },
  {
    accessorKey: "price",
    header: "Price",
    cell: ({ row }) => {
      const value = row.getValue("price") as number
      return `$${value.toLocaleString()}`
    },
  },
  {
    accessorKey: "value",
    header: "Value",
    cell: ({ row }) => {
      const value = row.getValue("value") as number
      return `$${value.toLocaleString()}`
    },
  },
  {
    accessorKey: "pnl",
    header: "P&L",
    cell: ({ row }) => {
      const pnl = row.getValue("pnl") as number

      const isProfit = pnl >= 0

      return (
        <span className={isProfit ? "text-green-500" : "text-red-500"}>
          {isProfit ? "+" : "-"}${Math.abs(pnl).toLocaleString()}
        </span>
      )
    },
  },
  {
    accessorKey: "pnlPercent",
    header: "% P&L",
    cell: ({ row }) => {
      const percent = row.getValue("pnlPercent") as number
      const isProfit = percent >= 0

      return (
        <span className={isProfit ? "text-green-500" : "text-red-500"}>
          {isProfit ? "+" : "-"}
          {Math.abs(percent).toFixed(2)}%
        </span>
      )
    },
  },
  {
    accessorKey: "allocation",
    header: "Allocation",
    cell: ({ row }) => {
      const value = row.getValue("allocation") as number

      return <span>{value.toFixed(2)}%</span>
    },
  },
]
