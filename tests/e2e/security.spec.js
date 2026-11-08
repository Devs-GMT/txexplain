import { expect, test } from "@playwright/test";

// Runs against the built site served by `vite preview`, which applies the headers from vercel.json.
const BASE = "http://localhost:5181";

test.describe("security headers and policy", () => {
  test("every page carries the hardening headers", async ({ request }) => {
    for (const path of ["/", "/app"]) {
      const res = await request.get(BASE + path);
      const h = res.headers();
      expect(h["content-security-policy"]).toContain("script-src 'self'");
      expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
      expect(h["content-security-policy"]).toContain("object-src 'none'");
      expect(h["strict-transport-security"]).toContain("max-age=");
      expect(h["x-content-type-options"]).toBe("nosniff");
      expect(h["x-frame-options"]).toBe("DENY");
      expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      expect(h["permissions-policy"]).toContain("camera=()");
    }
  });

  for (const path of ["/", "/app"]) {
    test(`${path} renders under the policy with no violations`, async ({ page }) => {
      const violations = [];
      await page.addInitScript(() => {
        window.__csp = [];
        document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
      });
      page.on("console", (m) => /Content Security Policy|Refused to/.test(m.text()) && violations.push(m.text()));
      await page.goto(BASE + path);
      await page.waitForTimeout(4000);
      await expect(page.locator("#site-footer .footer")).toBeVisible();
      if (path === "/") await expect(page.locator("[data-demo-summary]")).not.toBeEmpty();
      expect(await page.evaluate(() => window.__csp)).toEqual([]);
      expect(violations).toEqual([]);
    });
  }
});
