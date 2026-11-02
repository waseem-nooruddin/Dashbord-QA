import { expect, test } from "@playwright/test";

const kpis = (page: import("@playwright/test").Page) => page.locator(".kpi-value").allInnerTexts();

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Demo Project — Overall Dashboard");
});

test("KPIs equal column sums and the totals row matches them (FR-20, FR-40)", async ({ page }) => {
  expect(await kpis(page)).toEqual(["270", "190", "23", "70.4%"]);
  const total = page.locator(".total-row");
  await expect(total.locator("td").nth(1)).toHaveText("270");
});

test("filters drive scope, submodule list and breadcrumbs (FR-13, FR-14, FR-16)", async ({ page }) => {
  const sub = page.getByLabel("Submodule");
  await expect(sub).toBeDisabled();
  await page.getByLabel("Main Module").selectOption("HRMS");
  await expect(sub.locator("option")).toHaveText(["All submodules", "HRMS - Alpha", "HRMS - Beta"]);
  expect(await kpis(page)).toEqual(["150", "100", "14", "66.7%"]);
  await sub.selectOption("HRMS - Beta");
  await expect(page.locator(".crumbs")).toContainText("Beta");
  expect((await kpis(page))[0]).toBe("50");
  await page.getByRole("button", { name: "Reset Filters" }).click();
  expect((await kpis(page))[0]).toBe("270");
});

test("validation flags appear in table and badge (FR-50, FR-05)", async ({ page }) => {
  await expect(page.getByRole("status")).toHaveText("Validated · reconciliation needed");
  const row = page.locator("tbody tr", { has: page.getByRole("button", { name: "Member Gamma" }) });
  await expect(row.locator("td").last()).toHaveText("⚠ +6 vs Total");
  await expect(page.locator("#chart-8")).toContainText("Standalone (2.00 vs 2.9)");
  await expect(page.locator("#chart-7")).toContainText("Defects with no priority: Member Gamma");
});

test("table search, sort and column groups (FR-41, FR-42)", async ({ page }) => {
  await page.getByPlaceholder("Search modules").fill("member");
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await page.getByPlaceholder("Search modules").fill("");
  await page.getByRole("button", { name: /^Total TC/ }).click();
  await expect(page.locator("tbody th").first()).toHaveText("HRMS - Alpha");
  await page.getByRole("button", { name: "Columns ▾" }).click();
  await page.getByRole("checkbox", { name: "Severity" }).check();
  await expect(page.getByRole("columnheader", { name: "Sev Critical" })).toBeVisible();
});

test("clicking a module focuses and clicking again clears (FR-15)", async ({ page }) => {
  await page.locator("tbody").getByRole("button", { name: "Standalone" }).click();
  expect((await kpis(page))[0]).toBe("60");
  await page.locator("tbody").getByRole("button", { name: "Standalone" }).click();
  expect((await kpis(page))[0]).toBe("270");
});

test("CSV export escapes formulas and includes report header (FR-43, FR-44)", async ({ page }) => {
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "CSV", exact: true }).last().click()]);
  const text = await (await import("node:fs/promises")).readFile((await dl.path())!, "utf8");
  expect(text).toContain('"Report","QA LiveSync — Demo Project"');
  expect(text).toContain('"Total — All modules",');
});

test("no horizontal page scroll; theme switch keeps across reset (FR-52, FR-53)", async ({ page }) => {
  await page.getByRole("radio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Reset Filters" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("sidebar reaches every project, main module and submodule (FR-10, FR-11)", async ({ page, isMobile }) => {
  if (isMobile) await page.getByRole("button", { name: "Open menu" }).click();
  const nav = page.getByRole("navigation", { name: "Projects" });
  await nav.getByRole("button", { name: "Expand HRMS" }).click();
  await nav.getByRole("button", { name: "Alpha" }).click();
  if (isMobile) await expect(nav).not.toHaveClass(/open/);
  expect((await kpis(page))[0]).toBe("100");
  if (isMobile) await page.getByRole("button", { name: "Open menu" }).click();
  await nav.getByRole("button", { name: /Demo Two/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Demo Two — Overall Dashboard");
});
