import { expect, test } from "./fixtures"
import { MOCK } from "./mock-api"

test("command palette finds local assets, remote assets and pages", async ({
  page,
  pageErrors,
}) => {
  await page.goto("/")
  await page.keyboard.press("/")
  const palette = page.getByRole("dialog", { name: "Search CoinWave" })
  await expect(palette).toBeVisible()
  await palette.getByRole("combobox").fill("sol")
  await expect(
    palette.getByRole("option", { name: /Solana/ }).first()
  ).toBeVisible()
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/\/markets\/solana$/)
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Solana")

  // Outside the top-250 universe: found through CoinGecko search.
  await page.keyboard.press("Control+k")
  await palette.getByRole("combobox").fill("obscure")
  await expect(
    palette.getByRole("option", { name: new RegExp(MOCK.remoteOnly.name) })
  ).toBeVisible()

  await palette.getByRole("combobox").fill("risk")
  await page.getByRole("option", { name: /Risk/ }).first().click()
  await expect(page).toHaveURL(/\/risk/)
  expect(pageErrors).toEqual([])
})

test("g-shortcuts navigate but never fire while typing", async ({ page }) => {
  await page.goto("/research")
  await page.keyboard.press("g")
  await page.keyboard.press("m")
  await expect(page).toHaveURL(/\/markets$/)

  // Typing "gm" into a search field must stay in the field, and fast typing
  // into a URL-backed filter must not drop characters.
  const search = page.getByRole("searchbox", {
    name: "Filter assets by name or symbol",
  })
  await search.click()
  await page.keyboard.type("gm")
  await expect(search).toHaveValue("gm")
  await expect(page).toHaveURL(/\/markets\?q=gm$/)
  await search.fill("")
  await page.keyboard.type("solana", { delay: 0 })
  await expect(search).toHaveValue("solana")
  await expect(page).toHaveURL(/q=solana$/)
  await expect(
    page
      .getByRole("table")
      .getByRole("link", { name: /Solana/ })
      .first()
  ).toBeVisible()

  // Back/forward brings the URL's query back into the field.
  await page.goBack()
  await expect(page).toHaveURL(/\/research$/)
  await page.goForward()
  await expect(
    page.getByRole("searchbox", { name: "Filter assets by name or symbol" })
  ).toHaveValue("solana")

  await page.locator("body").click({ position: { x: 5, y: 300 } })
  await page.keyboard.press("?")
  await expect(
    page.getByRole("dialog", { name: "Keyboard shortcuts" })
  ).toBeVisible()
})

test("screener presets, URL state and saved screens", async ({
  page,
  pageErrors,
}) => {
  await page.goto("/screener")
  await page
    .getByRole("group", { name: "Preset screens" })
    .getByRole("button", { name: "Strongest large caps (7d)" })
    .click()
  await expect(page).toHaveURL(/f=marketCap\.gt\.10000000000/)
  const results = page.getByRole("table", { name: "Screen results" })
  await expect(results.getByRole("row")).not.toHaveCount(1)

  // Every result satisfies the condition: market cap above $10B.
  const count = await results.locator("tbody tr").count()
  expect(count).toBeGreaterThan(0)
  expect(count).toBeLessThan(40)

  // State survives a reload because it lives in the URL.
  const url = page.url()
  await page.reload()
  await expect(page).toHaveURL(url)
  await expect(results.locator("tbody tr")).toHaveCount(count)

  await page.getByRole("button", { name: "Save screen" }).click()
  const dialog = page.getByRole("dialog", { name: "Save screen" })
  await dialog.getByLabel("Name").fill("Mega caps momentum")
  await dialog.getByRole("button", { name: "Save" }).click()

  // Saved screens are searchable from anywhere.
  await page.goto("/")
  await page.keyboard.press("Control+k")
  await page.getByRole("combobox").fill("mega caps")
  await page.getByRole("option", { name: /Mega caps momentum/ }).click()
  await expect(page).toHaveURL(/\/screener\?.*f=marketCap\.gt\.10000000000/)
  expect(pageErrors).toEqual([])
})
