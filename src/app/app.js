import "../styles/tokens.css";
import "../styles/base.css";
import "../styles/components.css";
import "../styles/app.css";
import Prism from "prismjs";
import "prismjs/components/prism-json.js";
import { CHAINS, EXAMPLE_TXS } from "../config.js";
import { parseUserAbi } from "../lib/abis.js";
import { sigLookup, summarize } from "../lib/api.js";
import { explainTx, isTxHash } from "../lib/explain.js";
import { templateSummary } from "../lib/template-summary.js";
import { PANIC } from "../lib/revert.js";
import { enableCopy, shortHash } from "../ui/format.js";
import { footer, hydrateFooter } from "../ui/footer.js";
import { announcement, initNav, navbar } from "../ui/header.js";
import { html, mount } from "../ui/html.js";
import { typeInto } from "../ui/type.js";
import { initWalletButtons } from "../ui/wallet-button.js";
import { calledSection, eventsSection, failureSection, gasSection, moneySection, statusCard, timelineSection } from "./sections.js";
import { initNotes, notesShell } from "./notes-ui.js";

const $ = (sel) => document.querySelector(sel);
const stage = $("#stage");
const input = $("#hash-input");
const errorEl = $("#hash-error");
const RECENT_KEY = "txexplain:recent";

const state = { userAbi: null, runId: 0, pollTimer: null, polls: 0, stopNotes: null, currentHash: null };

const STEPS = [["fetching", "Fetching"], ["decoding", "Decoding"], ["events", "Reading events"], ["summary", "Writing summary"]];
const EXAMPLES = [
  ["A successful transaction", EXAMPLE_TXS.success],
  ["A failed transaction", EXAMPLE_TXS.customError],
  ["A token transfer", EXAMPLE_TXS.transfer],
];
const exampleSet = new Set(Object.values(EXAMPLE_TXS).map((h) => h.toLowerCase()));

// ---- shell ---------------------------------------------------------------------------------

mount($("#site-header"), html`${announcement}${navbar}`);
mount($("#site-footer"), footer);
initNav();
enableCopy();
initWalletButtons();
hydrateFooter();

mount($("#example-chips"), html`<span class="muted chips-label">Try an example on testnet</span>${EXAMPLES.map(([label, hash]) => html`<button type="button" class="chip" data-hash="${hash}">${label}</button>`)}`);

// ---- recent hashes -------------------------------------------------------------------------

function recent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY)) ?? [];
  } catch {
    return [];
  }
}

