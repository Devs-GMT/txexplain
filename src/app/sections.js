import { formatUnits } from "ethers";
import { CHAINS } from "../config.js";
import { PANIC } from "../lib/revert.js";
import { addressChip, copyButton, fullDate, groupDigits, shortAddr, shortHash, timeAgo } from "../ui/format.js";
import { html } from "../ui/html.js";

const ABI_LABEL = { "your ABI": "Your ABI", "4byte": "4byte guess" };

// A value in the shape a reader expects, chosen by its ABI type. Names can only hint at meaning,
// so a uint is shown as a date only when it is named like a time and lands in a plausible range.
export function renderValue(chainId, input) {
  const { type, name, value } = input;
  if (type === "address") return addressChip(chainId, value);
  if (type === "bool") return html`<span class="mono">${String(value)}</span>`;
  if (type === "string") return html`<span class="value-text">“${value}”</span>`;
  if (/^u?int/.test(type)) {
    const n = Number(value);
    if (/time|deadline|expir|until|at$/i.test(name) && n > 1e9 && n < 5e9) {
      return html`<span class="mono">${groupDigits(value)}</span> <span class="muted">(${fullDate(n)})</span>`;
    }
    return html`<span class="mono">${groupDigits(value)}</span>`;
  }
  if (typeof value === "string") return html`<span class="mono wrap">${value.length > 20 ? shortHash(value) : value}</span>${value.length > 20 ? copyButton(value, `Copy ${name}`) : ""}`;
  return html`<code class="mono wrap">${JSON.stringify(value)}</code>`;
}

export function calledSection(f) {
  if (f.created) {
    return html`<p>Deployed a contract at ${addressChip(f.chainId, f.created.address)} <span class="muted">(${f.created.bytecodeBytes.toLocaleString("en-US")} bytes of code)</span></p>`;
  }
  if (!f.call) {
    return html`<p class="muted">No function was called. This was a plain transfer to ${addressChip(f.chainId, f.to)}.</p>`;
  }
  if (f.call.unknown) {
    return html`<dl class="kv"><div><dt>Contract</dt><dd>${addressChip(f.chainId, f.to)}</dd></div></dl>
      <p class="unknown">Unknown function <code class="mono">${f.call.selector}</code></p>
      <button type="button" class="btn btn--quiet btn--sm" data-open-abi>Add ABI</button>`;
  }
  const label = ABI_LABEL[f.call.abi] ?? `Bundled ABI: ${f.call.abi}`;
  return html`<dl class="kv">
      <div><dt>Contract</dt><dd>${f.contractName ? html`<strong>${f.contractName}</strong> ` : ""}${addressChip(f.chainId, f.to)}</dd></div>
      <div><dt>Function</dt><dd><code class="mono wrap">${f.call.signature}</code> <span class="tag ${f.call.abi === "4byte" ? "tag--warn" : ""}">${label}</span></dd></div>
    </dl>
    ${f.call.abi === "4byte" ? html`<p class="note">This name comes from the public 4byte directory. Different functions can share a selector, so treat it as a best guess.</p>` : ""}
    ${f.call.inputs.length
      ? html`<table class="table"><thead><tr><th scope="col">Input</th><th scope="col">Type</th><th scope="col">Value</th></tr></thead><tbody>
        ${f.call.inputs.map((i) => html`<tr><td>${i.name}</td><td class="mono muted">${i.type}</td><td>${renderValue(f.chainId, i)}</td></tr>`)}
      </tbody></table>`
      : html`<p class="muted">No inputs.</p>`}`;
}

export function moneySection(f) {
  const rows = [];
  if (Number(f.valueBot) > 0) {
    rows.push(html`<li><span class="amount num">${f.valueBot} BOT</span> <span class="muted">from</span> ${addressChip(f.chainId, f.from)} <span class="muted">to</span> ${f.to ? addressChip(f.chainId, f.to) : "the new contract"}</li>`);
  }
  for (const t of f.transfers) {
    const what = t.standard === "ERC-721" ? `Token #${t.tokenId}` : `${t.amount ?? t.raw} ${t.symbol ?? "tokens"}`;
    rows.push(html`<li><span class="amount num">${what}</span> <span class="muted">from</span> ${addressChip(f.chainId, t.from)} <span class="muted">to</span> ${addressChip(f.chainId, t.to)}</li>`);
  }
  return rows.length ? html`<ul class="moves">${rows}</ul>` : html`<p class="muted">No BOT or tokens moved.</p>`;
}

export function eventsSection(f) {
  if (!f.events.length) return html`<p class="muted">This transaction emitted no events.</p>`;
  return html`<ul class="events">${f.events.map((e) =>
    e.name
      ? html`<li class="event"><h3>${e.name}</h3><dl class="kv kv--tight">${e.fields.map((x) => html`<div><dt>${x.name}</dt><dd>${renderValue(f.chainId, x)}</dd></div>`)}</dl><p class="muted event-src">${e.abi}, from ${shortAddr(e.address)}</p></li>`
      : html`<li class="event event--raw"><h3>Unknown event</h3><p class="muted">From ${addressChip(f.chainId, e.address)}</p>
          <details><summary>Raw topics and data</summary><pre class="raw-small mono">${[...e.raw.topics, e.raw.data].join("\n")}</pre></details>
          <button type="button" class="btn btn--quiet btn--sm" data-open-abi>Add ABI</button></li>`,
  )}</ul>`;
}

