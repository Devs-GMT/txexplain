// The model sees decoded facts and nothing else. This check catches the failure that matters:
// an address or a number in the answer that is not in the facts. A rejected answer is dropped
// and the app shows the decoded explanation without a summary.

const HEX = /0x[0-9a-fA-F]{2,}(?:(?:…|\.\.\.)[0-9a-fA-F]{2,})?/g;
const NUM = /\d[\d,]*(?:\.\d+)?/g;

// A rounded figure is honest ("0.001 BOT" for 0.00104304), so a decimal in the answer passes when
// some decimal in the facts rounds to it. Whole numbers must still match exactly.
const FACT_DECIMAL = /(?<![0-9a-zA-Z.])\d+\.\d+(?![0-9a-zA-Z])/g;

function isRoundedFact(candidate, factText) {
  const places = candidate.split(".")[1]?.length;
  if (!places) return false;
  return (factText.match(FACT_DECIMAL) ?? []).some((f) => Number(Number(f).toFixed(places)) === Number(candidate));
}

export function verifySummary(output, facts) {
  if (!output || typeof output.summary !== "string" || output.summary.trim() === "") {
    return { ok: false, reason: "no summary" };
  }
  const fixes = Array.isArray(output.fixes) ? output.fixes.filter((f) => typeof f === "string").slice(0, 4) : [];
  const haystack = JSON.stringify(facts).toLowerCase();
  const text = [output.summary, ...fixes].join(" ");

  for (const hex of text.match(HEX) ?? []) {
    for (const part of hex.toLowerCase().split(/…|\.\.\./)) {
      if (!haystack.includes(part)) return { ok: false, reason: `address or hash not in facts: ${hex}` };
    }
  }
  const withoutHex = text.replace(HEX, " ");
  for (const raw of withoutHex.match(NUM) ?? []) {
    const n = raw.replace(/,/g, "");
    // Small integers are counts ("two events"); anything larger or fractional must be a fact.
    if (/^\d{1,2}$/.test(n) && Number(n) <= 10) continue;
    if (!haystack.includes(n) && !isRoundedFact(n, JSON.stringify(facts))) {
      return { ok: false, reason: `number not in facts: ${raw}` };
    }
  }
  return { ok: true, summary: output.summary.trim(), fixes };
}
