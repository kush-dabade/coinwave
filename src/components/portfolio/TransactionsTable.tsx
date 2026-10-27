import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"

import { AssetIcon } from "@/components/data/AssetIcon"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  formatDate,
  formatMoney,
  formatPrice,
  formatQuantity,
} from "@/lib/format"
import { sortTransactions, type Transaction } from "@/lib/portfolio"
import { cn } from "@/lib/utils"

const th = "py-2 text-xs font-medium whitespace-nowrap text-ink-3"

export function TransactionsTable({
  transactions,
  onEdit,
  onDelete,
  readOnly,
  meta,
}: {
  transactions: Transaction[]
  /** Current names and logos from market data; older entries may lack them. */
  meta?: Map<string, { name: string; image: string | null }>
  onEdit: (tx: Transaction) => void
  onDelete: (tx: Transaction) => void
  readOnly?: boolean
}) {
  const rows = sortTransactions(transactions).reverse()
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">Transactions, newest first</caption>
      <thead>
        <tr className="border-b border-rule-strong">
          <th scope="col" className={cn(th, "hidden text-left sm:table-cell")}>
            Date
          </th>
          <th scope="col" className={cn(th, "text-left")}>
            Transaction
          </th>
          <th scope="col" className={cn(th, "hidden text-right md:table-cell")}>
            Quantity
          </th>
          <th scope="col" className={cn(th, "hidden text-right md:table-cell")}>
            Price
          </th>
          <th scope="col" className={cn(th, "text-right")}>
            Total
          </th>
          {!readOnly && (
            <th scope="col" className={cn(th, "w-10")}>
              <span className="sr-only">Actions</span>
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((tx) => (
          <tr key={tx.id} className="border-b border-rule">
            <td className="num hidden py-2.5 align-top text-ink-2 sm:table-cell">
              {tx.date ? (
                formatDate(tx.date)
              ) : (
                <span className="font-sans text-ink-3">Date unknown</span>
              )}
            </td>
            <td className="py-2.5 align-top">
              <span className="flex items-start gap-2.5">
                <AssetIcon
                  src={meta?.get(tx.assetId)?.image ?? tx.image}
                  symbol={tx.symbol}
                  size={20}
                  className="mt-0.5"
                />
                <span className="min-w-0">
                  <span className="block text-ink">
                    <span
                      className={cn(
                        "mr-1.5 inline-block rounded-sm px-1.5 py-px text-[10px] font-semibold tracking-wide uppercase",
                        tx.side === "buy"
                          ? "bg-surface-2 text-ink-2"
                          : "bg-ink text-bg"
                      )}
                    >
                      {tx.side}
                    </span>
                    {meta?.get(tx.assetId)?.name ?? tx.name}
                  </span>
                  <span className="num block text-xs text-ink-3 md:hidden">
                    {formatQuantity(tx.quantity)} {tx.symbol} @{" "}
                    {formatPrice(tx.price)}
                  </span>
                  <span className="block text-xs text-ink-3 sm:hidden">
                    {tx.date ? formatDate(tx.date) : "Date unknown"}
                  </span>
                  {tx.note && (
                    <span className="block text-xs text-ink-3">{tx.note}</span>
                  )}
                </span>
              </span>
            </td>
            <td className="num hidden py-2.5 text-right align-top text-ink-2 md:table-cell">
              {formatQuantity(tx.quantity)}{" "}
              <span className="font-sans text-ink-3">{tx.symbol}</span>
            </td>
            <td className="num hidden py-2.5 text-right align-top text-ink-2 md:table-cell">
              {formatPrice(tx.price)}
            </td>
            <td className="num py-2.5 text-right align-top text-ink">
              {formatMoney(tx.quantity * tx.price)}
            </td>
            {!readOnly && (
              <td className="py-1 text-right align-top">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="inline-flex size-9 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink"
                    aria-label={`Actions for ${tx.side} of ${meta?.get(tx.assetId)?.name ?? tx.name}${tx.date ? ` on ${formatDate(tx.date)}` : ""}`}
                  >
                    <MoreHorizontal className="size-4" aria-hidden="true" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onSelect={() => onEdit(tx)}>
                      <Pencil aria-hidden="true" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      tone="danger"
                      onSelect={() => onDelete(tx)}
                    >
                      <Trash2 aria-hidden="true" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
