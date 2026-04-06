"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { AnimatedNumber } from "@/components/ui/animated-number"

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
    cell: ({ row }) => {
      const value = row.getValue("amount") as number
      return <AnimatedNumber value={value} format={(v) => v.toFixed(4)} />
    },
  },
  {
    accessorKey: "price",
    header: "Price",
    cell: ({ row }) => {
      const value = row.getValue("price") as number
      return (
        <AnimatedNumber
          value={value}
          format={(v) => `$${v.toLocaleString()}`}
        />
      )
    },
  },
  {
    accessorKey: "value",
    header: "Value",
    cell: ({ row }) => {
      const value = row.getValue("value") as number
      return (
        <AnimatedNumber
          value={value}
          format={(v) => `$${v.toLocaleString()}`}
        />
      )
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
          {isProfit ? "+" : "-"}
          <AnimatedNumber
            value={Math.abs(pnl)}
            format={(v) => `$${v.toLocaleString()}`}
          />
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
          <AnimatedNumber
            value={Math.abs(percent)}
            format={(v) => `${v.toFixed(2)}%`}
          />
        </span>
      )
    },
  },
  {
    accessorKey: "allocation",
    header: "Allocation",
    cell: ({ row }) => {
      const value = row.getValue("allocation") as number

      return (
        <AnimatedNumber
          value={value}
          flash={false}
          format={(v) => `${v.toFixed(2)}%`}
        />
      )
    },
  },
]
