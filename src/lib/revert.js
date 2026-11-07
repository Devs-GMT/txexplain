import { AbiCoder } from "ethers";

export const PANIC = {
  "0x00": "generic compiler panic",
  "0x01": "assert() failed",
  "0x11": "arithmetic overflow or underflow",
  "0x12": "division or modulo by zero",
  "0x21": "invalid enum value",
  "0x22": "corrupted storage byte array",
  "0x31": "pop() on an empty array",
  "0x32": "array index out of bounds",
  "0x41": "too much memory requested",
  "0x51": "call to an uninitialised function pointer",
};

const coder = AbiCoder.defaultAbiCoder();

export function decodeRevertData(data, abis) {
  if (!data || data === "0x") return { kind: "empty", message: "Reverted without a reason" };
  const selector = data.slice(0, 10).toLowerCase();
  const body = "0x" + data.slice(10);

  if (selector === "0x08c379a0") {
    const [message] = coder.decode(["string"], body);
    return { kind: "error", message };
  }
  if (selector === "0x4e487b71") {
    const [code] = coder.decode(["uint256"], body);
    const hex = "0x" + code.toString(16).padStart(2, "0");
    return { kind: "panic", code: hex, message: `Panic ${hex}: ${PANIC[hex] ?? "unknown panic code"}` };
  }
  for (const { name: abi, iface } of abis) {
    const err = iface.parseError(data);
    if (err) {
      const args = err.fragment.inputs.map((inp, i) => ({
        name: inp.name || `arg${i}`,
        type: inp.type,
        value: String(err.args[i]),
      }));
      return { kind: "custom", name: err.name, signature: err.signature, args, abi, message: `Custom error ${err.name}` };
    }
  }
  return { kind: "unknown", selector, message: `Unknown error ${selector}` };
}

/// A receipt never carries revert data, so the only way to get it is to run the call again.
/// State is taken at the block before the tx; ordering inside the block is not reproduced.
/// Used == limit is read as out of gas without a replay.
export async function findRevertReason(provider, tx, receipt, abis) {
  if (receipt.gasUsed === tx.gasLimit) {
    return { kind: "out-of-gas", message: `Used all ${tx.gasLimit} gas it was given` };
  }
  try {
    await provider.call(
      { from: tx.from, to: tx.to, data: tx.data, value: tx.value, gasLimit: tx.gasLimit },
      receipt.blockNumber - 1,
    );
    return { kind: "not-reproduced", message: "The replay succeeded, so state changed after this transaction" };
  } catch (e) {
    if (e.code === "CALL_EXCEPTION") return decodeRevertData(e.data ?? "0x", abis);
    // Non-archive nodes drop old state, which shows up as a generic RPC error with no revert data.
    return { kind: "replay-unsupported", message: "This RPC could not replay the call at that block" };
  }
}
