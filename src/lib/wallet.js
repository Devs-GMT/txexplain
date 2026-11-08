import { BrowserProvider } from "ethers";
import { CHAINS } from "../config.js";

const toHex = (n) => "0x" + n.toString(16);

export const hasWallet = () => typeof window !== "undefined" && Boolean(window.ethereum);

export const shortAddress = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/// Error with a code the UI maps to the messages in PRD section 11.
export class WalletError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export function describeWalletError(e) {
  if (e instanceof WalletError) return e;
  if (e?.code === 4001 || e?.code === "ACTION_REJECTED") return new WalletError("rejected", "You rejected the request in your wallet.");
  if (e?.code === -32002) return new WalletError("pending-request", "Your wallet already has a request open. Check the MetaMask window.");
  if (e?.code === "REVERTED") return new WalletError("reverted", e.message);
  if (e?.code === "INSUFFICIENT_FUNDS") return new WalletError("no-gas", "Not enough BOT to pay for gas.");
  return new WalletError("failed", e?.shortMessage ?? e?.message ?? "The wallet request failed.");
}

/// Switches the wallet to a BOT Chain network, adding it first when MetaMask does not know it.
export async function ensureChain(chainId) {
  const chain = CHAINS[chainId];
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: toHex(chainId) }] });
  } catch (e) {
    const unknown = e?.code === 4902 || e?.data?.originalError?.code === 4902;
    if (!unknown) throw e;
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: toHex(chainId),
        chainName: chain.name,
        rpcUrls: [chain.rpc],
        nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
        blockExplorerUrls: [chain.explorer],
      }],
    });
  }
}

/// Connects and moves the wallet to BOT Chain mainnet (677), as the PRD asks.
export async function connectWallet(chainId = 677) {
  if (!hasWallet()) throw new WalletError("no-wallet", "No wallet found. Install MetaMask to save notes and vote.");
  try {
    const provider = new BrowserProvider(window.ethereum);
    const [address] = await provider.send("eth_requestAccounts", []);
    await ensureChain(chainId);
    // A fresh provider after the switch, so the signer sees the new chain.
    const switched = new BrowserProvider(window.ethereum);
    return { address, signer: await switched.getSigner() };
  } catch (e) {
    throw describeWalletError(e);
  }
}

/// A signer on the given chain, switching the wallet if it is on another one.
export async function signerFor(chainId) {
  if (!hasWallet()) throw new WalletError("no-wallet", "No wallet found. Install MetaMask to save notes and vote.");
  try {
    await ensureChain(chainId);
    const provider = new BrowserProvider(window.ethereum);
    // Never sign for a chain the wallet did not actually switch to: a wallet that ignored the switch would send the transaction elsewhere.
    if (Number((await provider.getNetwork()).chainId) !== chainId) throw new WalletError("wrong-network", `Switch your wallet to ${CHAINS[chainId].name} and try again.`);
    return await provider.getSigner();
  } catch (e) {
    throw describeWalletError(e);
  }
}
