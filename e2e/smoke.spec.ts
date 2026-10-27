import { expect, portfolioSeed, seed, test } from "./fixtures"

const ROUTES: [path: string, heading: RegExp][] = [
  ["/", /Command Center/],
  ["/markets", /Markets/],
  ["/markets/bitcoin", /Bitcoin/],
  ["/screener", /Screener/],
  ["/chart?asset=ethereum", /Ethereum|Chart Studio/],
  ["/compare", /Compare/],
  ["/intelligence", /Market regime|Intelligence/],
  ["/news", /News/],
  ["/portfolio", /Portfolio/],
  ["/risk", /Risk/],
  ["/watchlists", /Watchlists/],
  ["/alerts", /Alerts/],
  ["/research", /Research/],
  ["/journal", /Journal|Theses/],
  ["/status", /Data status/],
  ["/settings", /Settings/],
  ["/no-such-page", /Page not found/],
]

for (const [path, heading] of ROUTES) {
  test(`${path} renders without errors`, async ({ page, pageErrors }) => {
    await seed(page, portfolioSeed())
    await page.goto(path)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading)
    await page.waitForLoadState("networkidle")
    // Nothing on screen should still claim to be loading forever or failing.
    await expect(
      page.getByText(/couldn’t be loaded|unavailable right now/i)
    ).toHaveCount(0)
    expect(pageErrors).toEqual([])
  })
}

test("legacy routes redirect", async ({ page }) => {
  await page.goto("/dashboard")
  await expect(page).toHaveURL(/\/$/)
  await page.goto("/analysis")
  await expect(page).toHaveURL(/\/intelligence$/)
})
