import { JsonRpcProvider } from "ethers";
import { CHAINS } from "../config.js";

const providers = new Map();

export function getProvider(chainId) {
  if (!providers.has(chainId)) {
    // staticNetwork skips the chain-id probe, so a slow RPC fails once instead of retrying.
    providers.set(chainId, new JsonRpcProvider(CHAINS[chainId].rpc, chainId, { staticNetwork: true }));
  }
  return providers.get(chainId);
}

/// Mainnet first, then testnet. Returns null only when every chain answered "not found";
/// if no chain could be reached at all, the last network error is thrown.
export async function findTx(hash, chainIds = [677, 968]) {
  let lastError = null;
  let answered = false;
  for (const chainId of chainIds) {
    const provider = getProvider(chainId);
    try {
      const tx = await provider.getTransaction(hash);
      answered = true;
      if (tx) return { chainId, provider, tx };
    } catch (e) {
      lastError = e;
    }
  }
  if (!answered && lastError) throw lastError;
  return null;
}