const gwei = (wei) => formatUnits(wei, "gwei");

export function gasSection(f) {
  const used = Number(f.gas.used);
  const limit = Number(f.gas.limit);
  const pct = Math.min(1, used / limit);
  const hint =
    f.status === "failed" && used === limit
      ? "It used its entire gas limit."
      : f.gas.limitMultiple && f.gas.limitMultiple >= 1.5
        ? `The gas limit was ${f.gas.limitMultiple}× what it needed.`
        : "";
  return html`<div class="gas-bar" role="img" aria-label="${used} of ${limit} gas used"><span style="--pct:${pct}"></span></div>
    <p class="num gas-line"><strong>${groupDigits(String(used))}</strong> <span class="muted">of ${groupDigits(String(limit))} gas (${(pct * 100).toFixed(1)}%)</span></p>
    <dl class="kv kv--tight">
      <div><dt>Gas price</dt><dd class="num">${gwei(f.gas.price)} gwei</dd></div>
      <div><dt>Cost</dt><dd class="num"><strong>${f.gas.costBot} BOT</strong></dd></div>
    </dl>
    ${hint ? html`<p class="note">${hint}</p>` : ""}`;
}

export function timelineSection(f) {
  const steps = [html`<li><strong>Sent</strong><span class="muted">Nonce ${f.nonce} from ${shortAddr(f.from)}</span></li>`];
  if (f.status === "pending") {
    steps.push(html`<li class="is-current"><strong>Waiting for a block</strong><span class="muted">Checking every few seconds</span></li>`);
  } else {
    steps.push(html`<li><strong>Included in block ${f.block.toLocaleString("en-US")}</strong><span class="muted">${fullDate(f.timestamp)}</span></li>`);
    steps.push(html`<li><strong>${f.events.length} event${f.events.length === 1 ? "" : "s"} emitted</strong></li>`);
    steps.push(html`<li class="${f.status === "success" ? "is-ok" : "is-fail"}"><strong>${f.status === "success" ? "Succeeded" : "Failed"}</strong><span class="muted">${f.confirmations} confirmation${f.confirmations === 1 ? "" : "s"}</span></li>`);
  }
  return html`<ol class="timeline">${steps}</ol>`;
}

export function statusCard(f, isExample) {
  const kind = f.status === "success" ? "ok" : f.status === "failed" ? "fail" : "wait";
  const label = { success: "Success", failed: "Failed", pending: "Pending" }[f.status];
  const mark = { ok: "✓", fail: "✗", wait: "…" }[kind];
  return html`<section class="card card--${kind} status-card" aria-label="Status">
    <div class="status-row"><span class="status status--${kind}" aria-hidden="true">${mark}</span><h2 class="card-title">${label}</h2>${isExample ? html`<span class="tag tag--info">Example</span>` : ""}</div>
    <dl class="kv kv--tight">
      <div><dt>Network</dt><dd>${CHAINS[f.chainId].name}</dd></div>
      ${f.status === "pending" ? "" : html`<div><dt>Block</dt><dd class="num">${f.block.toLocaleString("en-US")}</dd></div>
      <div><dt>When</dt><dd title="${fullDate(f.timestamp)}">${timeAgo(f.timestamp)}</dd></div>
      <div><dt>Confirmations</dt><dd class="num">${f.confirmations}</dd></div>`}
      <div><dt>Hash</dt><dd class="addr"><code class="mono">${shortHash(f.hash)}</code>${copyButton(f.hash, "Copy hash")}<a class="icon-link" href="${CHAINS[f.chainId].explorer}/tx/${f.hash}" target="_blank" rel="noopener" aria-label="Open transaction on explorer">↗</a></dd></div>
    </dl>
  </section>`;
}

/// Failure card: what the contract said, then the checklist. `fixes` is rules plus any the AI added, deduplicated.
export function failureSection(f, extraFixes = []) {
  const r = f.revert;
  const fixes = [...new Set([...f.fixes, ...extraFixes])];
  const panicNote = r.kind === "panic" ? html`<p class="muted">${PANIC[r.code] ?? ""}</p>` : "";
  const unsupported = r.kind === "replay-unsupported" || r.kind === "not-reproduced";
  return html`<section class="card card--fail failure" aria-labelledby="why-failed">
    <div class="failure-head"><span class="status status--fail shake" aria-hidden="true">✗</span><h2 class="card-title" id="why-failed">Why it failed</h2></div>
    <p class="failure-reason">${unsupported ? "Couldn't replay this call, so the exact reason is unknown." : r.message}</p>
    ${r.kind === "custom" && r.args.length ? html`<dl class="kv kv--tight">${r.args.map((a) => html`<div><dt>${a.name}</dt><dd class="mono">${a.value}</dd></div>`)}</dl>` : ""}
    ${panicNote}
    ${unsupported ? html`<p class="note">${r.message}. Public RPCs often keep only recent state. These are the usual causes.</p>` : ""}
    <h3 class="checklist-h">${unsupported ? "Common causes" : "What to try"}</h3>
    <ul class="checklist">${fixes.map((x, i) => html`<li style="--i:${i}"><span class="tick" aria-hidden="true"></span>${x}</li>`)}</ul>
  </section>`;
}
