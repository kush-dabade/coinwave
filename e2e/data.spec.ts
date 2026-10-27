import { readFile } from "node:fs/promises"

import { expect, portfolioSeed, seed, test } from "./fixtures"
import { MOCK } from "./mock-api"

test("Chart Studio uses genuine Binance candles and says so", async ({
  page,
  pageErrors,
}) => {
  await page.goto("/chart?asset=bitcoin")
  await expect(
    page.getByText(/Binance BTC\/USDT · daily candles · USDT as USD proxy/)
  ).toBeVisible()
  await expect(page.locator("canvas").first()).toBeVisible()

  // An asset with no Binance pair falls back to CoinGecko and says the
  // candles are coarser and have no volume, instead of pretending.
  await page.goto(`/chart?asset=${MOCK.noBinanceAsset}`)
  await expect(
    page.getByText(
      /CoinGecko OHLC · .* candles · no volume \(no Binance pair\)/
    )
  ).toBeVisible()
  await expect(
    page.getByText(/no Binance USDT pair, so candles come from CoinGecko/)
  ).toBeVisible()
  expect(pageErrors).toEqual([])
})

test("compare and risk show statistics only with enough observations", async ({
  page,
  pageErrors,
}) => {
  await page.goto("/compare?ids=bitcoin,ethereum,solana&range=90")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Compare")
  await expect(page.getByText(/Correlation/).first()).toBeVisible()
  await seed(page, portfolioSeed())
  await page.goto("/risk")
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Risk")
  // Scenario outputs are labelled as scenarios, not observations.
  await expect(page.getByText(/scenario/i).first()).toBeVisible()
  expect(pageErrors).toEqual([])
})

test.describe("when CoinGecko is rate limiting", () => {
  test.use({ mockOptions: { rateLimit: ["coingecko"] } })

  test("pages explain the outage instead of showing fake or blank data", async ({
    page,
  }) => {
    await page.goto("/markets")
    await expect(page.getByRole("alert").first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByText(/Market data couldn’t be loaded/)).toBeVisible()
    await page.goto("/status")
    await expect(
      page
        .getByRole("row", { name: /CoinGecko public API/ })
        .getByText(/Rate limited|Failing/)
    ).toBeVisible({ timeout: 20_000 })
  })
})

test.describe("when the news service is down", () => {
  test.use({ mockOptions: { rateLimit: ["news"] } })

  test("news says it is unavailable", async ({ page }) => {
    await page.goto("/news")
    await expect(page.getByText("The news service is unavailable")).toBeVisible(
      { timeout: 20_000 }
    )
  })
})

test("news groups duplicate stories, tags assets and saves to research", async ({
  page,
  pageErrors,
}) => {
  await page.goto("/news")
  const headlines = page.getByRole("region", { name: "Headlines" })
  // Two outlets ran the same Bitcoin ETF story: shown once, with the other credited.
  await expect(
    headlines.getByRole("link", {
      name: /Bitcoin climbs as ETF inflows return/,
    })
  ).toHaveCount(1)
  await expect(headlines.getByText("Also:")).toBeVisible()
  // A failing publisher is reported, not hidden.
  await expect(page.getByText("The Block unavailable")).toBeVisible()
  // “near” in ordinary prose is not tagged as NEAR Protocol.
  const nearStory = headlines
    .getByRole("listitem")
    .filter({ hasText: "Markets near a decision point" })
  await expect(
    nearStory.getByRole("link", { name: "NEAR", exact: true })
  ).toHaveCount(0)
  // …while a story that names the asset is tagged.
  await expect(
    headlines
      .getByRole("listitem")
      .filter({ hasText: "Solana network activity" })
      .getByRole("link", { name: "SOL", exact: true })
  ).toBeVisible()

  await headlines
    .getByRole("button", { name: /Save “Ethereum developers/ })
    .click()
  await expect(page.getByText("Saved to Research")).toBeVisible()
  await page.goto("/research")
  await expect(page.getByRole("list", { name: "Notes" })).toContainText(
    "Ethereum developers set date for next upgrade"
  )
  expect(pageErrors).toEqual([])
})

test("backup export, delete with undo, and import with merge preview", async ({
  page,
  pageErrors,
}) => {
  await seed(page, portfolioSeed())
  await page.goto("/settings")
  const storage = page.getByRole("region", { name: "Your data" })
  await expect(
    storage.getByRole("row", { name: /Portfolio transactions/ })
  ).toContainText("4 transactions")

  const download = page.waitForEvent("download")
  await storage.getByRole("button", { name: "Export backup (JSON)" }).click()
  const file = await (await download).path()
  const backup = JSON.parse(await readFile(file, "utf8"))
  expect(backup.format).toBe("coinwave-backup")
  expect(backup.data.portfolio.transactions).toHaveLength(4)

  // Delete, then undo.
  await storage
    .getByRole("button", { name: "Delete portfolio transactions" })
    .click()
  await page
    .getByRole("dialog", { name: "Delete portfolio transactions?" })
    .getByRole("button", { name: "Delete" })
    .click()
  await expect(
    storage.getByRole("row", { name: /Portfolio transactions/ })
  ).toContainText("0 transactions")
  await page.getByRole("button", { name: "Undo" }).click()
  await expect(
    storage.getByRole("row", { name: /Portfolio transactions/ })
  ).toContainText("4 transactions")

  // Delete again, then restore from the backup file via import.
  await storage
    .getByRole("button", { name: "Delete portfolio transactions" })
    .click()
  await page
    .getByRole("dialog", { name: "Delete portfolio transactions?" })
    .getByRole("button", { name: "Delete" })
    .click()
  await storage.locator('input[type="file"]').setInputFiles(file)
  const preview = page.getByRole("dialog", { name: "Import backup" })
  await expect(
    preview.getByText(/Backup: 4 transactions · Now: 0 transactions/)
  ).toBeVisible()
  await expect(preview.getByText("4 new", { exact: true })).toBeVisible()
  await preview.getByRole("button", { name: "Import selected" }).click()
  await expect(
    storage.getByRole("row", { name: /Portfolio transactions/ })
  ).toContainText("4 transactions")

  // Importing the same file again adds nothing.
  await storage.locator('input[type="file"]').setInputFiles(file)
  await expect(
    page
      .getByRole("dialog", { name: "Import backup" })
      .getByText("4 already here")
  ).toBeVisible()
  expect(pageErrors).toEqual([])
})

test("an invalid backup file is rejected with a reason", async ({ page }) => {
  await page.goto("/settings")
  await page.locator('input[type="file"]').setInputFiles({
    name: "notes.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"hello":"world"}'),
  })
  await expect(page.getByText(/isn’t a CoinWave backup file/)).toBeVisible()
})
