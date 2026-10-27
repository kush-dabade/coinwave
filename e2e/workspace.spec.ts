import { expect, test } from "./fixtures"

test("create a watchlist from the markets table and annotate it", async ({
  page,
  pageErrors,
}) => {
  await page.goto("/markets")
  await page.getByRole("button", { name: "Add Solana to a watchlist" }).click()
  await page.getByRole("menuitem", { name: "New list with Solana…" }).click()
  const dialog = page.getByRole("dialog", { name: "New watchlist" })
  await dialog.getByLabel("Name").fill("Layer 1s")
  await dialog.getByRole("button", { name: "Create" }).click()
  await expect(page.getByText("Solana added to Layer 1s")).toBeVisible()
  await expect(
    page.getByRole("button", { name: /Solana is on 1 watchlist/ })
  ).toBeVisible()

  await page.goto("/watchlists")
  const listButton = page.getByRole("button", { name: /^Layer 1s \d+$/ })
  await listButton.click()
  const note = page.getByRole("textbox", { name: "Note for Solana" })
  await note.fill("Watching fee revenue")
  await note.blur()
  await page.reload()
  await listButton.click()
  await expect(
    page.getByRole("textbox", { name: "Note for Solana" })
  ).toHaveValue("Watching fee revenue")
  expect(pageErrors).toEqual([])
})

test("an alert whose condition is already true triggers on the next refresh", async ({
  page,
}) => {
  await page.clock.install()
  await page.goto("/alerts?new=bitcoin")
  const dialog = page.getByRole("dialog", { name: "New alert" })
  await expect(dialog.getByLabel("Condition")).toHaveValue("price_above")
  await dialog.getByLabel(/^Threshold/).fill("60000")
  await expect(dialog.getByText(/already true/)).toBeVisible()
  await dialog.getByRole("button", { name: "Create alert" }).click()
  await expect(dialog).toBeHidden()
  await expect(
    page.getByRole("table", { name: "Alerts" }).getByText(/Bitcoin.*60,000/)
  ).toBeVisible()

  // Data already on screen predates the alert, so nothing fires until fresh
  // data arrives (default refresh: 2 minutes).
  await expect(page.getByText("Triggered", { exact: true })).toHaveCount(0)
  await page.clock.fastForward("02:30")
  await expect(
    page.getByRole("link", { name: "Alerts: 1 triggered" })
  ).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole("tab", { name: "Triggered (1)" })).toBeVisible()
})

test("research note with markdown, tags and search", async ({
  page,
  pageErrors,
}) => {
  await page.goto("/research")
  await page.getByRole("button", { name: "New note" }).first().click()
  await page.getByLabel("Title").fill("ETH staking yield")
  await page
    .getByLabel("Note", { exact: true })
    .fill(
      "Yield is **real** when fees exceed issuance.\n\n| Source | Yield |\n| --- | --- |\n| Fees | 1.2% |"
    )
  await page.getByRole("textbox", { name: "Add tag" }).fill("staking")
  await page.keyboard.press("Enter")
  await page.getByRole("button", { name: "Preview" }).click()
  const editor = page.getByRole("article", { name: "Note editor" })
  await expect(editor.locator("strong", { hasText: "real" })).toBeVisible()
  await expect(editor.getByRole("table")).toContainText("1.2%")
  // Markdown never becomes raw HTML.
  expect(await editor.locator("script").count()).toBe(0)

  // On desktop the list sits beside the editor.
  await page.getByRole("searchbox", { name: "Search research" }).fill("staking")
  await expect(page.getByRole("list", { name: "Notes" })).toContainText(
    "ETH staking yield"
  )
  expect(pageErrors).toEqual([])
})

test("a thesis records a decision with the price at the time", async ({
  page,
  pageErrors,
}) => {
  await page.goto("/journal")
  await page.getByRole("button", { name: "New thesis" }).first().click()
  await expect(page).toHaveURL(/\/journal\/.+/)
  const title = page.getByLabel("Thesis title")
  await title.fill("Ethereum fee capture recovers")
  await title.blur()
  await page
    .getByRole("textbox", { name: "Add to assumptions" })
    .fill("L2 fees flow back to L1")
  await page.getByRole("button", { name: "Add", exact: true }).first().click()
  await expect(page.getByText("L2 fees flow back to L1")).toBeVisible()

  await page.getByRole("button", { name: "Asset", exact: true }).click()
  await page.getByPlaceholder("Search by name or symbol").fill("ethereum")
  await page
    .getByRole("option", { name: /Ethereum/ })
    .first()
    .click()

  await page.getByRole("button", { name: "Decision", exact: true }).click()
  await page.getByLabel("Decision", { exact: true }).selectOption("buy")
  await page.getByLabel("Asset", { exact: true }).selectOption("ethereum")
  await expect(
    page.getByText(/Records ETH’s current price \(\$3,400\.00\)/)
  ).toBeVisible()
  await page
    .getByRole("textbox", { name: "Entry" })
    .fill("Starter position after the upgrade date was set")
  await page.getByRole("button", { name: "Add entry" }).click()
  await expect(
    page.getByText("Starter position after the upgrade date was set")
  ).toBeVisible()

  await page.goto("/journal")
  await expect(page.getByText("Ethereum fee capture recovers")).toBeVisible()
  expect(pageErrors).toEqual([])
})
