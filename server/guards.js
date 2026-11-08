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
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type");
    res.setHeader("Vary", "Origin");
  }
}

// Per-instance counter. Serverless instances do not share memory, so this slows a burst
// from one client but is not a hard limit; the Groq key's own quota is the real ceiling.
const hits = new Map();
export function rateLimited(req, { limit = 20, windowMs = 60_000, name = "api" } = {}) {
  // Vercel sets these two itself. A client-sent X-Forwarded-For is not trusted, or every request could claim a new address.
  const ip = String(req.headers["x-vercel-forwarded-for"] ?? req.headers["x-real-ip"] ?? req.socket?.remoteAddress ?? "unknown").split(",")[0].trim();
  const key = `${name}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > limit;
}
