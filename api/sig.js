import { checkOrigin, rateLimited, setCors } from "../server/guards.js";

const cache = new Map();

// 4byte.directory holds many junk signatures for popular selectors (e.g. a fake "workMyDirefulOwner"
// for transfer). The oldest entry is almost always the real one, so results are sorted by id.
export default async function handler(req, res) {
  setCors(req, res);
  if (!checkOrigin(req)) return res.status(403).json({ error: "origin not allowed" });
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  if (rateLimited(req, { limit: 30, name: "sig" })) return res.status(429).json({ error: "slow down" });

  const selector = String(req.query?.selector ?? "").toLowerCase();
  if (!/^0x[0-9a-f]{8}$/.test(selector)) return res.status(400).json({ error: "selector must be 0x plus 8 hex digits" });

  if (cache.has(selector)) {
    res.setHeader("Cache-Control", "public, s-maxage=86400");
    return res.status(200).json({ signatures: cache.get(selector) });
  }
  try {
    const r = await fetch(`https://www.4byte.directory/api/v1/signatures/?hex_signature=${selector}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`4byte responded ${r.status}`);
    const { results } = await r.json();
    const signatures = results
      .sort((a, b) => a.id - b.id)
      .slice(0, 5)
      .map((x) => x.text_signature);
    cache.set(selector, signatures);
    res.setHeader("Cache-Control", "public, s-maxage=86400");
    return res.status(200).json({ signatures });
  } catch {
    return res.status(502).json({ error: "signature lookup failed" });
  }
}
