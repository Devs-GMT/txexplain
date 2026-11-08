import { expect, test } from "@playwright/test";

const BAD = "0x1234";
const GOOD = `0x${"ab".repeat(32)}`;

test.describe("website", () => {
  test("hero shows the headline and the widget plays", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName("No more staring at hex.");
    await page.locator("#demo").getByRole("tab", { name: "Failed" }).click(); // stops the autoplay so the check is not racing it
    await expect(page.locator("[data-demo-summary]")).toContainText("AuthorCannotVote", { timeout: 15_000 });
    await expect(page.locator("[data-demo-steps] li.is-done")).toHaveCount(4);
  });

  test("tabs switch the example and the hash in the field", async ({ page }) => {
    await page.goto("/");
    await page.locator("#demo").getByRole("tab", { name: "Transfer" }).click();
    await expect(page.locator("[data-demo-summary]")).toContainText("10 USDT", { timeout: 15_000 });
    await expect(page.locator("#demo-input")).toHaveValue(/^0x2cb56449/);
    await page.locator("#demo").getByRole("tab", { name: "Success" }).click();
    await expect(page.locator("[data-demo-summary]")).toContainText("addNote", { timeout: 15_000 });
    await expect(page.locator("#demo").getByRole("tab", { name: "Success" })).toHaveAttribute("aria-selected", "true");
  });

  test("an invalid hash shows a message, a valid one opens the app page", async ({ page }) => {
    await page.goto("/");
    await page.locator("#try-input").fill(BAD);
    await page.getByRole("button", { name: "Show me" }).click();
    await expect(page.locator("#try-error")).toContainText("64 hex characters");
    await page.locator("#try-input").fill(GOOD);
    await page.getByRole("button", { name: "Show me" }).click();
    await expect(page).toHaveURL(new RegExp(`/tx/${GOOD}$`));
  });

  test("no horizontal scroll", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(1500);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(over).toBeLessThanOrEqual(0);
  });

  test("the first screen stays put while it loads", async ({ page }) => {
    await page.addInitScript(() => {
      window.__cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto("/");
    await page.waitForTimeout(6000);
    // Web fonts arrive from a CDN and swap in, which accounts for most of the measured shift (about 0.04 measured on an idle machine; the limit leaves room for a busy one).
    expect(await page.evaluate(() => window.__cls)).toBeLessThan(0.12);
  });

  test("the hex strip resolves to a sentence", async ({ page }) => {
    await page.goto("/");
    await page.locator(".strip").scrollIntoViewIfNeeded();
    await page.locator(".decode").getByRole("tab", { name: "Failed" }).click();
    await expect(page.locator("[data-strip-en]")).toHaveText(/Amount too small/, { timeout: 8000 });
  });

  test("a tooltip opens on focus", async ({ page }) => {
    await page.goto("/");
    const tip = page.getByRole("button", { name: "More on facts first" });
    await tip.scrollIntoViewIfNeeded();
    await tip.focus();
    await expect(page.getByRole("tooltip").first()).toBeVisible();
  });
});

