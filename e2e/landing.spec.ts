import { expect, test } from "@playwright/test";

// Tests de S10-02 — Landing pública v2. Derivados de los criterios de aceptación
// de specs/S10-02-landing-publica-v2.md. Corren en el proyecto "desktop".
// El criterio 3 (overflow a 375px) lo cubre e2e/responsive.spec.ts — no se duplica.

test.describe("Landing pública v2 (S10-02)", () => {
  test("criterio 1: secciones en orden y propuesta gratuita, sin precios", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: /dulces como la miel/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /todo tu negocio/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /cómo funciona/i }),
    ).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();

    await expect(
      page.getByText(/comienza gratis|totalmente gratis|sin costo/i).first(),
    ).toBeVisible();
    await expect(page.getByText(/precio|plan lite|plan plus/i)).toHaveCount(0);
  });

  test("criterio 2: CTAs navegan a signup y login", async ({ page }) => {
    await page.goto("/");

    await page
      .getByRole("link", { name: /crear cuenta gratis/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/signup/);

    await page.goto("/");
    await page.getByRole("link", { name: /iniciar sesión/i }).first().click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/");
    const footer = page.getByRole("contentinfo");
    await expect(
      footer.getByRole("link", { name: /iniciar sesión/i }),
    ).toBeVisible();
    await expect(
      footer.getByRole("link", { name: /crear cuenta/i }),
    ).toBeVisible();
  });

  test("criterio 4: con reduced-motion todo el contenido es visible de inmediato", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: /dulces como la miel/i }),
    ).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    // Las secciones con reveal no deben quedar ocultas (opacity 0).
    for (const heading of [/todo tu negocio/i, /cómo funciona/i]) {
      const section = page.getByRole("heading", { name: heading });
      await expect(section).toBeVisible();
      const opacity = await section.evaluate(
        (el) => getComputedStyle(el.closest("[data-reveal]") ?? el).opacity,
      );
      expect(Number(opacity)).toBe(1);
    }
  });

  test("criterio 5: title y metadata Open Graph", async ({ page, request }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/Miel.*ERP/i);
    await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
    await expect(page.locator('meta[property="og:description"]')).toHaveCount(1);
    const ogImage = await page
      .locator('meta[property="og:image"]')
      .getAttribute("content");
    expect(ogImage).toBeTruthy();

    const res = await request.get("/opengraph-image");
    expect(res.status()).toBe(200);
  });
});
