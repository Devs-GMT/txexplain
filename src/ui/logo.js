import { html } from "./html.js";

// Our own mark: an amber tile with an arrow, hex in, English out. The wordmark is live text in Satoshi.
export const logoMark = html`<svg class="logo-mark" viewBox="0 0 28 28" width="28" height="28" aria-hidden="true"><rect width="28" height="28" rx="8" fill="var(--color-accent)"/><path d="M7.5 14h10M13.5 9.5 18 14l-4.5 4.5" fill="none" stroke="var(--color-accent-ink)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export const logo = html`<a class="logo" href="/" aria-label="TxExplain home">${logoMark}<span class="logo-word">TxExplain</span></a>`;
