import gsap from "gsap";
import { CHAINS, EXAMPLE_TXS } from "../config.js";
import { sigLookup, summarize } from "../lib/api.js";
import { explainTx, isTxHash } from "../lib/explain.js";
import { templateSummary } from "../lib/template-summary.js";
import { iconCross } from "../ui/icons.js";
import { reducedMotion, typeInto } from "../ui/type.js";

// The conversation in the phone is real once you use it: paste a hash and the same engine as /app reads the chain and answers.
// Everything the chain or the AI sends back is put on the page as text, never as markup.
const STAGE = { fetching: "Fetching from the chain", decoding: "Decoding the call", events: "Reading events", summary: "Writing the summary" };
const short = (h) => `${h.slice(0, 10)}…${h.slice(-6)}`;

export function initChat() {
  const phone = document.querySelector("[data-phone]");
  if (!phone) return;
  const chat = phone.querySelector("[data-chat]");
  const form = phone.querySelector("[data-composer-form]");
  const input = phone.querySelector("[data-composer]");
  const chips = phone.querySelector("[data-chat-chips]");
  let running = false;

  const el = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls ?? "", textContent: text ?? "" });
  const scroll = () => { chat.scrollTop = chat.scrollHeight; };
  function add(node) {
    node.classList.add("is-shown", "is-live");
    chat.append(node);
    scroll();
    if (!reducedMotion()) gsap.from(node, { opacity: 0, y: 12, duration: 0.4, ease: "power2.out", clearProps: "opacity,transform" });
    return node;
  }
  const bot = (text, extra = "") => add(el("div", `msg msg--bot ${extra}`, text));

  // The first message from the visitor replaces the scripted example.
  function takeOver() {
    if (phone.dataset.live) return;
    phone.dataset.live = "1";
    chat.replaceChildren();
    chips.hidden = true;
  }

  async function ask(raw) {
    const value = raw.trim();
    if (!value || running) return;
    running = true;
    form.setAttribute("aria-busy", "true");
    takeOver();
    add(el("div", "msg msg--me")).append(el("code", "mono", isTxHash(value) ? short(value) : value.slice(0, 66)));
    if (!isTxHash(value)) {
      bot("That isn't a transaction hash. It starts with 0x and has 64 more characters.");
      return done();
    }
    const status = add(el("p", "msg-status mono", STAGE.fetching));
    let facts;
    try {
      facts = await explainTx(value, { sigLookup, onStage: (s) => { status.textContent = STAGE[s] ?? status.textContent; } });
    } catch {
      status.remove();
      bot("I couldn't reach BOT Chain. Check your connection and try again.");
      return done();
    }
    if (!facts) {
      status.remove();
      bot("Not found on BOT Chain mainnet or testnet. Is it still pending, or from another network?");
      return done();
    }
    const summary = facts.status === "pending" ? { summary: templateSummary(facts), fixes: [], source: "template" } : await summarize(facts);
    status.textContent = `Read from ${CHAINS[facts.chainId].name}`;
    // The text types into an inner span, so the bubble's own entrance is not cancelled by the typing tween.
    const said = bot("");
    const line = said.appendChild(el("span"));
    await typeInto(line, summary.summary, { cps: 80 });
    scroll();
    if (facts.status === "failed") {
      const fail = add(el("div", "msg msg--bot msg--fail"));
      const mark = el("span", "status status--fail");
      mark.setAttribute("aria-hidden", "true");
      mark.innerHTML = iconCross.toString();
      fail.append(mark, el("span", "", facts.revert?.message ?? "It failed."));
      const fixes = [...new Set([...(facts.fixes ?? []), ...summary.fixes])];
      if (fixes.length) {
        const box = add(el("div", "msg msg--bot"));
        box.append(el("span", "msg-label", "Try this"));
        const ul = el("ul", "checks");
        for (const f of fixes) {
          const li = el("li");
          const tick = el("span", "tick");
          tick.setAttribute("aria-hidden", "true");
          li.append(tick, f);
          ul.append(li);
        }
        box.append(ul);
        scroll();
      }
    }
    const open = add(el("a", "msg msg--link", "Open the full explanation"));
    open.href = `/tx/${facts.hash}`;
    done();
  }

  function done() {
    running = false;
    form.removeAttribute("aria-busy");
    input.value = "";
    input.focus({ preventScroll: true });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    ask(input.value);
  });
  chips.addEventListener("click", (e) => {
    const b = e.target.closest("[data-example]");
    if (b) ask(EXAMPLE_TXS[b.dataset.example]);
  });
  input.addEventListener("focus", () => { phone.dataset.typing = "1"; });
}
