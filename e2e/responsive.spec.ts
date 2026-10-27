import type { Page } from "@playwright/test"

import { expect, portfolioSeed, seed, test } from "./fixtures"

const ROUTES = [
  "/",
  "/markets",
  "/markets/bitcoin",
  "/screener",
  "/chart?asset=bitcoin",
  "/compare",
  "/intelligence",
  "/news",
  "/portfolio",
  "/portfolio?tab=performance",
  "/portfolio?tab=transactions",
  "/risk",
  "/watchlists",
  "/alerts",
  "/research",
  "/journal",
  "/status",
  "/settings",
]

/** Elements wider than the viewport (the page itself must never scroll sideways). */
async function overflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement
    if (doc.scrollWidth <= doc.clientWidth + 1) return []
    // Content inside a scrolling or clipping box can't widen the page.
    const clipped = (el: Element) => {
      for (
        let p = el.parentElement;
        p && p !== document.body;
        p = p.parentElement
      ) {
        if (getComputedStyle(p).overflowX !== "visible") return true
      }
      return false
    }
    const culprits = [...document.querySelectorAll("body *")]
      .filter((el) => {
        const r = el.getBoundingClientRect()
        return (
          r.width > 0 &&
          r.right > doc.clientWidth + 1 &&
          getComputedStyle(el).position !== "fixed" &&
          !clipped(el)
        )
      })
      .slice(0, 5)
      .map(
        (el) =>
          `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`
      )
    return [`scrollWidth ${doc.scrollWidth} > ${doc.clientWidth}`, ...culprits]
  })
}

for (const width of [390, 320]) {
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height: width === 320 ? 700 : 844 } })
    for (const path of ROUTES) {
      test(`${path} has no horizontal page scroll`, async ({
        page,
        pageErrors,
      }) => {
        await seed(page, portfolioSeed())
        await page.goto(path)
        await expect(page.getByRole("heading", { level: 1 })).toBeAttached()
        await page.waitForLoadState("networkidle")
        expect(await overflow(page)).toEqual([])
        expect(pageErrors).toEqual([])
      })
    }
  })
}

test("mobile navigation reaches every workspace", async ({ page }) => {
  await page.goto("/")
  const tabs = page.getByRole("navigation", { name: "Primary" })
  await tabs.getByRole("link", { name: "Markets" }).click()
  await expect(page).toHaveURL(/\/markets$/)
  await tabs.getByRole("button", { name: "More" }).click()
  const sheet = page.getByRole("dialog", { name: "All workspaces" })
  await sheet.getByRole("link", { name: /Journal/ }).click()
  await expect(page).toHaveURL(/\/journal$/)
  await expect(sheet).toBeHidden()
})

test("dialogs fit a phone screen", async ({ page }) => {
  await page.goto("/portfolio")
  await page.getByRole("button", { name: "Add your first transaction" }).click()
  const dialog = page.getByRole("dialog", { name: "Add a transaction" })
  const box = await dialog.boundingBox()
  const viewport = page.viewportSize()!
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1)
  await expect(
    dialog.getByRole("button", { name: "Record purchase" })
  ).toBeInViewport()
})
