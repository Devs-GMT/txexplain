import { CHAINS, EXAMPLE_TXS } from "../config.js";
import { footer, hydrateFooter } from "../ui/footer.js";
import { enableCopy } from "../ui/format.js";
import { announcement, initNav, navbar } from "../ui/header.js";
import { html, mount } from "../ui/html.js";
import { initWalletButtons } from "../ui/wallet-button.js";
import { initDemo, initStrip } from "./demo.js";
import { initCursorGlow, initHexField, initMagnet, initTilt } from "./fx.js";
import { initPipe } from "./pipe.js";
import { initChat } from "./chat.js";
import { initFeed } from "./live.js";
import { initHeat, initHero, initProgress, initReveals, initRibbon, initSplit, initTour } from "./motion.js";

const $ = (sel) => document.querySelector(sel);

document.documentElement.classList.add("js");

// The HTML already carries the header and footer; these only fill in when it does not.
if (!$("#site-header").children.length) mount($("#site-header"), html`${announcement}${navbar}`);
if (!$("#site-footer").children.length) mount($("#site-footer"), footer);
initNav();
enableCopy();
initWalletButtons();
hydrateFooter();

const CHIPS = [
  ["A successful transaction", EXAMPLE_TXS.success],
  ["A failed transaction", EXAMPLE_TXS.customError],
  ["A token transfer", EXAMPLE_TXS.transfer],
];
mount($("#try-chips"), html`<span class="muted chips-label">Try an example on testnet</span>${CHIPS.map(([label, hash]) => html`<a class="chip" href="/tx/${hash}">${label}</a>`)}`);

const form = $("#try-form");
const input = $("#try-input");
const error = $("#try-error");
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const hash = input.value.trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    location.href = `/tx/${hash}`;
    return;
  }
  input.setAttribute("aria-invalid", "true");
  error.textContent = "A transaction hash is 0x followed by 64 hex characters.";
  input.focus();
});
input.addEventListener("input", () => {
  input.removeAttribute("aria-invalid");
  error.textContent = "";
});

// Tooltips open on hover and focus through CSS; a tap also toggles them for touch screens.
document.querySelectorAll(".tip").forEach((btn) => {
  btn.addEventListener("click", () => btn.parentElement.classList.toggle("is-tip-open"));
  btn.addEventListener("blur", () => btn.parentElement.classList.remove("is-tip-open"));
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") document.querySelectorAll(".is-tip-open").forEach((el) => el.classList.remove("is-tip-open"));
});

// The latest mainnet block, read straight from the public RPC. If the read fails the line stays hidden.
async function liveBlock() {
  const line = $("[data-live]");
  const out = $("[data-block]");
  try {
    const res = await fetch(CHAINS[677].rpc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }) });
    const n = parseInt((await res.json()).result, 16);
    if (!Number.isFinite(n)) return;
    out.textContent = "#" + n.toLocaleString("en-US");
    line.classList.add("is-on");
  } catch {
    line.classList.remove("is-on");
  }
}
liveBlock();
setInterval(() => { if (!document.hidden) liveBlock(); }, 8000);

initHero();
initHeat();
initDemo();
initStrip();
initTour();
document.querySelectorAll("[data-hexhost]").forEach(initHexField);
initTilt();
initMagnet();
initCursorGlow();
initPipe();
initFeed();
initChat();
initSplit();
initRibbon();
initProgress();
initReveals();
