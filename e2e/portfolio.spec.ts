import { readFile } from "node:fs/promises"

import { expect, portfolioSeed, seed, test } from "./fixtures"

test("a new visitor records a purchase with a fee", async ({
  page,
  pageErrors,
}) => {
  await page.goto("/portfolio")
  await expect(page.getByText("Your portfolio is empty")).toBeVisible()
  await page.getByRole("button", { name: "Add your first transaction" }).click()

  const dialog = page.getByRole("dialog", { name: "Add a transaction" })
  await dialog.getByPlaceholder("Search by name or symbol").fill("eth")
  await dialog
    .getByRole("option", { name: /Ethereum/ })
    .first()
    .click()

  // Comma decimals are rejected rather than silently misread as 5.
  await dialog.getByLabel(/^Quantity/).fill("0,5")
  await dialog.getByLabel("Price per unit (USD)").fill("3000")
  await dialog.getByRole("button", { name: "Record purchase" }).click()
  await expect(
    dialog.getByText("Enter a number such as 0.5, using a dot for decimals.")
  ).toBeVisible()

  await dialog.getByLabel(/^Quantity/).fill("0.5")
  await dialog.getByLabel(/^Fee \(USD\)/).fill("7.5")
  await expect(dialog.getByText("includes $7.50 fee")).toBeVisible()
  await expect(dialog.getByText("$1,507.50")).toBeVisible()
  await dialog.getByRole("button", { name: "Record purchase" }).click()
  await expect(dialog).toBeHidden()

  const holdings = page.getByRole("table", {
    name: "Current holdings valued at market prices",
  })
  await expect(holdings.getByRole("row", { name: /Ethereum/ })).toBeVisible()
  // 0.5 ETH at the mocked $3,400.
  await expect(holdings.getByRole("row", { name: /Ethereum/ })).toContainText(
    "$1,700.00"
  )

  // Survives a reload: it's persisted locally.
  await page.reload()
  await expect(
    page
      .getByRole("table", { name: "Current holdings valued at market prices" })
      .getByRole("row", { name: /Ethereum/ })
  ).toBeVisible()
  expect(pageErrors).toEqual([])
})

test("CSV export round-trips and re-import skips duplicates", async ({
  page,
}) => {
  await seed(page, portfolioSeed())
  await page.goto("/portfolio")
  await page.getByRole("button", { name: "More portfolio actions" }).click()
  const download = page.waitForEvent("download")
  await page
    .getByRole("menuitem", { name: "Export transactions (CSV)" })
    .click()
  const csv = await readFile(await (await download).path(), "utf8")
  expect(csv.split("\n")[0]).toContain("fee_usd")
  expect(csv).toContain("bitcoin")

  await page.getByRole("button", { name: "More portfolio actions" }).click()
  await page.getByRole("menuitem", { name: /Import transactions/ }).click()
  const dialog = page.getByRole("dialog", { name: "Import transactions" })
  // One genuinely new row, written in the export's own column order.
  const header = csv.trim().split("\n")[0].split(",")
  const row: Record<string, string> = {
    date: new Date().toISOString().slice(0, 10),
    side: "buy",
    asset_id: "solana",
    symbol: "SOL",
    name: "Solana",
    quantity: "2",
    price_usd: "150",
  }
  await dialog
    .getByLabel("…or paste CSV")
    .fill(`${csv.trim()}\n${header.map((h) => row[h] ?? "").join(",")}`)
  await expect(dialog.getByRole("status")).toContainText(
    "1 new · 4 already in your ledger (skipped)"
  )
  await dialog.getByRole("button", { name: "Import 1 transaction" }).click()
  await expect(
    page.getByText(/Imported 1 transaction, skipped 4 duplicates/)
  ).toBeVisible()
})

test("a CSV that sells more than is held is blocked", async ({ page }) => {
  await page.goto("/portfolio")
  await page.getByRole("button", { name: "Import CSV" }).click()
  const dialog = page.getByRole("dialog", { name: "Import transactions" })
  await dialog
    .getByLabel("…or paste CSV")
    .fill(
      "date,side,asset_id,quantity,price_usd\n2025-01-02,buy,bitcoin,1,40000\n2025-02-02,sell,bitcoin,3,50000"
    )
  await expect(dialog.getByText(/Can’t import: sales of/)).toBeVisible()
  await expect(dialog.getByRole("button", { name: /^Import/ })).toBeDisabled()
})

test("performance is rebuilt from dated transactions with honest benchmarks", async ({
  page,
  pageErrors,
}) => {
  await seed(page, portfolioSeed())
  await page.goto("/portfolio?tab=performance")
  await expect(
    page.getByText("Time-weighted return", { exact: true })
  ).toBeVisible()
  await expect(page.getByText("Max drawdown", { exact: true })).toBeVisible()
  // The chart carries a text summary for screen readers, including benchmarks.
  await expect(
    page
      .locator("figure figcaption")
      .filter({ hasText: /^Time-weighted return .*BTC/ })
  ).toHaveCount(1)
  expect(pageErrors).toEqual([])
})
