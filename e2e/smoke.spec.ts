import { expect, test } from "@playwright/test";

// Placeholder de humo del Sprint 0: la home responde.
// Los flujos reales (login → producto → movimiento) se añaden en S6-01.
test("la home carga", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/.+/);
});
