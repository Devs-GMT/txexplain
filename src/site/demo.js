import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { EXAMPLE_TXS } from "../config.js";
import { html, mount } from "../ui/html.js";
import { iconCheck, iconCross } from "../ui/icons.js";
import { reducedMotion, typeInto } from "../ui/type.js";

gsap.registerPlugin(ScrambleTextPlugin, ScrollTrigger);

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
    facts: [["Function", "addNote"], ["Result", "Succeeded"], ["Event", "NoteAdded"], ["Network", "BOT Chain Testnet"]],
  },
  transfer: {
    hash: EXAMPLE_TXS.transfer,
    ok: true,
    summary: "0xA288…8C4C called transfer on USDT. It moved 10 USDT.",
    facts: [["Function", "transfer"], ["Moved", "10 USDT"], ["Event", "Transfer"], ["Network", "BOT Chain Testnet"]],
  },
};

const ORDER = ["failed", "success", "transfer"];
const $ = (sel, root = document) => root.querySelector(sel);
const HASH = /^0x[0-9a-fA-F]{64}$/;

/// A tablist: click or arrow keys pick a tab. `onPick(tab)` runs for both.
function bindTablist(list, onPick) {
  const tabs = [...list.querySelectorAll('[role="tab"]')];
  const select = (tab, focus) => {
    tabs.forEach((t) => {
      t.setAttribute("aria-selected", String(t === tab));
      t.tabIndex = t === tab ? 0 : -1;
    });
    if (focus) tab.focus();
    onPick(tab);
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => select(tab, false));
    tab.addEventListener("keydown", (e) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      select(tabs[(i + step + tabs.length) % tabs.length], true);
    });
  });
  return { select: (tab) => select(tab, false), tabs };
}

