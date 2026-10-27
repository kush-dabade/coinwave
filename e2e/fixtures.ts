import { test as base, expect, type Page } from "@playwright/test"

import { installMockApi, type MockOptions } from "./mock-api"

type Fixtures = {
  mockOptions: MockOptions
  /** Uncaught errors and console errors seen during the test. */
  pageErrors: string[]
}

// Playwright calls the second fixture argument "use"; it is named "provide"
// here so it isn't mistaken for a React hook.
export const test = base.extend<Fixtures>({
  mockOptions: [{}, { option: true }],
  pageErrors: async ({ page, mockOptions }, provide) => {
    const errors: string[] = []
    const simulatingOutage = (mockOptions.rateLimit ?? []).length > 0
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`))
    page.on("console", (m) => {
      // The browser logs every failed request; those are checked below.
      if (m.type() === "error" && !/Failed to load resource/.test(m.text()))
        errors.push(m.text())
    })
    page.on("response", (r) => {
      // Outside outage tests, any HTTP error means CoinWave asked for
      // something that doesn't exist (or the mock is missing an endpoint).
      if (!simulatingOutage && r.status() >= 400)
        errors.push(`HTTP ${r.status()} ${r.url()}`)
    })
    await provide(errors)
  },
  context: async ({ context, mockOptions }, provide) => {
    await installMockApi(context, mockOptions)
    await provide(context)
  },
})

export { expect }

/** Seed localStorage before the app boots (runs once per test). */
export async function seed(page: Page, entries: Record<string, unknown>) {
  await page.addInitScript((data) => {
    if (sessionStorage.getItem("__e2e_seeded")) return
    sessionStorage.setItem("__e2e_seeded", "1")
    for (const [k, v] of Object.entries(data))
      localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v))
  }, entries)
}

export const portfolioSeed = (now = Date.now()) => ({
  "coinwave:portfolio:v2": {
    version: 2,
    sample: false,
    transactions: [
      {
        id: "t1",
        assetId: "bitcoin",
        symbol: "BTC",
        name: "Bitcoin",
        image: null,
        side: "buy",
        quantity: 0.5,
        price: 52_000,
        fee: 12,
        date: isoDaysAgo(200),
        createdAt: now,
      },
      {
        id: "t2",
        assetId: "ethereum",
        symbol: "ETH",
        name: "Ethereum",
        image: null,
        side: "buy",
        quantity: 4,
        price: 2_900,
        date: isoDaysAgo(150),
        createdAt: now + 1,
      },
      {
        id: "t3",
        assetId: "solana",
        symbol: "SOL",
        name: "Solana",
        image: null,
        side: "buy",
        quantity: 30,
        price: 120,
        date: isoDaysAgo(90),
        createdAt: now + 2,
      },
      {
        id: "t4",
        assetId: "ethereum",
        symbol: "ETH",
        name: "Ethereum",
        image: null,
        side: "sell",
        quantity: 1,
        price: 3_300,
        fee: 4,
        date: isoDaysAgo(30),
        createdAt: now + 3,
      },
    ],
  },
})

export function isoDaysAgo(days: number) {
  const d = new Date(Date.now() - days * 86_400_000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
