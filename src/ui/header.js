import { EXAMPLE_TXS, LINKS } from "../config.js";
import { html } from "./html.js";
import { logo } from "./logo.js";


// A looping band of one link. The second group is a copy for the seamless loop, so it is hidden from assistive tech.
const marqueeGroup = (hidden) => html`<span class="marquee-group"${hidden ? " aria-hidden=\"true\"" : ""}>${Array.from({ length: 4 }, () => html`<a href="/tx/${EXAMPLE_TXS.customError}"${hidden ? " tabindex=\"-1\"" : ""}>See a failed transaction explained</a><span class="marquee-sep">/</span>`)}</span>`;

export const announcement = html`<div class="marquee"><div class="marquee-track">${marqueeGroup(false)}${marqueeGroup(true)}</div></div>`;

export const navbar = html`<header class="nav" data-nav>
  <div class="container nav-inner">
    ${logo}
    <button type="button" class="nav-toggle btn btn--quiet btn--sm" aria-expanded="false" aria-controls="nav-menu">Menu</button>
    <div class="nav-menu" id="nav-menu">
      <nav class="nav-links" aria-label="Main">
        <a href="/">Product</a>
        <a href="/#tour">Examples</a>
        <a href="${LINKS.botchainDocs}" target="_blank" rel="noopener">Docs</a>
      </nav>
      <div class="nav-actions">
        <button type="button" class="btn btn--quiet btn--sm" data-connect>Connect wallet</button>
        <a class="btn btn--primary btn--sm" href="/app">Explain a transaction</a>
      </div>
    </div>
  </div>
</header>`;

/// Under 60rem the links sit behind the Menu button.
export function initNav() {
  const toggle = document.querySelector(".nav-toggle");
  const menu = document.getElementById("nav-menu");
  if (!toggle || !menu) return;
  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!open));
    menu.classList.toggle("is-open", !open);
  });
}
