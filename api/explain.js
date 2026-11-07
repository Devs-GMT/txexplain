import { checkOrigin, rateLimited, setCors } from "../server/guards.js";
import { askGroq } from "../server/explain-ai.js";
import { verifySummary } from "../server/verify.js";

// Hashes are never logged; the only thing kept anywhere is the browser's own cache keyed by hash.
export default async function handler(req, res) {
  setCors(req, res);
  if (!checkOrigin(req)) return res.status(403).json({ error: "origin not allowed" });
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (rateLimited(req)) return res.status(429).json({ error: "slow down" });

  const facts = req.body?.facts;
  if (!facts || typeof facts !== "object" || !/^0x[0-9a-fA-F]{64}$/.test(facts.hash ?? "") || !facts.status) {
    return res.status(400).json({ error: "body must be { facts } from explainTx" });
  }
  if (JSON.stringify(facts).length > 60_000) return res.status(413).json({ error: "facts too large" });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "server is missing GROQ_API_KEY" });

  try {
    const options = { apiKey, model: process.env.GROQ_MODEL ?? "openai/gpt-oss-120b", signal: AbortSignal.timeout(25_000) };
    let output = await askGroq(facts, options);
    let checked = verifySummary(output, facts);
    // One retry with the reason; a second miss is returned as no summary and the client writes its own.
    if (!checked.ok) {
      output = await askGroq(facts, options, { previous: output, reason: checked.reason });
      checked = verifySummary(output, facts);
    }
    if (!checked.ok) return res.status(200).json({ summary: null, fixes: [], rejected: checked.reason });
    return res.status(200).json({ summary: checked.summary, fixes: checked.fixes });
  } catch {
    // The app still shows the decoded explanation when this returns an error.
    return res.status(502).json({ error: "summary unavailable" });
  }
}
