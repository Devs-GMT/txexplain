import { formatEther } from "ethers";
import { DEBUG_NOTES } from "../config.js";
import { BUNDLED_ABIS } from "./abis.js";
import { decodeCall, decodeLogs, tokenTransfers } from "./decode.js";
import { findRevertReason } from "./revert.js";
import { chooseFixes } from "./fixes.js";
import { findTx } from "./rpc.js";

const HASH = /^0x[0-9a-fA-F]{64}$/;

export const isTxHash = (s) => HASH.test(s);

/// Turns a hash into a plain object of decoded facts. The AI summary receives only this object.
/// Returns null when no chain knows the hash. Options: userAbi ({name, iface}), sigLookup(selector) -> signatures[].
/// onStage("fetching" | "decoding" | "events") drives the progress steps; onRaw({ tx, receipt }) feeds the Raw tab.
/// Raw data goes to a callback, not into the facts, so it can never reach the AI.
export async function explainTx(hash, { userAbi, sigLookup, onStage, onRaw } = {}) {
  if (!isTxHash(hash)) throw new Error("Not a transaction hash");
  onStage?.("fetching");
  const found = await findTx(hash);
  if (!found) return null;
  const { chainId, provider, tx } = found;
  const abis = userAbi ? [userAbi, ...BUNDLED_ABIS] : BUNDLED_ABIS;

  const base = {
    hash: tx.hash,
    chainId,
    from: tx.from,
    to: tx.to,
    valueBot: formatEther(tx.value),
    nonce: tx.nonce,
  };

  const receipt = await provider.getTransactionReceipt(hash);
  onRaw?.({ tx: tx.toJSON(), receipt: receipt?.toJSON() ?? null });
  if (!receipt) return { ...base, status: "pending" };
  onStage?.("decoding");

  const [block, latest] = await Promise.all([provider.getBlock(receipt.blockNumber), provider.getBlockNumber()]);
  onStage?.("events");
  const events = decodeLogs(receipt.logs, abis);
  const cost = receipt.gasUsed * receipt.gasPrice;

  const facts = {
    ...base,
    status: receipt.status === 1 ? "success" : "failed",
    block: receipt.blockNumber,
    timestamp: block.timestamp,
    confirmations: latest - receipt.blockNumber + 1,
    contractName: tx.to && tx.to.toLowerCase() === DEBUG_NOTES[chainId]?.toLowerCase() ? "DebugNotes" : null,
    created: null,
    // A creation tx has no `to`; its data is init code, not a function call.
    call: tx.to ? await decodeCall(tx.data, tx.value, abis, sigLookup) : null,
    transfers: await tokenTransfers(provider, events),
    events,
    gas: {
      limit: tx.gasLimit.toString(),
      used: receipt.gasUsed.toString(),
      price: receipt.gasPrice.toString(),
      costBot: formatEther(cost),
      // Only worth saying when the limit was far above need; a failed tx used what it used.
      limitMultiple: receipt.status === 1 ? Number((Number(tx.gasLimit) / Number(receipt.gasUsed)).toFixed(1)) : null,
    },
    revert: null,
    fixes: [],
  };

  if (!tx.to && receipt.contractAddress) {
    const code = await provider.getCode(receipt.contractAddress);
    facts.created = { address: receipt.contractAddress, bytecodeBytes: (code.length - 2) / 2 };
  }
  if (facts.status === "failed") {
    facts.revert = await findRevertReason(provider, tx, receipt, abis);
    facts.fixes = chooseFixes(facts);
  }
  return facts;
}