test.describe("new sections", () => {
  const HASH = `0x${"ab".repeat(32)}`;
  test("the live feed lists real transaction fields and links to the explainer", async ({ page }) => {
    await page.route("https://rpc.botchain.ai/**", async (route) => {
      const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type", "content-type": "application/json" };
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
      const body = JSON.parse(route.request().postData());
      const block = (i) => ({ number: "0x64", transactions: i === 0 ? [{ hash: HASH, from: "0x" + "11".repeat(20), to: "0x" + "22".repeat(20), value: "0xde0b6b3a7640000", input: "0x" }, { hash: "0x" + "cd".repeat(32), from: "0x" + "11".repeat(20), to: "0x" + "22".repeat(20), value: "0x0", input: "0xa9059cbb00" }] : [] });
      const result = Array.isArray(body) ? body.map((r, i) => ({ jsonrpc: "2.0", id: r.id, result: block(i) })) : { jsonrpc: "2.0", id: body.id, result: "0x64" };
      return route.fulfill({ headers, body: JSON.stringify(result) });
    });
    await page.goto("/");
    const rows = page.locator(".feed-row");
    await expect(rows).toHaveCount(2, { timeout: 10_000 });
    await expect(rows.first()).toContainText("BOT transfer");
    await expect(rows.first()).toContainText("1 BOT");
    await expect(rows.nth(1)).toContainText("Calls transfer");
    await expect(rows.first().getByRole("link", { name: "Explain" })).toHaveAttribute("href", `/tx/${HASH}`);
    await expect(page.locator("[data-feed-block]")).toHaveText("#100");
    await expect(page.locator("[data-scene]")).toHaveAttribute("data-count", "2");
    await expect(page.locator("[data-legend]")).toContainText("BOT transfers");
    await expect(page.locator("[data-legend]")).toContainText("Token moves");
  });

  test("Docs points to the BOT Chain developer docs", async ({ page, viewport }) => {
    await page.goto("/");
    const docs = page.locator(".nav-links a", { hasText: "Docs" });
    await expect(docs).toHaveAttribute("href", "https://dev-docs.botchain.ai/docs/intro/");
    await expect(docs).toHaveAttribute("target", "_blank");
  });

  test("the chat answers a bad hash and a hash that is not on either chain", async ({ page }) => {
    for (const host of ["rpc.botchain.ai", "rpc.bohr.life"]) {
      await page.route(`https://${host}/**`, async (route) => {
        const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type", "content-type": "application/json" };
        if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
        const body = JSON.parse(route.request().postData());
        const one = (r) => ({ jsonrpc: "2.0", id: r.id, result: r.method === "eth_chainId" ? (host.includes("bohr") ? "0x3c8" : "0x2a5") : null });
        return route.fulfill({ headers, body: JSON.stringify(Array.isArray(body) ? body.map(one) : one(body)) });
      });
    }
    await page.goto("/");
    const input = page.locator("#chat-input");
    await input.scrollIntoViewIfNeeded();
    await input.fill("hello");
    await input.press("Enter");
    await expect(page.locator(".msg--bot").last()).toContainText("isn't a transaction hash");
    await expect(page.locator(".msg--me code").last()).toHaveText("hello");
    await input.fill(`0x${"cd".repeat(32)}`);
    await input.press("Enter");
    await expect(page.locator(".msg--bot").last()).toContainText("Not found on BOT Chain mainnet or testnet", { timeout: 15000 });
    await expect(page.locator("[data-phone]")).toHaveAttribute("data-live", "1");
  });

  test("the chat shows the text it is given, never as markup", async ({ page }) => {
    await page.goto("/");
    const input = page.locator("#chat-input");
    await input.scrollIntoViewIfNeeded();
    await input.fill("<img src=x onerror=window.__pwn=1>");
    await input.press("Enter");
    await expect(page.locator(".msg--me code").last()).toContainText("<img src=x");
    expect(await page.locator("[data-chat] img").count()).toBe(0);
    expect(await page.evaluate(() => window.__pwn)).toBeUndefined();
  });

  test("questions open one at a time", async ({ page }) => {
    await page.goto("/");
    const first = page.locator(".faq details").first();
    const second = page.locator(".faq details").nth(1);
    await first.scrollIntoViewIfNeeded();
    await first.locator("summary").click();
    await expect(first.locator("p")).toBeVisible();
    await second.locator("summary").click();
    await expect(second.locator("p")).toBeVisible();
    await expect(first).not.toHaveAttribute("open", "");
  });

  test("the ribbon names what is read, and headings are readable", async ({ page }) => {
    await page.goto("/");
    expect(await page.locator("[data-ribbon]").getAttribute("aria-label")).toContain("Panic(uint256)");
    await expect(page.getByRole("heading", { name: "Read a real one" })).toBeAttached();
    await expect(page.locator("#faq-h")).toHaveText("Short answers");
  });
});

