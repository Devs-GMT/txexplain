import { templateSummary } from "./template-summary.js";

// Browser side of the two Vercel Functions. Both fail soft: the decoded explanation never depends on them.

/// Signatures for a 4-byte selector, oldest first. An empty list on any failure.
export async function sigLookup(selector) {
  try {
    const res = await fetch(`/api/sig?selector=${selector}`);
    if (!res.ok) return [];
    return (await res.json()).signatures ?? [];
  } catch {
    return [];
  }
}

const SUMMARY_PREFIX = "txexplain:summary:";

/// AI summary for a facts object, cached in the browser by hash. Returns { summary, fixes } or null.
export async function aiSummary(facts) {
  const key = SUMMARY_PREFIX + facts.hash;
  try {
    const cached = localStorage.getItem(key);
    if (cached) return JSON.parse(cached);
  } catch {
    // storage can be blocked; fall through to the network
  }
  try {
    const res = await fetch("/api/explain", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ facts }),
    });
    if (!res.ok) return null;
    const body = await res.json();
    if (!body.summary) return null; // rejected by the fact check: show no summary rather than a wrong one
    const result = { summary: body.summary, fixes: body.fixes ?? [] };
    // A pending tx will change, so only settled results are cached.
    if (facts.status !== "pending") {
      try {
        localStorage.setItem(key, JSON.stringify(result));
      } catch {
        // cache is an optimisation
      }
    }
    return result;
  } catch {
    return null;
  }
}

/// Always returns a summary. `source` says whether the AI or the template wrote it, so the UI can label it.
export async function summarize(facts) {
  const ai = await aiSummary(facts);
  if (ai) return { ...ai, source: "ai" };
  return { summary: templateSummary(facts), fixes: facts.fixes ?? [], source: "template" };
}
