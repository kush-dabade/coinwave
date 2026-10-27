import { Link } from "react-router-dom"

import { AssetIcon } from "@/components/data/AssetIcon"
import { Change } from "@/components/data/Change"
import {
  formatMoney,
  formatPercent,
  formatPrice,
  formatQuantity,
  formatShare,
} from "@/lib/format"
import type { Position } from "@/lib/portfolio"
import { cn, toneClass } from "@/lib/utils"

const th =
  "py-2 pl-4 text-xs font-medium whitespace-nowrap text-ink-3 first:pl-0"
const td = "py-3 pl-4 align-top first:pl-0"

export function HoldingsTable({ positions }: { positions: Position[] }) {
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">
        Current holdings valued at market prices
      </caption>
      <thead>
        <tr className="border-b border-rule-strong">
          <th scope="col" className={cn(th, "text-left")}>
            Asset
          </th>
          <th scope="col" className={cn(th, "hidden text-right md:table-cell")}>
            Quantity
          </th>
          <th scope="col" className={cn(th, "hidden text-right lg:table-cell")}>
            Price
          </th>
          <th scope="col" className={cn(th, "hidden text-right sm:table-cell")}>
            24h
          </th>
          <th scope="col" className={cn(th, "text-right")}>
            Value
          </th>
          <th scope="col" className={cn(th, "hidden text-right lg:table-cell")}>
            Avg cost
          </th>
          <th scope="col" className={cn(th, "hidden text-right sm:table-cell")}>
            Unrealised P&amp;L
          </th>
          <th scope="col" className={cn(th, "hidden text-right md:table-cell")}>
            Weight
          </th>
        </tr>
      </thead>
      <tbody>
        {positions.map((p) => (
          <tr key={p.assetId} className="border-b border-rule">
            <td className={td}>
              <div className="flex items-center gap-3">
                <AssetIcon src={p.image} symbol={p.symbol} size={24} />
                <div className="min-w-0">
                  <Link
                    to={`/markets/${p.assetId}`}
                    className="block truncate font-medium text-ink hover:underline"
                  >
                    {p.name}
                  </Link>
                  <span className="num text-xs text-ink-3">
                    <span className="md:hidden">
                      {formatQuantity(p.quantity)}{" "}
                    </span>
                    {p.symbol}
                  </span>
                  {p.oversold && (
                    <p className="mt-1 text-xs text-warn">
                      Sales exceed purchases in your records; check this asset’s
                      transactions.
                    </p>
                  )}
                </div>
              </div>
            </td>
            <td
              className={cn(
                td,
                "num hidden text-right text-ink-2 md:table-cell"
              )}
            >
              {formatQuantity(p.quantity)}
            </td>
            <td
              className={cn(
                td,
                "num hidden text-right text-ink-2 lg:table-cell"
              )}
            >
              {formatPrice(p.price)}
            </td>
            <td className={cn(td, "hidden text-right sm:table-cell")}>
              <Change value={p.change24hPct} />
            </td>
            <td className={cn(td, "text-right")}>
              <span className="num block text-ink">{formatMoney(p.value)}</span>
              {/* Phones: P&L sits under the value instead of in its own column. */}
              <span
                className={cn(
                  "num block text-xs sm:hidden",
                  toneClass(p.unrealizedPnL)
                )}
              >
                {formatMoney(p.unrealizedPnL, { signed: true })}
              </span>
              {p.value === null && (
                <span className="block text-xs text-warn">
                  No current price
                </span>
              )}
            </td>
            <td
              className={cn(
                td,
                "num hidden text-right text-ink-2 lg:table-cell"
              )}
            >
              {formatPrice(p.avgCost)}
            </td>
            <td className={cn(td, "hidden text-right sm:table-cell")}>
              <span className={cn("num block", toneClass(p.unrealizedPnL))}>
                {formatMoney(p.unrealizedPnL, { signed: true })}
              </span>
              <span
                className={cn("num block text-xs", toneClass(p.unrealizedPct))}
              >
                {formatPercent(p.unrealizedPct)}
              </span>
            </td>
            <td
              className={cn(
                td,
                "num hidden text-right text-ink-2 md:table-cell"
              )}
            >
              {formatShare(p.weight)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function ClosedPositions({ positions }: { positions: Position[] }) {
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">Assets you have fully sold</caption>
      <thead>
        <tr className="border-b border-rule-strong">
          <th scope="col" className={cn(th, "text-left")}>
            Asset
          </th>
          <th scope="col" className={cn(th, "text-right")}>
            Realised P&amp;L
          </th>
        </tr>
      </thead>
      <tbody>
        {positions.map((p) => (
          <tr key={p.assetId} className="border-b border-rule">
            <td className="py-2.5">
              <span className="flex items-center gap-2">
                <AssetIcon src={p.image} symbol={p.symbol} size={20} />
                <Link
                  to={`/markets/${p.assetId}`}
                  className="text-ink hover:underline"
                >
                  {p.name}
                </Link>
                <span className="text-xs text-ink-3">{p.symbol}</span>
              </span>
            </td>
            <td
              className={cn("num py-2.5 text-right", toneClass(p.realizedPnL))}
            >
              {formatMoney(p.realizedPnL, { signed: true })}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