const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s) % 60).padStart(2, "0")}`;

export function initDemo() {
  const root = $("#demo");
  if (!root) return;
  const panel = $("#demo-panel");
  const form = $("#demo-form", root);
  const input = $("#demo-input", root);
  const error = $("#demo-error", root);
  const steps = [...root.querySelectorAll("[data-demo-steps] li")];
  const mark = $("[data-demo-mark]", root);
  const summary = $("[data-demo-summary]", root);
  const facts = $("[data-demo-facts]", root);
  const timer = $("[data-demo-timer]", root);
  const open = $("[data-demo-open]", root);
  let runId = 0;
  let autoplay = null;
  let current = "failed";

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // The clock counts the seconds the demo actually takes to play. It is a stopwatch for the animation, not a benchmark.
  function stopwatch(id, state) {
    const t0 = performance.now();
    const tick = () => {
      if (id !== runId) return;
      timer.textContent = clock((performance.now() - t0) / 1000);
      if (!state.done) requestAnimationFrame(tick);
    };
    tick();
  }

  const ANGLE = { success: -55, failed: 0, transfer: 55 };
  const knobEl = $(".dial-knob", root);
  const notch = $(".dial-notch", root);
  const dialLabel = $("[data-dial-label]", root);
  function turnDial(key) {
    dialLabel.textContent = key[0].toUpperCase() + key.slice(1);
    if (reducedMotion()) {
      notch.style.transform = `rotate(${ANGLE[key]}deg)`;
      return;
    }
    // The notch swings round the knob like a rotary switch: it overshoots a little, then settles.
    gsap.to(notch, { rotation: ANGLE[key], transformOrigin: "50% 307%", duration: 0.9, ease: "elastic.out(1, 0.55)", overwrite: true });
  }

  async function show(key) {
    const id = ++runId;
    current = key;
    const d = DEMOS[key];
    error.textContent = "";
    mark.innerHTML = (d.ok ? iconCheck : iconCross).toString();
    mark.className = `status ${d.ok ? "status--ok" : "status--fail"}`;
    root.classList.toggle("card--ok", d.ok);
    root.classList.toggle("card--fail", !d.ok);
    open.href = `/tx/${d.hash}`;
    turnDial(key);
    mount(facts, html`${d.facts.map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}`);
    panel.setAttribute("aria-labelledby", `tab-${key}`);
    steps.forEach((li) => li.classList.remove("is-done"));

    if (reducedMotion()) {
      input.value = d.hash;
      steps.forEach((li) => li.classList.add("is-done"));
      summary.textContent = d.summary;
      timer.textContent = "0:00";
      return;
    }

    gsap.set(facts.children, { opacity: 0, y: 8 });
    summary.textContent = "";
    const state = { done: false };
    stopwatch(id, state);

    const typed = { n: 0 };
    await gsap.to(typed, { n: d.hash.length, duration: 0.7, ease: "none", onUpdate: () => { input.value = d.hash.slice(0, Math.round(typed.n)); } });
    for (const li of steps) {
      if (id !== runId) return;
      await wait(260);
      li.classList.add("is-done");
    }
    if (id !== runId) return;
    await typeInto(summary, d.summary, { cps: 55 });
    state.done = true;
    if (id !== runId) return;
    gsap.to(facts.children, { opacity: 1, y: 0, duration: 0.4, stagger: 0.08, ease: "power2.out" });
    if (!d.ok) gsap.to(mark, { keyframes: { x: [-5, 5, -3, 3, 0] }, duration: 0.4, ease: "power1.inOut" });
    if (autoplay !== null) autoplay = setTimeout(() => pick(ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]), 6000);
  }

  const dialTabs = bindTablist($(".dial", root), (tab) => {
    clearTimeout(autoplay);
    autoplay = null;
    show(tab.dataset.demo);
  });
  const pick = (key) => dialTabs.select(dialTabs.tabs.find((t) => t.dataset.demo === key));
  const knob = $(".dial-knob", root);
  knob.addEventListener("click", () => pick(ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]));
  knob.addEventListener("pointermove", (e) => {
    const r = knob.getBoundingClientRect();
    knob.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    knob.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
  });

  // Anyone can also type or paste their own hash here.
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const hash = input.value.trim();
    if (HASH.test(hash)) {
      location.href = `/tx/${hash}`;
      return;
    }
    clearTimeout(autoplay);
    autoplay = null;
    input.setAttribute("aria-invalid", "true");
    error.textContent = "A transaction hash is 0x followed by 64 hex characters.";
  });
  input.addEventListener("input", () => {
    clearTimeout(autoplay);
    autoplay = null;
    input.removeAttribute("aria-invalid");
    error.textContent = "";
  });

  // The deck opens already played. The first change comes by itself a few seconds later, or when someone picks a tab.
  autoplay = reducedMotion() ? null : setTimeout(() => pick("success"), 6000);
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

const scramble = (en, text, duration) => gsap.to(en, { duration, scrambleText: { text, chars: "0123456789abcdef", speed: 0.7, revealDelay: 0.2 }, ease: "none" });

export function initStrip() {
  const root = $(".decode");
  if (!root) return;
  const hex = $("[data-strip-hex]", root);
  const en = $("[data-strip-en]", root);
  let scrub = null;

  function run(key, { animate }) {
    const s = STRIPS[key];
    hex.textContent = s.hex;
    gsap.killTweensOf(en);
    if (!animate || reducedMotion()) en.textContent = s.en;
    else scramble(en, s.en, 1.4);
  }

  bindTablist($(".switch", root), (tab) => {
    scrub?.kill(true);
    scrub = null;
    run(tab.dataset.decode, { animate: true });
  });
  run("transfer", { animate: false });

  // First view: the sentence resolves out of noise as the strip scrolls through the screen.
  // The tween starts from the first frame of noise, so scrubbing back up restores the noise.
  if (reducedMotion()) return;
  scrub = ScrollTrigger.create({
    trigger: root.querySelector(".strip"),
    start: "top 85%",
    end: "top 35%",
    scrub: 0.6,
    animation: scramble(en, STRIPS.transfer.en, 1).pause(0),
  });
}
