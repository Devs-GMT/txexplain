import "../styles/tokens.css";
import "../styles/base.css";
import "../styles/components.css";
import "../styles/site.css";
import { EXAMPLE_TXS } from "../config.js";
import { footer, hydrateFooter } from "../ui/footer.js";
import { enableCopy } from "../ui/format.js";
import { announcement, initNav, navbar } from "../ui/header.js";
import { html, mount } from "../ui/html.js";
import { initWalletButtons } from "../ui/wallet-button.js";
import { initDemo, initStrip } from "./demo.js";
import { initHero, initReveals, initStory } from "./motion.js";

const $ = (sel) => document.querySelector(sel);

document.documentElement.classList.add("js");

mount($("#site-header"), html`${announcement}${navbar}`);
mount($("#site-footer"), footer);
initNav();
enableCopy();
initWalletButtons();
hydrateFooter();

const CHIPS = [
  ["A successful transaction", EXAMPLE_TXS.success],
  ["A failed transaction", EXAMPLE_TXS.customError],
  ["Ran out of gas", EXAMPLE_TXS.outOfGas],
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

initHero();
initDemo();
initStrip();
initStory();
initReveals();
