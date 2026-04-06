export interface MarketCoin {
  id: string
  name: string
  symbol: string
  image: string
  current_price: number
  price_change_percentage_24h: number
  market_cap: number
  total_volume: number
  market_cap_rank: number
  circulating_supply: number
  sparkline_in_7d?: {
    price: number[]
  }
}

export interface MarketCoinApi {
  id?: string | null
  name?: string | null
  symbol?: string | null
  image?: string | null
  current_price?: number | null
  price_change_percentage_24h?: number | null
  market_cap?: number | null
  total_volume?: number | null
  market_cap_rank?: number | null
  circulating_supply?: number | null
  sparkline_in_7d?: {
    price?: Array<number | null | undefined> | null
  } | null
}

export interface MarketGlobalData {
  total_market_cap: {
    usd: number
  }
  total_volume: {
    usd: number
  }
  market_cap_percentage: {
    btc: number
  }
  market_cap_change_percentage_24h_usd: number
}

export interface MarketSnapshot {
  coins: MarketCoin[]
  global: MarketGlobalData
  trendingIds: string[]
}

type MarketGlobalDataApi = {
  total_market_cap?: {
    usd?: number | null
  } | null
  total_volume?: {
    usd?: number | null
  } | null
  market_cap_percentage?: {
    btc?: number | null
  } | null
  market_cap_change_percentage_24h_usd?: number | null
}

function numberOrZero(value: number | null | undefined) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : 0
}

function normalizeMarketCoin(rawCoin: MarketCoinApi): MarketCoin {
  const sparklinePrices =
    rawCoin.sparkline_in_7d?.price
      ?.map((value) => {
        const numericValue = Number(value)
        return Number.isFinite(numericValue) ? numericValue : null
      })
      .filter((value): value is number => value !== null) ?? []

  return {
    id: rawCoin.id ?? "",
    name: rawCoin.name ?? "Unknown Coin",
    symbol: rawCoin.symbol ?? "",
    image: rawCoin.image ?? "",
    current_price: numberOrZero(rawCoin.current_price),
    price_change_percentage_24h: numberOrZero(rawCoin.price_change_percentage_24h),
    market_cap: numberOrZero(rawCoin.market_cap),
    total_volume: numberOrZero(rawCoin.total_volume),
    market_cap_rank: numberOrZero(rawCoin.market_cap_rank),
    circulating_supply: numberOrZero(rawCoin.circulating_supply),
    sparkline_in_7d: sparklinePrices.length > 0 ? { price: sparklinePrices } : undefined,
  }
}

function normalizeGlobalData(rawGlobal: MarketGlobalDataApi | undefined): MarketGlobalData {
  return {
    total_market_cap: {
      usd: numberOrZero(rawGlobal?.total_market_cap?.usd),
    },
    total_volume: {
      usd: numberOrZero(rawGlobal?.total_volume?.usd),
    },
    market_cap_percentage: {
      btc: numberOrZero(rawGlobal?.market_cap_percentage?.btc),
    },
    market_cap_change_percentage_24h_usd: numberOrZero(
      rawGlobal?.market_cap_change_percentage_24h_usd
    ),
  }
}

async function fetchTrendingIds(): Promise<string[]> {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/search/trending")
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data.coins)) return []
    return data.coins
      .map((item: { item?: { id?: string } }) => item.item?.id)
      .filter((id: string | undefined): id is string => Boolean(id))
  } catch {
    return []
  }
}

export async function fetchMarketSnapshot(): Promise<MarketSnapshot> {
  const [globalRes, coinsRes, trendingIds] = await Promise.all([
    fetch("https://api.coingecko.com/api/v3/global"),
    fetch(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=120&page=1&sparkline=true&price_change_percentage=24h,7d"
    ),
    fetchTrendingIds(),
  ])

  if (!globalRes.ok || !coinsRes.ok) {
    throw new Error("Failed to fetch market data")
  }

  const globalJson = (await globalRes.json()) as { data?: MarketGlobalDataApi }
  const coinsJson = (await coinsRes.json()) as MarketCoinApi[]

  return {
    global: normalizeGlobalData(globalJson.data),
    coins: Array.isArray(coinsJson) ? coinsJson.map(normalizeMarketCoin) : [],
    trendingIds,
  }
}
