import gsap from "gsap";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { EXAMPLE_TXS } from "../config.js";
import { shortHash } from "../ui/format.js";
import { html, mount } from "../ui/html.js";
import { reducedMotion, typeInto } from "../ui/type.js";

gsap.registerPlugin(ScrambleTextPlugin);

// Hero widget content. Every line comes from a real example transaction on testnet; the widget says "Example".
const DEMOS = {
  failed: {
    hash: EXAMPLE_TXS.customError,
    ok: false,
    summary: "0xA288…8C4C called markWorked on DebugNotes. It failed: Custom error AuthorCannotVote.",
    facts: [["Function", "markWorked"], ["Result", "Failed"], ["Reason", "AuthorCannotVote"], ["Fix", "Mark it from a different wallet than the author's"]],
  },
  success: {
    hash: EXAMPLE_TXS.success,
    ok: true,
    summary: "0xA288…8C4C called addNote on DebugNotes. It succeeded and emitted a NoteAdded event.",
    facts: [["Function", "addNote"], ["Result", "Succeeded"], ["Event", "NoteAdded"]],
  },
  transfer: {
    hash: EXAMPLE_TXS.transfer,
    ok: true,
    summary: "0xA288…8C4C called transfer on USDT. It moved 10 USDT.",
    facts: [["Function", "transfer"], ["Moved", "10 USDT"], ["Event", "Transfer"]],
  },
};

const ORDER = ["failed", "success", "transfer"];
const $ = (sel, root = document) => root.querySelector(sel);

/// Selecting a tab with arrow keys, as a tablist should.
function bindTablist(list, onPick) {
  const tabs = [...list.querySelectorAll('[role="tab"]')];
  const select = (tab, focus) => {
    tabs.forEach((t) => {
      t.setAttribute("aria-selected", String(t === tab));
      t.tabIndex = t === tab ? 0 : -1;
    });
    if (focus) tab.focus();
    onPick(tab, focus);
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => select(tab, false));
    tab.addEventListener("keydown", (e) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (step) {
        e.preventDefault();
        select(tabs[(i + step + tabs.length) % tabs.length], true);
      }
    });
  });
  return { select: (tab) => select(tab, false), tabs };
}

export function initDemo() {
  const root = $("#demo");
  if (!root) return;
  const panel = $("#demo-panel");
  const mark = $("[data-demo-mark]", root);
  const hash = $("[data-demo-hash]", root);
  const summary = $("[data-demo-summary]", root);
  const facts = $("[data-demo-facts]", root);
  const timer = $("[data-demo-timer]", root);
  const open = $("[data-demo-open]", root);
  let runId = 0;
  let autoplay = null;
  let current = "failed";

  // The timer counts the seconds the typing actually takes; it is a stopwatch for the demo, not a benchmark.
  function stopwatch(id, done) {
    const t0 = performance.now();
    const tick = () => {
      if (id !== runId) return;
      timer.textContent = `${((performance.now() - t0) / 1000).toFixed(1)}s`;
      if (!done.finished) requestAnimationFrame(tick);
    };
    tick();
  }

  async function show(key) {
    const id = ++runId;
    current = key;
    const d = DEMOS[key];
    mark.textContent = d.ok ? "✓" : "✗";
    mark.className = `status ${d.ok ? "status--ok" : "status--fail"}`;
    hash.textContent = shortHash(d.hash);
    open.href = `/tx/${d.hash}`;
    mount(facts, html`${d.facts.map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}`);
    panel.setAttribute("aria-labelledby", `tab-${key}`);
    if (reducedMotion()) {
      summary.textContent = d.summary;
      timer.textContent = "0.0s";
      return;
    }
    gsap.set(facts.children, { opacity: 0, y: 8 });
    const done = { finished: false };
    stopwatch(id, done);
    await typeInto(summary, d.summary, { cps: 55 });
    done.finished = true;
    if (id !== runId) return;
    gsap.to(facts.children, { opacity: 1, y: 0, duration: 0.4, stagger: 0.08, ease: "power2.out" });
    if (!d.ok) gsap.to(mark, { keyframes: { x: [-5, 5, -3, 3, 0] }, duration: 0.4, ease: "power1.inOut" });
    if (autoplay !== null) autoplay = setTimeout(() => pick(ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]), 7000);
  }

  const tabs = bindTablist($(".switch", root), (tab) => {
    clearTimeout(autoplay);
    autoplay = null;
    show(tab.dataset.demo);
  });
  const pick = (key) => tabs.select(tabs.tabs.find((t) => t.dataset.demo === key));

  autoplay = reducedMotion() ? null : 0;
  show("failed");
}

// ---- hex to English strip ------------------------------------------------------------------

const STRIPS = {
  transfer: {
    hex: "0xa9059cbb000000000000000000000000…0000000000000000000000000000000000000000000000000000000000989680",
    en: "transfer(to, 10000000). That is 10 USDT, which has 6 decimals.",
  },
  failed: {
    hex: "0x08c379a0…0000000000000000000000000000000000000000000000000000000000000010416d6f756e7420746f6f20736d616c6c",
    en: "The call reverted with the message “Amount too small”.",
  },
  call: {
    hex: "0xa169ce09",
    en: "boom(). No arguments, so the four-byte selector is the whole call.",
  },
};

export function initStrip() {
  const root = $(".decode");
  if (!root) return;
  const hex = $("[data-strip-hex]", root);
  const en = $("[data-strip-en]", root);
  let started = false;

  function run(key) {
    const s = STRIPS[key];
    hex.textContent = s.hex;
    gsap.killTweensOf(en);
    if (reducedMotion() || !started) {
      en.textContent = s.en;
      return;
    }
    gsap.to(en, { duration: 1.5, scrambleText: { text: s.en, chars: "0123456789abcdef", speed: 0.7, revealDelay: 0.25 }, ease: "none" });
  }

  bindTablist($(".switch", root), (tab) => run(tab.dataset.decode));
  run("transfer");

  // Scramble the first line once the strip scrolls into view; before that it holds its final text.
  if (reducedMotion()) return;
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    started = true;
    run("transfer");
  }, { threshold: 0.6 });
  io.observe(root);
}
