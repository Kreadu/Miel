import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://localhost:3000",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
  // Dos proyectos: desktop corre el humo existente; mobile corre el gate responsive
  // (ADR-025) al viewport de referencia de miel-design (360-375px).
  projects: [
    { name: "desktop", testIgnore: /responsive\.spec\.ts/ },
    {
      name: "mobile",
      use: { viewport: { width: 375, height: 812 } },
      testMatch: /responsive\.spec\.ts/,
    },
  ],
});