function remember(hash, chainId) {
  if (exampleSet.has(hash.toLowerCase())) return;
  try {
    const list = [{ hash, chainId }, ...recent().filter((r) => r.hash !== hash)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // history is a convenience; a blocked store just means no history
  }
}

// ---- views ---------------------------------------------------------------------------------

function idleView() {
  const list = recent();
  return html`<div class="idle">
    ${list.length ? html`<section aria-labelledby="recent-h"><h2 class="sect-h" id="recent-h">Recent</h2><ul class="recent">${list.map((r) => html`<li><button type="button" class="chip chip--mono" data-hash="${r.hash}">${shortHash(r.hash)}<span class="muted"> ${CHAINS[r.chainId]?.name.replace("BOT Chain ", "") ?? ""}</span></button></li>`)}</ul></section>` : ""}
    <section id="errors" aria-labelledby="errors-h">
      <h2 class="sect-h" id="errors-h">Common errors</h2>
      <p class="muted">What the codes in a failed transaction usually mean.</p>
      <table class="table"><thead><tr><th scope="col">You see</th><th scope="col">It usually means</th></tr></thead><tbody>
        ${Object.entries(PANIC).map(([code, text]) => html`<tr><td class="mono">Panic ${code}</td><td>${text[0].toUpperCase() + text.slice(1)}</td></tr>`)}
        <tr><td>Gas used equals the gas limit</td><td>It ran out of gas. Raise the limit and send it again.</td></tr>
        <tr><td>Reverted without a reason</td><td>A check failed in a contract that gives no message. Compare your inputs with its ABI.</td></tr>
        <tr><td>Insufficient funds</td><td>The wallet holds less BOT than the value plus the gas cost.</td></tr>
        <tr><td>Nonce too low</td><td>The wallet's count of sent transactions is out of sync. Reset the account in MetaMask.</td></tr>
      </tbody></table>
    </section>
  </div>`;
}

function loadingView() {
  return html`<section class="card steps" aria-label="Progress"><ol>${STEPS.map(([key, label]) => html`<li data-step="${key}"><span class="step-mark" aria-hidden="true"></span>${label}</li>`)}</ol></section>`;
}

function setStep(name) {
  const idx = STEPS.findIndex(([k]) => k === name);
  stage.querySelectorAll("[data-step]").forEach((li, i) => {
    li.classList.toggle("is-done", i < idx);
    li.classList.toggle("is-current", i === idx);
  });
}

function messageView(kind, title, body, retry) {
  return html`<section class="card card--${kind} message" role="alert"><h2 class="card-title">${title}</h2><p>${body}</p>${retry ? html`<button type="button" class="btn btn--quiet btn--sm" data-retry>Try again</button>` : ""}</section>`;
}

const SOURCE_LABEL = { ai: "AI summary from decoded data", template: "Written from decoded data" };

function resultView(facts, summary) {
  const kind = facts.status === "success" ? "ok" : facts.status === "failed" ? "fail" : "wait";
  const isExample = exampleSet.has(facts.hash.toLowerCase());
  const shareUrl = `${location.origin}/tx/${facts.hash}`;
  return html`
    <div class="view-toggle" role="group" aria-label="View">
      <button type="button" class="seg-btn" aria-pressed="true" data-view-btn="explained">Explained</button>
      <button type="button" class="seg-btn" aria-pressed="false" data-view-btn="raw">Raw</button>
    </div>
    <div class="result" data-view="explained">
      <div class="result-main">
        ${facts.status === "failed" ? failureSection(facts, summary.fixes) : ""}
        <section class="card card--${kind} summary" aria-labelledby="sum-h">
          <div class="summary-head"><h2 class="card-title" id="sum-h">Summary</h2><span class="tag">${SOURCE_LABEL[summary.source]}</span></div>
          <p class="summary-text"><span class="visually-hidden">${summary.summary}</span><span class="summary-ghost" aria-hidden="true">${summary.summary}</span><span class="summary-typed" aria-hidden="true" data-typed></span></p>
        </section>
        <details class="sect" open><summary><h2>What was called</h2></summary>${calledSection(facts)}</details>
        <details class="sect" open><summary><h2>Money moved</h2></summary>${moneySection(facts)}</details>
        <details class="sect" open data-events><summary><h2>Events</h2></summary>${eventsSection(facts)}</details>
      </div>
      <aside class="result-aside" aria-label="Details">
        ${statusCard(facts, isExample)}
        ${facts.status === "pending" ? "" : html`<section class="card" aria-labelledby="gas-h"><h2 class="card-title" id="gas-h">Gas and cost</h2>${gasSection(facts)}</section>`}
        <section class="card" aria-labelledby="tl-h"><h2 class="card-title" id="tl-h">Timeline</h2>${timelineSection(facts)}</section>
        ${notesShell}
        <section class="card share" aria-label="Share">
          <button type="button" class="btn btn--quiet btn--sm" data-share="${shareUrl}">Share this explanation</button>
          <p class="muted">Anyone can open the link. No wallet needed.</p>
        </section>
      </aside>
    </div>
    <section class="raw" data-view="raw" hidden aria-label="Raw transaction and receipt"><pre><code class="language-json" data-raw></code></pre></section>`;
}

// ---- running a hash ------------------------------------------------------------------------

function showError(msg) {
  errorEl.textContent = msg;
  input.setAttribute("aria-invalid", msg ? "true" : "false");
}

async function run(rawHash, { push = true, silent = false } = {}) {
  const hash = rawHash.trim();
  clearTimeout(state.pollTimer);
  state.stopNotes?.();
  state.stopNotes = null;
  if (!isTxHash(hash)) {
    showError("That isn't a transaction hash. It starts with 0x and has 64 more characters.");
    input.focus();
    return;
  }
  showError("");
  input.value = hash;
  state.currentHash = hash;
  const id = ++state.runId;
  if (push && location.pathname !== `/tx/${hash}`) history.pushState({}, "", `/tx/${hash}`);
  document.title = `${shortHash(hash)} on TxExplain`;
  document.body.classList.add("has-result");
  if (!silent) mount(stage, loadingView());
  $("#explain-btn").setAttribute("aria-busy", "true");

  let raw = null;
  let facts;
  try {
    facts = await explainTx(hash, { userAbi: state.userAbi, sigLookup, onStage: (s) => id === state.runId && setStep(s), onRaw: (r) => (raw = r) });
  } catch {
    if (id !== state.runId) return;
    $("#explain-btn").removeAttribute("aria-busy");
    mount(stage, messageView("fail", "Couldn't reach BOT Chain", "The RPC didn't answer. Check your connection and try again.", true));
    return;
  }
  if (id !== state.runId) return;
  if (!facts) {
    $("#explain-btn").removeAttribute("aria-busy");
    mount(stage, messageView("wait", "Not found", "Not found on BOT Chain mainnet or testnet. Is it still pending, or from another network?", true));
    return;
  }
  setStep("summary");
  const summary = facts.status === "pending"
    ? { summary: templateSummary(facts), fixes: [], source: "template" }
    : await summarize(facts);
  if (id !== state.runId) return;

  $("#explain-btn").removeAttribute("aria-busy");
  mount(stage, resultView(facts, summary));
  stage.querySelector("[data-raw]").innerHTML = Prism.highlight(JSON.stringify(raw, null, 2), Prism.languages.json, "json");
  typeInto(stage.querySelector("[data-typed]"), summary.summary);
  state.stopNotes = initNotes(stage.querySelector("#notes"), facts);
  if (matchMedia("(max-width: 40rem)").matches) stage.querySelector("[data-events]")?.removeAttribute("open");
  remember(hash, facts.chainId);

  if (facts.status === "pending" && state.polls < 60) {
    state.polls += 1;
    state.pollTimer = setTimeout(() => run(hash, { push: false, silent: true }), 5000);
  } else {
    state.polls = 0;
  }
}

function showIdle() {
  clearTimeout(state.pollTimer);
  state.stopNotes?.();
  state.runId += 1;
  state.currentHash = null;
  document.body.classList.remove("has-result");
  document.title = "Explain a BOT Chain transaction | TxExplain";
  mount(stage, idleView());
}

// ---- events --------------------------------------------------------------------------------

$("#hash-form").addEventListener("submit", (e) => {
  e.preventDefault();
  run(input.value);
});

$("#paste-btn").addEventListener("click", async () => {
  try {
    input.value = (await navigator.clipboard.readText()).trim();
    input.focus();
    if (isTxHash(input.value)) run(input.value);
  } catch {
    input.focus();
    showError("Your browser blocked paste access. Press Ctrl+V in the box instead.");
  }
});

input.addEventListener("input", () => showError(""));

document.addEventListener("click", (e) => {
  const chip = e.target.closest("[data-hash]");
  if (chip) return run(chip.dataset.hash);
  if (e.target.closest("[data-retry]")) return run(state.currentHash ?? input.value);
  const view = e.target.closest("[data-view-btn]");
  if (view) {
    document.querySelectorAll("[data-view-btn]").forEach((b) => b.setAttribute("aria-pressed", String(b === view)));
    document.querySelectorAll("[data-view]").forEach((p) => (p.hidden = p.dataset.view !== view.dataset.viewBtn));
    return;
  }
  if (e.target.closest("[data-open-abi]")) {
    const panel = $("#abi-panel");
    panel.open = true;
    panel.scrollIntoView({ behavior: "smooth", block: "center" });
    $("#abi-text").focus();
    return;
  }
  const share = e.target.closest("[data-share]");
  if (share) {
    const url = share.dataset.share;
    if (navigator.share) navigator.share({ title: "TxExplain", url }).catch(() => {});
    else navigator.clipboard?.writeText(url).then(() => (share.textContent = "Link copied"));
  }
});

window.addEventListener("popstate", route);

// ---- ABI panel -----------------------------------------------------------------------------

function applyAbi(text) {
  const status = $("#abi-status");
  try {
    state.userAbi = parseUserAbi(text);
    status.textContent = `ABI loaded: ${state.userAbi.iface.fragments.length} entries.`;
    status.classList.remove("is-error");
    if (state.currentHash) run(state.currentHash, { push: false });
  } catch (e) {
    status.textContent = `That isn't a valid ABI: ${e.message}`;
    status.classList.add("is-error");
  }
}

$("#abi-apply").addEventListener("click", () => applyAbi($("#abi-text").value));
$("#abi-pick").addEventListener("click", () => $("#abi-file").click());
$("#abi-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (file) {
    $("#abi-text").value = await file.text();
    applyAbi($("#abi-text").value);
  }
});
const panel = $("#abi-panel");
panel.addEventListener("dragover", (e) => e.preventDefault());
panel.addEventListener("drop", async (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file) {
    panel.open = true;
    $("#abi-text").value = await file.text();
    applyAbi($("#abi-text").value);
  }
});

// ---- routing -------------------------------------------------------------------------------

function route() {
  const m = location.pathname.match(/^\/tx\/([^/]+)\/?$/);
  if (m) run(m[1], { push: false });
  else showIdle();
}

route();
