// Same-origin requests always pass. Other browser origins must be listed in ALLOWED_ORIGINS
// (comma separated), which is how local dev on another port is let in.
export function checkOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // curl and server-to-server calls send no Origin; the rate limit covers them
  try {
    if (new URL(origin).host === req.headers.host) return true;
  } catch {
    return false;
  }
  return (process.env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean).includes(origin);
}

export function setCors(req, res) {
  if (req.headers.origin && checkOrigin(req)) {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
    res.setHeader("Vary", "Origin");
  }
}

// Per-instance counter. Serverless instances do not share memory, so this slows a burst
// from one client but is not a hard limit; the Groq key's own quota is the real ceiling.
const hits = new Map();
export function rateLimited(req, { limit = 20, windowMs = 60_000 } = {}) {
  const ip = String(req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "unknown").split(",")[0].trim();
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > limit;
}
