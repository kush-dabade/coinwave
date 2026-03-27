export type Holding = {
  symbol: string
  amount: number
  avgPrice: number
}

export const mockHoldings: Holding[] = [
  { symbol: "BTC", amount: 0.5, avgPrice: 40000 },
  { symbol: "ETH", amount: 2, avgPrice: 2000 },
  { symbol: "SOL", amount: 10, avgPrice: 100 },
]

export const COIN_MAP: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
};

export const calculatePortfolioValue = (
  holdings: Holding[],
  prices: Record<string, number>
): number => {
  return holdings.reduce((total, holding) => {
    const currentPrice = prices[holding.symbol] || 0
    return total + holding.amount * currentPrice
  }, 0)
}

export const calculateHoldingValue = (
  holding: Holding,
  prices: Record<string, number>
): number => {
  const currentPrice = prices[holding.symbol] || 0
  return holding.amount * currentPrice
}

export const calculatePnL = (
  holding: Holding,
  prices: Record<string, number>
): number => {
  const currentPrice = prices[holding.symbol] || 0
  const invested = holding.amount * holding.avgPrice
  const currentValue = holding.amount * currentPrice

  return currentValue - invested
}