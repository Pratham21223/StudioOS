import { expect, test, type Page } from "@playwright/test";

const PASSWORD = process.env.E2E_PASSWORD ?? "StudioOS-dev-2026!";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@northstar.test";
const CLIENT_EMAIL = process.env.E2E_CLIENT_EMAIL ?? "client@northstar.test";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test("internal workspace smoke: dashboard, content, assets, notifications", async ({ page }) => {
  await login(page, ADMIN_EMAIL);
  await expect(page).toHaveURL(/\/orgs\//);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Good");
  await expect(page.getByText("Content pipeline")).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Workspace" });
  await expect(nav.getByRole("link", { name: "Content", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Assets" })).toBeVisible();
  await expect(nav.getByRole("link", { name: /Notifications/ })).toBeVisible();

  await nav.getByRole("link", { name: "Content", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Content board" })).toBeVisible();
  await expect(page.locator('section[aria-label="Brief"]')).toBeVisible();

  await nav.getByRole("link", { name: "Assets" }).click();
  await expect(page.getByRole("heading", { name: "Asset library" })).toBeVisible();

  await nav.getByRole("link", { name: /Notifications/ }).click();
  await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
});

test("client portal smoke: shared projects and deliverables", async ({ page }) => {
  await login(page, CLIENT_EMAIL);
  await expect(page).toHaveURL(/\/portal/);
  await expect(page.getByText("Client review portal", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome");

  const projectLink = page.locator('a[href^="/portal/projects/"]').first();
  await expect(projectLink).toBeVisible();
  await projectLink.click();
  await expect(page).toHaveURL(/\/portal\/projects\//);

  const deliverableLink = page.locator('a[href^="/portal/content/"]').first();
  await expect(deliverableLink).toBeVisible();
  await deliverableLink.click();
  await expect(page).toHaveURL(/\/portal\/content\//);
  await expect(page.getByText("Your review").or(page.getByText("Decision"))).toBeVisible();
  await expect(page.getByText("Internal feedback", { exact: true })).toHaveCount(0);
});

test("mobile layout does not overflow the page", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, ADMIN_EMAIL);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const metrics = await page.evaluate(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.width);
});
