import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeFacts } from "./sanitize.js";
import { rateLimited } from "./guards.js";

test("strings lose control characters and are capped", () => {
  const out = sanitizeFacts({ a: "x\u0000y\nz", b: "q".repeat(1000) });
  assert.equal(out.a, "x y z");
  assert.equal(out.b.length, 400);
});

test("prototype keys, functions and deep nesting are dropped", () => {
  const evil = JSON.parse('{"__proto__": {"polluted": true}, "ok": 1}');
  const out = sanitizeFacts(evil);
  assert.equal(out.ok, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(out, "__proto__"), false);
  assert.equal({}.polluted, undefined);
  let deep = { v: 1 };
  for (let i = 0; i < 20; i++) deep = { n: deep };
  assert.ok(JSON.stringify(sanitizeFacts(deep)).includes("null"));
  assert.equal(sanitizeFacts(() => 1), null);
});

test("arrays are capped and non-finite numbers become null", () => {
  assert.equal(sanitizeFacts(Array.from({ length: 100 }, (_, i) => i)).length, 40);
  assert.equal(sanitizeFacts(Infinity), null);
});

test("the rate limit keys on the platform-set address, not a client-sent header", () => {
  const mk = (xff, real) => ({ headers: { "x-forwarded-for": xff, "x-vercel-forwarded-for": real }, socket: {} });
  for (let i = 0; i < 20; i++) assert.equal(rateLimited(mk(`9.9.9.${i}`, "7.7.7.7")), false);
  assert.equal(rateLimited(mk("1.2.3.4", "7.7.7.7")), true);
});
