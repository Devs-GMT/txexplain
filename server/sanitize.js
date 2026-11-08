// The facts arrive from the browser, so they are treated as untrusted input: capped in size and depth,
// stripped of control characters, and never allowed to carry anything but plain data to the model.
const MAX_STRING = 400;
const MAX_ITEMS = 40;
const MAX_DEPTH = 6;

export function sanitizeFacts(value, depth = 0) {
  if (depth > MAX_DEPTH) return null;
  if (typeof value === "string") return value.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, " ").slice(0, MAX_STRING);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, MAX_ITEMS).map((v) => sanitizeFacts(v, depth + 1));
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value).slice(0, MAX_ITEMS)) {
      if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
      out[k.slice(0, 60)] = sanitizeFacts(v, depth + 1);
    }
    return out;
  }
  return null;
}
