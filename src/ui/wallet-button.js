import { connectWallet, hasWallet, shortAddress } from "../lib/wallet.js";

// One shared wallet state for the page. `onWallet` listeners get { address } after a connect.
let current = null;
const listeners = new Set();

export const getWallet = () => current;
export const onWallet = (fn) => listeners.add(fn);

function paint(btn) {
  btn.textContent = current ? shortAddress(current.address) : "Connect wallet";
  btn.classList.toggle("is-connected", Boolean(current));
  btn.title = current ? "Connected to BOT Chain" : "";
}

function setWallet(w) {
  current = w;
  document.querySelectorAll("[data-connect]").forEach(paint);
  listeners.forEach((fn) => fn(w));
}

const bound = new WeakSet();
let watching = false;

/// Wires every [data-connect] button under `root` once, so buttons added later (a notes form) can be bound too.
export function bindWalletButtons(root = document) {
  root.querySelectorAll("[data-connect]").forEach((btn) => {
    if (bound.has(btn)) return;
    bound.add(btn);
    paint(btn);
    btn.addEventListener("click", async () => {
      if (current) return;
      btn.setAttribute("aria-busy", "true");
      try {
        const { address } = await connectWallet(677);
        setWallet({ address });
      } catch (e) {
        btn.title = e.message;
        btn.textContent = e.code === "no-wallet" ? "Install MetaMask" : "Connect wallet";
        if (e.code === "no-wallet") window.open("https://metamask.io/download/", "_blank", "noopener");
      } finally {
        btn.removeAttribute("aria-busy");
      }
    });
  });
}

/// A wallet that already approved this site reconnects without a popup.
export async function initWalletButtons() {
  bindWalletButtons();
  if (!hasWallet() || watching) return;
  watching = true;
  try {
    const [address] = await window.ethereum.request({ method: "eth_accounts" });
    if (address) setWallet({ address });
  } catch {
    // a locked or absent wallet just leaves the button in its default state
  }
  window.ethereum.on?.("accountsChanged", (accounts) => setWallet(accounts[0] ? { address: accounts[0] } : null));
}
