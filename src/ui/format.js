import { CHAINS } from "../config.js";
import { html } from "./html.js";

export const shortHash = (h) => `${h.slice(0, 10)}…${h.slice(-6)}`;
export const shortAddr = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export const explorerTx = (chainId, hash) => `${CHAINS[chainId].explorer}/tx/${hash}`;
export const explorerAddr = (chainId, addr) => `${CHAINS[chainId].explorer}/address/${addr}`;

const UNITS = [["year", 31536000], ["month", 2592000], ["day", 86400], ["hour", 3600], ["minute", 60]];

export function timeAgo(unixSeconds, now = Date.now() / 1000) {
  const diff = Math.max(0, Math.round(now - unixSeconds));
  if (diff < 45) return "just now";
  for (const [name, secs] of UNITS) {
    if (diff >= secs) {
      const n = Math.round(diff / secs);
      return `${n} ${name}${n === 1 ? "" : "s"} ago`;
    }
  }
  return "just now";
}

export const fullDate = (unixSeconds) =>
  new Date(unixSeconds * 1000).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

/// 1234567 -> "1,234,567" for whole numbers held as strings (uint values arrive as strings).
export const groupDigits = (s) => (/^\d{4,}$/.test(s) ? s.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : s);

/// An address with a copy button and an explorer link.
export function addressChip(chainId, addr) {
  return html`<span class="addr"><code class="mono">${shortAddr(addr)}</code>${copyButton(addr, "Copy address")}<a class="icon-link" href="${explorerAddr(chainId, addr)}" target="_blank" rel="noopener" aria-label="Open address on explorer">↗</a></span>`;
}

export function copyButton(value, label = "Copy") {
  return html`<button type="button" class="icon-btn" data-copy="${value}" aria-label="${label}"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M10.5 3.5v-.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h.5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg></button>`;
}

/// One listener for every [data-copy] button on the page.
export function enableCopy() {
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-copy]");
    if (!btn) return;
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      btn.classList.add("is-done");
      btn.setAttribute("aria-label", "Copied");
      setTimeout(() => btn.classList.remove("is-done"), 1200);
    } catch {
      // clipboard can be blocked outside a secure context; the value is still visible to select
    }
  });
}
