import { useMemo } from "react"

import { useQuotes } from "@/hooks/queries"
import { usePortfolio } from "@/hooks/use-portfolio"
import { valuePortfolio } from "@/lib/portfolio"

/** The ledger valued at current market prices. */
export function usePortfolioValuation() {
  const portfolio = usePortfolio()
  const quotes = useQuotes(portfolio.heldIds)
  const valuation = useMemo(
    () => valuePortfolio(portfolio.transactions, quotes.quotes),
    [portfolio.transactions, quotes.quotes]
  )
  return {
    ...portfolio,
    ...valuation,
    pricesLoading: quotes.isLoading,
    pricesUpdatedAt: quotes.updatedAt,
  }
}
