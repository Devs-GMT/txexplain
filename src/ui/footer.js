import { CHAINS, DEBUG_NOTES, EXAMPLE_TXS, FOOTER_CHAIN, LINKS } from "../config.js";
import { readLatestNote, readStats } from "../lib/notes.js";
import { copyButton, explorerAddr, shortAddr, timeAgo } from "./format.js";
import { html } from "./html.js";
import { logoMark } from "./logo.js";
import { typeInto } from "./type.js";

const contract = DEBUG_NOTES[FOOTER_CHAIN];
const chain = CHAINS[FOOTER_CHAIN];
const githubHref = LINKS.github ?? "/#trust";
const docsHref = LINKS.github ? `${LINKS.github}#readme` : "/#trust";

export const footer = html`<footer class="footer" id="footer">
  <div class="container">
    <section class="explain-card" aria-label="Latest debug note on the DebugNotes contract" data-footer-card>
      <div class="explain-card-head">
        <span class="status status--ok" aria-hidden="true">✓</span>
        <p class="explain-card-text" data-footer-text aria-live="polite">Reading the latest note…</p>
      </div>
      <div class="explain-card-body">
        <a class="botchain-logo" href="${LINKS.botchain}" target="_blank" rel="noopener" aria-label="BOT Chain, opens botchain.ai in a new tab"><img src="/brand/botchain-footer-logo.png" width="219" height="48" alt="BOT Chain"></a>
        <dl class="contract">
          <div><dt>Contract</dt><dd class="mono">DebugNotes</dd></div>
          <div><dt>Chain ID</dt><dd class="mono">${FOOTER_CHAIN}${FOOTER_CHAIN === 968 ? " (testnet)" : ""}</dd></div>
          <div><dt>Address</dt><dd class="mono addr">${shortAddr(contract)}${copyButton(contract, "Copy contract address")}</dd></div>
        </dl>
        <a class="btn btn--primary btn--sm" href="${explorerAddr(FOOTER_CHAIN, contract)}" target="_blank" rel="noopener">View on explorer ↗</a>
      </div>
      <p class="explain-card-stats mono" data-footer-stats hidden>Notes <span data-n>0</span>, fixes that worked <span data-m>0</span></p>
    </section>

    <div class="footer-cols">
      <div class="footer-brand"><a class="logo" href="/" aria-label="TxExplain home">${logoMark}<span class="logo-word">TxExplain</span></a><p>Paste a BOT Chain hash. Get the story in plain English.</p></div>
      <nav aria-label="Product"><h2 class="footer-h">Product</h2><ul>
        <li><a href="/app">Explain a transaction</a></li>
        <li><a href="/#story">Examples</a></li>
        <li><a href="/tx/${EXAMPLE_TXS.outOfGas}#notes">Debug notes</a></li>
      </ul></nav>
      <nav aria-label="Resources"><h2 class="footer-h">Resources</h2><ul>
        <li><a href="${docsHref}">Docs</a></li>
        <li><a href="/app#errors">Common errors</a></li>
        <li><a href="${LINKS.botchainDocs}" target="_blank" rel="noopener">BOT Chain docs</a></li>
      </ul></nav>
      <nav aria-label="Project"><h2 class="footer-h">Project</h2><ul>
        <li><a href="${githubHref}"${LINKS.github ? ' target="_blank" rel="noopener"' : ""}>GitHub</a></li>
        <li><a href="${LINKS.x}" target="_blank" rel="noopener">X</a></li>
        <li><a href="${explorerAddr(FOOTER_CHAIN, contract)}" target="_blank" rel="noopener">DebugNotes contract</a></li>
      </ul></nav>
    </div>
    <p class="footer-legal">© 2026 TxExplain. AI explanations are based on decoded data. Double-check important transactions.</p>
  </div>
</footer>`;

/// Fills the card from the contract: the latest NoteAdded as a sentence, and the two counters.
/// Nothing is shown that the chain did not say; a failed read says so instead of inventing a count.
export async function hydrateFooter() {
  const text = document.querySelector("[data-footer-text]");
  const stats = document.querySelector("[data-footer-stats]");
  if (!text) return;
  try {
    const [latest, counts] = await Promise.all([readLatestNote(FOOTER_CHAIN), readStats(FOOTER_CHAIN)]);
    const sentence = latest
      ? `Someone saved a debug note on ${chain.name} ${timeAgo(latest.at)}.`
      : "No notes saved yet. The first one will show up here.";
    typeInto(text, sentence);
    stats.querySelector("[data-n]").textContent = counts.notes;
    stats.querySelector("[data-m]").textContent = counts.worked;
    stats.hidden = false;
  } catch {
    text.textContent = "Couldn't read the contract right now.";
  }
}
