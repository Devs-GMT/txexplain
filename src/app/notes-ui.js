import { CHAINS } from "../config.js";
import { MAX_NOTE_BYTES, TAGS, markWorked, noteByteLength, notesAvailable, readNotes, saveNote } from "../lib/notes.js";
import { hasWallet } from "../lib/wallet.js";
import { addressChip, timeAgo } from "../ui/format.js";
import { html, mount } from "../ui/html.js";
import { bindWalletButtons, getWallet, onWallet } from "../ui/wallet-button.js";

const TAG_CLASS = ["tag--ok", "tag--info", "tag--warn"];

const thumb = html`<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M5.5 7.2 8 2.5c.9 0 1.6.7 1.6 1.6V6h3.1c.7 0 1.2.6 1.1 1.3l-.7 4.4c-.1.6-.6 1.1-1.2 1.1H5.5m0-5.6v5.6m0-5.6H3.2c-.4 0-.7.3-.7.7v4.2c0 .4.3.7.7.7h2.3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`;

export const notesShell = html`<section class="card notes" id="notes" aria-labelledby="notes-h">
  <h2 class="card-title" id="notes-h">Debug notes</h2>
  <p class="muted notes-lede">Short public notes saved on-chain for this transaction.</p>
  <div data-notes-list aria-live="polite"><p class="muted">Loading notes…</p></div>
  <div data-notes-form></div>
</section>`;

const noteItem = (n, viewer) => {
  const mine = viewer && viewer.toLowerCase() === n.author.toLowerCase();
  const label = mine ? "Your note" : n.workedByViewer ? "You marked this" : "This fix worked";
  return html`<li class="note-item">
    <div class="note-meta"><span class="tag ${TAG_CLASS[n.tag]}">${n.tagName}</span>${addressChip(n.chainId, n.author)}<time class="muted" datetime="${new Date(n.at * 1000).toISOString()}">${timeAgo(n.at)}</time></div>
    <p class="note-text">${n.text}</p>
    <button type="button" class="vote" data-vote="${n.id}" ${mine || n.workedByViewer ? "disabled" : ""} aria-label="${label}, ${n.worked} so far">${thumb}<span>${label}</span><span class="num">${n.worked}</span></button>
  </li>`;
};

function formMarkup(chainId) {
  if (!notesAvailable(chainId)) return html`<p class="note">Debug notes aren't live on ${CHAINS[chainId].name} yet. They open when the contract is deployed there.</p>`;
  if (!hasWallet()) return html`<p class="note">Saving a note needs a wallet. <a href="https://metamask.io/download/" target="_blank" rel="noopener">Install MetaMask</a> to add one or mark a fix as worked.</p>`;
  return html`<form class="note-form" novalidate>
    <fieldset class="seg"><legend class="muted">Tag</legend>
      ${TAGS.map((t, i) => html`<input type="radio" name="tag" id="tag-${i}" value="${i}" ${i === 0 ? "checked" : ""}><label for="tag-${i}">${t}</label>`)}
    </fieldset>
    <label class="visually-hidden" for="note-text">Note text</label>
    <textarea class="field field--area" id="note-text" name="text" rows="3" placeholder="What fixed it, or what to watch for" autocomplete="off"></textarea>
    <div class="note-form-foot">
      <span class="num muted" data-count aria-live="polite">0 / ${MAX_NOTE_BYTES}</span>
      ${getWallet() ? html`<button type="submit" class="btn btn--primary btn--sm" data-save>Save debug note</button>` : html`<button type="button" class="btn btn--primary btn--sm" data-connect>Connect wallet</button>`}
    </div>
    <p class="field-error" role="alert" data-note-error></p>
  </form>`;
}

/// Loads and wires the notes card for one transaction. Returns a function that stops listening to wallet changes.
export function initNotes(root, facts) {
  const list = root.querySelector("[data-notes-list]");
  const formHost = root.querySelector("[data-notes-form]");
  const chainId = facts.chainId;
  let alive = true;

  async function load() {
    if (!notesAvailable(chainId)) {
      list.innerHTML = "";
      return;
    }
    try {
      const viewer = getWallet()?.address;
      const notes = await readNotes(chainId, facts.hash, viewer);
      if (!alive) return;
      mount(list, notes.length
        ? html`<ul class="note-list">${notes.map((n) => noteItem(n, viewer))}</ul>`
        : html`<p class="muted">No notes yet. Be the first to explain what happened or what fixed it.</p>`);
    } catch {
      if (alive) mount(list, html`<p class="field-error">Couldn't read notes from the contract. Try again in a moment.</p>`);
    }
  }

  function renderForm() {
    mount(formHost, formMarkup(chainId));
    bindWalletButtons(formHost);
    const form = formHost.querySelector("form");
    if (!form) return;
    const text = form.elements.text;
    const count = form.querySelector("[data-count]");
    const error = form.querySelector("[data-note-error]");
    text.addEventListener("input", () => {
      const n = noteByteLength(text.value);
      count.textContent = `${n} / ${MAX_NOTE_BYTES}`;
      count.classList.toggle("is-over", n > MAX_NOTE_BYTES);
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = form.querySelector("[data-save]");
      error.textContent = "";
      text.removeAttribute("aria-invalid");
      btn.setAttribute("aria-busy", "true");
      btn.disabled = true;
      btn.textContent = "Confirm in your wallet…";
      try {
        const { hash } = await saveNote(chainId, facts.hash, Number(form.elements.tag.value), text.value);
        text.value = "";
        count.textContent = `0 / ${MAX_NOTE_BYTES}`;
        error.innerHTML = "";
        error.append(Object.assign(document.createElement("a"), { href: `${CHAINS[chainId].explorer}/tx/${hash}`, target: "_blank", rel: "noopener", textContent: "Saved. View the transaction" }));
        error.classList.add("is-ok");
        await load();
      } catch (err) {
        error.classList.remove("is-ok");
        error.textContent = err.message;
        text.setAttribute("aria-invalid", "true");
        text.focus();
      } finally {
        btn.removeAttribute("aria-busy");
        btn.disabled = false;
        btn.textContent = "Save debug note";
      }
    });
  }

  list.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-vote]");
    if (!btn || btn.disabled) return;
    btn.setAttribute("aria-busy", "true");
    btn.disabled = true;
    try {
      await markWorked(chainId, Number(btn.dataset.vote));
      await load();
    } catch (err) {
      btn.disabled = false;
      btn.removeAttribute("aria-busy");
      const msg = Object.assign(document.createElement("p"), { className: "field-error", role: "alert", textContent: err.message });
      btn.closest(".note-item").append(msg);
      setTimeout(() => msg.remove(), 6000);
    }
  });

  onWallet(() => {
    if (!alive) return;
    renderForm();
    load();
  });

  renderForm();
  load();
  return () => {
    alive = false;
  };
}
