import { Contract, Interface, formatUnits } from "ethers";

/// bigint and ethers Result objects become plain strings and arrays, so facts stay JSON-safe.
export function plain(v) {
  if (typeof v === "bigint") return v.toString();
  if (Array.isArray(v)) return v.map(plain);
  return v;
}

function describe(d, abi) {
  return {
    abi,
    name: d.name,
    signature: d.signature,
    inputs: d.fragment.inputs.map((inp, i) => ({ name: inp.name || `arg${i}`, type: inp.type, value: plain(d.args[i]) })),
  };
}

/// Order: your ABI, bundled ABIs, then the 4-byte directory. A 4-byte hit is a guess
/// (different functions can share a selector), so it is labelled as such.
export async function decodeCall(data, value, abis, sigLookup) {
  if (!data || data === "0x") return null;
  for (const { name, iface } of abis) {
    try {
      const d = iface.parseTransaction({ data, value });
      if (d) return describe(d, name);
    } catch {
      // selector matched but the arguments did not decode against this ABI; try the next one
    }
  }
  const selector = data.slice(0, 10);
  const signatures = sigLookup ? await sigLookup(selector) : [];
  for (const sig of signatures ?? []) {
    try {
      const d = new Interface([`function ${sig}`]).parseTransaction({ data, value });
      if (d) return describe(d, "4byte");
    } catch {
      // another function with the same selector; try the next signature
    }
  }
  return { unknown: true, selector };
}

export function decodeLogs(logs, abis) {
  return logs.map((log) => {
    const raw = { address: log.address, topics: [...log.topics], data: log.data };
    for (const { name: abi, iface } of abis) {
      try {
        const d = iface.parseLog({ topics: raw.topics, data: raw.data });
        if (d) {
          return {
            index: log.index,
            address: log.address,
            abi,
            name: d.name,
            fields: d.fragment.inputs.map((inp, i) => ({ name: inp.name || `arg${i}`, type: inp.type, value: plain(d.args[i]) })),
          };
        }
      } catch {
        // ERC-20 and ERC-721 share the Transfer topic; a shape mismatch throws, so try the next ABI
      }
    }
    return { index: log.index, address: log.address, abi: null, name: null, raw };
  });
}

const TOKEN_ABI = ["function symbol() view returns (string)", "function decimals() view returns (uint8)"];

async function tokenInfo(provider, address) {
  const token = new Contract(address, TOKEN_ABI, provider);
  const [symbol, decimals] = await Promise.all([
    token.symbol().catch(() => null),
    token.decimals().catch(() => null),
  ]);
  return { symbol, decimals: decimals === null ? null : Number(decimals) };
}

/// Transfer events from ERC-20 (3 fields) and ERC-721 (token id), with the token's symbol and decimals.
export async function tokenTransfers(provider, events) {
  const out = [];
  for (const ev of events) {
    if (ev.name !== "Transfer") continue;
    const field = (n) => ev.fields.find((f) => f.name === n)?.value;
    if (ev.abi === "ERC-20") {
      const info = await tokenInfo(provider, ev.address);
      const raw = field("value");
      out.push({
        standard: "ERC-20",
        token: ev.address,
        symbol: info.symbol,
        from: field("from"),
        to: field("to"),
        raw,
        amount: info.decimals === null ? null : formatUnits(raw, info.decimals),
      });
    } else if (ev.abi === "ERC-721") {
      out.push({ standard: "ERC-721", token: ev.address, from: field("from"), to: field("to"), tokenId: field("tokenId") });
    }
  }
  return out;
}
