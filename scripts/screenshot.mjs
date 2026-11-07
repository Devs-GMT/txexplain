// Dev tool: node scripts/screenshot.mjs <url> <out.png> [width] [height] [waitSelector] [fullPage]
// Prints console errors and failed requests so a broken page is not mistaken for a finished one.
import puppeteer from "puppeteer-core";

const [url, out, w = "1280", h = "800", waitFor, full] = process.argv.slice(2);
const chrome = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: Number(w), height: Number(h) });
const problems = [];
page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
page.on("requestfailed", (r) => problems.push(`requestfailed: ${r.url().slice(0, 90)}`));
await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
if (waitFor) await page.waitForSelector(waitFor, { timeout: 45000 }).catch(() => problems.push(`never appeared: ${waitFor}`));
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: out, fullPage: full === "full" });
console.log(problems.length ? problems.join("\n") : "no console errors");
await browser.close();
