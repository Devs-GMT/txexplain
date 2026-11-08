import gsap from "gsap";
import { CHAINS } from "../config.js";
import { html, mount } from "../ui/html.js";
import { reducedMotion } from "../ui/type.js";
import { createScene } from "./scene.js";

// The newest transactions on BOT Chain mainnet, read from the public RPC. Everything on a row is a field of the transaction itself.
const RPC = CHAINS[677].rpc;
const BLOCKS = 120;
const SHOW = 6;
const MAX_DOTS = 220;
const KNOWN = { "0xa9059cbb": "transfer", "0x095ea7b3": "approve", "0x23b872dd": "transferFrom", "0x40c10f19": "mint" };

const post = (body) => fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
const shortHash = (h) => `${h.slice(0, 10)}…${h.slice(-6)}`;

function bot(wei) {
  const v = BigInt(wei);
  if (v === 0n) return "0 BOT";
  const unit = 10n ** 18n;
  const frac = (v % unit).toString().padStart(18, "0").slice(0, 4).replace(/0+$/, "");
  if (v < unit && !frac) return "Under 0.0001 BOT";
  return `${(v / unit).toLocaleString("en-US")}${frac ? `.${frac}` : ""} BOT`;
}

function kind(tx) {
  if (tx.to === null) return "Deploys a contract";
  if (tx.input === "0x") return "BOT transfer";
  const sel = tx.input.slice(0, 10);
  return `Calls ${KNOWN[sel] ?? sel}`;
}

async function latest() {
  const n = parseInt((await post({ jsonrpc: "2.0", id: 0, method: "eth_blockNumber", params: [] })).result, 16);
  if (!Number.isFinite(n)) throw new Error("no block");
  // Two batches of blocks, newest first. A transaction remembers the block and the time it came from.
  const batches = await Promise.all([0, 1].map((k) => post(Array.from({ length: BLOCKS / 2 }, (_, i) => ({ jsonrpc: "2.0", id: k * 1000 + i + 1, method: "eth_getBlockByNumber", params: [`0x${(n - k * (BLOCKS / 2) - i).toString(16)}`, true] })))));
  if (!batches.every(Array.isArray)) throw new Error("no batch");
  const blocks = batches.flat().sort((x, y) => x.id - y.id).map((r) => r.result).filter(Boolean);
  const seen = new Set();
  const txs = [];
  for (const blk of blocks) {
    for (const tx of blk.transactions ?? []) {
      if (seen.has(tx.hash)) continue;
      seen.add(tx.hash);
      txs.push({ ...tx, blockNumber: parseInt(blk.number, 16), time: blk.timestamp ? parseInt(blk.timestamp, 16) : null });
    }
  }
  const times = blocks.map((blk) => (blk.timestamp ? parseInt(blk.timestamp, 16) : null)).filter(Boolean);
  const span = times.length > 1 ? Math.max(...times) - Math.min(...times) : null;
  return { n, txs: txs.slice(0, MAX_DOTS), blocks: blocks.length, span };
}

const ago = (t) => {
  if (!t) return "";
  const s = Math.max(0, Math.round(Date.now() / 1000 - t));
  return s < 90 ? `${s}s ago` : `${Math.round(s / 60)} min ago`;
};

const row = (tx) => html`<li class="feed-row" data-hash="${tx.hash}">
  <code class="mono feed-hash">${shortHash(tx.hash)}</code>
  <span class="feed-kind">${kind(tx)}</span>
  <span class="mono feed-amount num">${bot(tx.value)}</span>
  <a class="btn btn--quiet btn--sm" href="/tx/${tx.hash}">Explain</a>
</li>`;

export function initFeed() {
  const root = document.querySelector("#live");
  if (!root) return;
  const list = root.querySelector("[data-feed-list]");
  const block = root.querySelector("[data-feed-block]");
  const status = root.querySelector("[data-feed-status]");
  let seen = new Set();
  let visible = false;
  const tip = root.querySelector("[data-scene-tip]");
  const legend = root.querySelector("[data-legend]");
  const scene = createScene(root.querySelector("[data-scene]"), tip, (el, tx, color, same, gas) => {
    const line = (text, cls) => Object.assign(document.createElement("p"), { textContent: text, className: cls ?? "" });
    el.style.borderColor = color;
    el.append(
      line(shortHash(tx.hash), "mono"),
      line(`${kind(tx)}, ${bot(tx.value)}`),
      line(`From ${tx.from.slice(0, 6)}…${tx.from.slice(-4)}${same > 1 ? `, ${same} dots from this sender` : ""}`, "muted"),
      line(`Block #${tx.blockNumber.toLocaleString("en-US")}${tx.time ? `, ${ago(tx.time)}` : ""}`, "muted"),
      line(`Gas limit ${gas.toLocaleString("en-US")}`, "muted"),
    );
  });

  async function refresh() {
    try {
      const { n, txs, blocks, span } = await latest();
      block.textContent = `#${n.toLocaleString("en-US")}`;
      status.textContent = txs.length ? `${txs.length} transactions in the last ${blocks} blocks${span ? `, about ${span < 90 ? `${span} seconds` : `${Math.round(span / 60)} minutes`}` : ""}. Pick a dot or a row.` : `No transactions in the last ${blocks} blocks.`;
      const counts = scene.update(txs);
      mount(legend, html`${scene.groups.map((g) => html`<li><i style="background:${scene.colors[g.key]}"></i>${g.label}<span class="num">${counts[g.key] ?? 0}</span></li>`)}<li class="legend-note">Bigger dot, bigger gas limit</li>`);
      mount(list, html`${txs.slice(0, SHOW).map(row)}`);
      const fresh = [...list.children].filter((li) => !seen.has(li.dataset.hash));
      seen = new Set(txs.slice(0, SHOW).map((t) => t.hash));
      if (fresh.length && !reducedMotion()) gsap.from(fresh, { opacity: 0, y: -14, duration: 0.5, stagger: 0.07, ease: "power3.out", clearProps: "all" });
    } catch {
      status.textContent = "Couldn't reach the BOT Chain RPC. It will try again.";
    }
  }

  refresh();
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(root);
  setInterval(() => { if (visible && !document.hidden) refresh(); }, 10_000);
}