test.describe("pointer effects", () => {
  test.skip(({ viewport }) => viewport.width < 960, "pointer effects need a fine pointer");

  test("letters of the headline move away from the pointer and come back", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".hero-title .ch").first()).toBeAttached({ timeout: 10_000 });
    const ch = page.locator(".hero-title .ch").nth(8);
    const box = await ch.boundingBox();
    await page.mouse.move(box.x - 60, box.y + box.height / 2);
    await page.mouse.move(box.x + box.width / 2 + 6, box.y + box.height / 2, { steps: 8 });
    await expect.poll(() => ch.evaluate((el) => getComputedStyle(el).transform)).not.toBe("none");
    await page.mouse.move(1100, 700, { steps: 6 });
    await expect.poll(() => ch.evaluate((el) => Math.abs(new DOMMatrix(getComputedStyle(el).transform).m41)), { timeout: 4000 }).toBeLessThan(0.5);
  });

  test("the hex field lights up under the pointer", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(800);
    const lit = () => page.locator(".hero .hexfield").evaluate((c) => {
      const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 150) n++;
      return n;
    });
    const before = await lit();
    await page.mouse.move(300, 300);
    await page.mouse.move(420, 380, { steps: 10 });
    await page.waitForTimeout(300);
    expect(await lit()).toBeGreaterThan(before + 20);
  });

  test("a card leans toward the pointer", async ({ page }) => {
    await page.goto("/");
    const card = page.locator("#trust .card").first();
    await card.scrollIntoViewIfNeeded();
    const b = await card.boundingBox();
    await page.mouse.move(b.x + b.width - 10, b.y + 10, { steps: 6 });
    await expect.poll(() => card.evaluate((el) => getComputedStyle(el).transform)).toMatch(/matrix3d/);
  });

  test("the source lines in How it works are drawn and carry lights", async ({ page }) => {
    await page.goto("/");
    const canvas = page.locator(".pipe-canvas");
    await canvas.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    const lit = () => canvas.evaluate((c) => {
      const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let k = 3; k < d.length; k += 4) if (d[k] > 20) n++;
      return n;
    });
    expect(await lit()).toBeGreaterThan(500);
  });
});

test.describe("the tour", () => {
  test("wide screens switch the view while scrolling; narrow screens stack all five", async ({ page, viewport }) => {
    await page.goto("/");
    if (viewport.width > 960) {
      const track = page.locator("[data-tour]");
      await track.scrollIntoViewIfNeeded();
      const seen = [];
      const start = await track.evaluate((el) => el.getBoundingClientRect().top + scrollY);
      const end = start + (await track.evaluate((el) => el.offsetHeight));
      for (let y = start - 100; y < end; y += 90) {
        await page.evaluate((y) => scrollTo(0, y), y);
        await page.waitForTimeout(200);
        const t = await page.locator(".rail li.is-on strong").first().textContent().catch(() => null);
        if (t && seen.at(-1) !== t) seen.push(t);
      }
      // The page can settle a little while the live feed loads, so a stage may be seen twice; the order of first sightings is what matters.
      expect([...new Set(seen)]).toEqual(["Paste the hash", "Read the call", "Find the reason", "Try the fix", "Leave a note"]);
      await expect(page.locator(".msg.is-shown")).toHaveCount(5);
    } else {
      for (let i = 0; i < 5; i++) await expect(page.locator(".rail li").nth(i)).toBeVisible();
      for (let i = 0; i < 5; i++) await expect(page.locator(".msg").nth(i)).toBeVisible();
    }
  });
});

test.describe("app", () => {
  test("a bad hash is explained, not thrown", async ({ page }) => {
    await page.goto("/app");
    await page.locator("#hash-input").fill(BAD);
    await page.getByRole("button", { name: "Explain" }).click();
    await expect(page.locator("#hash-error")).not.toBeEmpty();
  });
});

test.describe("reduced motion", () => {
  test.use({ colorScheme: "dark", reducedMotion: "reduce" });
  test("everything is there at once", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("[data-demo-summary]")).toContainText("AuthorCannotVote");
    await expect(page.locator("[data-demo-steps] li.is-done")).toHaveCount(4);
    await expect(page.locator(".msg")).toHaveCount(5);
    for (let i = 0; i < 5; i++) await expect(page.locator(".msg").nth(i)).toBeVisible();
  });
});
