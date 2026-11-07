// Rules first: each fix comes from a fact we decoded, never from a guess.
export function chooseFixes(facts) {
  const r = facts.revert;
  const fixes = [];
  const text = `${r?.message ?? ""} ${r?.name ?? ""}`.toLowerCase();

  if (r?.kind === "out-of-gas") {
    fixes.push(`Raise the gas limit above ${facts.gas.used}`);
  }
  if (/owner|unauthori[sz]ed|notcurator|not curator|only/.test(text)) {
    fixes.push("Send it from the wallet that owns the contract or holds the role");
  }
  if (/authorcannotvote/.test(text)) {
    fixes.push("Mark the note as worked from a different wallet than the one that wrote it");
  }
  if (/already|ended|closed|expired/.test(text)) {
    fixes.push("The action was already done or has closed. Read the contract state before retrying");
  }
  if (/insufficient|balance|allowance|exceeds/.test(text)) {
    fixes.push("Check your BOT or token balance, and the allowance if a token is spent");
  }
  if (r?.kind === "panic" && r.code === "0x11") {
    fixes.push("Check the numbers you passed in. Something subtracted below zero or overflowed");
  }
  if (fixes.length === 0 && (r?.kind === "custom" || r?.kind === "unknown")) {
    fixes.push("Check the function arguments against the contract's ABI");
  }
  if (fixes.length === 0) {
    fixes.push(
      "Confirm the wallet is on the right BOT Chain network",
      "Check the function arguments",
      "Check your BOT balance covers value plus gas",
      "If it still fails, resend with a fresh nonce",
    );
  }
  return fixes;
}
