import { shortAddress } from "./wallet.js";

/// Plain-English summary written from the facts alone. The client uses it when the AI is down or
/// its answer fails the fact check, so every explanation has a sentence and none of them is invented.
export function templateSummary(f) {
  const who = shortAddress(f.from);
  const to = f.to ? shortAddress(f.to) : null;
  if (f.status === "pending") {
    return `${who} sent a transaction${to ? ` to ${to}` : ""}. It is waiting to be included in a block.`;
  }

  const s = [];
  if (f.created) {
    s.push(`${who} deployed a contract at ${shortAddress(f.created.address)} (${f.created.bytecodeBytes} bytes).`);
  } else if (f.call?.unknown) {
    s.push(`${who} called an unknown function (${f.call.selector}) on ${to}.`);
  } else if (f.call) {
    s.push(`${who} called ${f.call.name} on ${f.contractName ?? to}.`);
  } else {
    s.push(`${who} sent ${f.valueBot} BOT to ${to}.`);
  }

  for (const t of f.transfers ?? []) {
    const moved = t.standard === "ERC-721" ? `token #${t.tokenId}` : `${t.amount ?? t.raw} ${t.symbol ?? "tokens"}`;
    s.push(`It moved ${moved} from ${shortAddress(t.from)} to ${shortAddress(t.to)}.`);
  }
  if (f.call && Number(f.valueBot) > 0) s.push(`It also sent ${f.valueBot} BOT.`);

  s.push(f.status === "failed" ? `It failed: ${f.revert?.message ?? "no reason found"}.` : `It succeeded in block ${f.block}.`);
  s.push(`It cost ${f.gas.costBot} BOT in gas.`);
  return s.join(" ");
}
