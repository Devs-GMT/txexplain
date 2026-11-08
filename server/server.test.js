import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { verifySummary } from "./verify.js";
import { promptFacts } from "./explain-ai.js";
import { checkOrigin } from "./guards.js";
import sig from "../api/sig.js";
import explain from "../api/explain.js";

const HASH = "0x" + "ab".repeat(32);
const facts = {
  hash: HASH,
  chainId: 968,
  status: "failed",
  from: "0xA2887B451AfEF13248b73dCd78A2623421b58C4C",
  gas: { limit: "70000", used: "70000", costBot: "0.0014" },
  revert: { kind: "out-of-gas", message: "Used all 70000 gas it was given" },
  events: [{ index: 0, address: "0x1", abi: null, name: null, raw: { topics: ["0xdead"], data: "0x" } }],
  fixes: ["Raise the gas limit above 70000"],
};

function mockRes() {
  const res = { code: 200, headers: {}, body: undefined };
  res.status = (c) => ((res.code = c), res);
  res.json = (b) => ((res.body = b), res);
  res.end = () => res;
  res.setHeader = (k, v) => (res.headers[k] = v);
  return res;
}
const req = (over = {}) => ({ method: "POST", headers: { host: "app.test", "content-type": "application/json" }, query: {}, body: {}, socket: { remoteAddress: "1.1.1.1" }, ...over });

let realFetch;
beforeEach(() => { realFetch = globalThis.fetch; });
afterEach(() => { globalThis.fetch = realFetch; delete process.env.GROQ_API_KEY; delete process.env.ALLOWED_ORIGINS; });

test("verify: accepts a summary whose numbers and addresses are all in the facts", () => {
  const r = verifySummary({ summary: "0xA288…8C4C ran out of gas: it used 70000 of 70000. Cost 0.0014 BOT.", fixes: ["Raise the gas limit above 70000"] }, facts);
  assert.equal(r.ok, true);
});

test("verify: rejects an invented amount", () => {
  const r = verifySummary({ summary: "It cost 0.0021 BOT in gas.", fixes: [] }, facts);
  assert.equal(r.ok, false);
  assert.match(r.reason, /0\.0021/);
});

test("verify: rejects an address that is not in the facts", () => {
  const r = verifySummary({ summary: "It was sent to 0x9f3c1b2a.", fixes: [] }, facts);
  assert.equal(r.ok, false);
});

test("verify: small counts are allowed, empty or malformed output is not", () => {
  assert.equal(verifySummary({ summary: "It emitted 2 events.", fixes: [] }, facts).ok, true);
  assert.equal(verifySummary({ summary: "", fixes: [] }, facts).ok, false);
  assert.equal(verifySummary(null, facts).ok, false);
});

test("promptFacts drops raw log bytes", () => {
  const p = promptFacts(facts);
  assert.equal(JSON.stringify(p).includes("0xdead"), false);
  assert.equal(p.network, "BOT Chain Testnet");
});

test("origin: same host passes, other origins need the allow list", () => {
  assert.equal(checkOrigin({ headers: { host: "app.test", origin: "https://app.test" } }), true);
  assert.equal(checkOrigin({ headers: { host: "app.test", origin: "https://evil.test" } }), false);
  process.env.ALLOWED_ORIGINS = "http://localhost:5173";
  assert.equal(checkOrigin({ headers: { host: "app.test", origin: "http://localhost:5173" } }), true);
});

test("sig: validates the selector, sorts oldest first, returns at most 5", async () => {
  const bad = mockRes();
  await sig(req({ method: "GET", query: { selector: "0x12" } }), bad);
  assert.equal(bad.code, 400);

  globalThis.fetch = async () => ({ ok: true, json: async () => ({ results: [
    { id: 9, text_signature: "workMyDirefulOwner(uint256,uint256)" },
    { id: 1, text_signature: "transfer(address,uint256)" },
  ] }) });
  const res = mockRes();
  await sig(req({ method: "GET", query: { selector: "0xa9059cbb" } }), res);
  assert.deepEqual(res.body.signatures, ["transfer(address,uint256)", "workMyDirefulOwner(uint256,uint256)"]);
});

test("explain: rejects non-POST, bad body, missing key", async () => {
  let res = mockRes();
  await explain(req({ method: "GET" }), res);
  assert.equal(res.code, 405);
  res = mockRes();
  await explain(req({ body: { facts: { hash: "nope" } } }), res);
  assert.equal(res.code, 400);
  res = mockRes();
  await explain(req({ body: { facts } }), res);
  assert.equal(res.code, 503);
});

test("explain: returns a verified summary and sends the model the facts only", async () => {
  process.env.GROQ_API_KEY = "test-key";
  let sent;
  globalThis.fetch = async (url, init) => {
    sent = JSON.parse(init.body);
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ summary: "It ran out of gas after using 70000.", fixes: ["Raise the gas limit above 70000"] }) } }] }) };
  };
  const res = mockRes();
  await explain(req({ body: { facts } }), res);
  assert.equal(res.code, 200);
  assert.match(res.body.summary, /70000/);
  assert.equal(sent.messages[1].content.includes("0xdead"), false);
});

const groqReply = (summary) => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ summary, fixes: [] }) } }] }) });

test("explain: a made-up number is retried once, then dropped", async () => {
  process.env.GROQ_API_KEY = "test-key";
  let calls = 0;
  globalThis.fetch = async () => (calls++, groqReply("It cost 9.87 BOT."));
  const res = mockRes();
  await explain(req({ body: { facts } }), res);
  assert.equal(calls, 2);
  assert.equal(res.code, 200);
  assert.equal(res.body.summary, null);
  assert.match(res.body.rejected, /9\.87/);
});

test("explain: the retry tells the model what was wrong and a fixed answer is accepted", async () => {
  process.env.GROQ_API_KEY = "test-key";
  const bodies = [];
  globalThis.fetch = async (url, init) => {
    bodies.push(JSON.parse(init.body));
    return groqReply(bodies.length === 1 ? "It cost 9.87 BOT." : "It cost 0.0014 BOT.");
  };
  const res = mockRes();
  await explain(req({ body: { facts } }), res);
  assert.equal(res.body.summary, "It cost 0.0014 BOT.");
  const last = bodies[1].messages.at(-1).content;
  assert.match(last, /rejected: number not in facts: 9\.87/);
});

test("verify: a rounded decimal passes, an invented one and a wrong integer do not", () => {
  const f = { gas: { costBot: "0.00104304", limit: "52942" }, amount: "10.0" };
  assert.equal(verifySummary({ summary: "It cost 0.001 BOT.", fixes: [] }, f).ok, true);
  assert.equal(verifySummary({ summary: "It cost 0.0010 BOT.", fixes: [] }, f).ok, true);
  assert.equal(verifySummary({ summary: "It cost 0.002 BOT.", fixes: [] }, f).ok, false);
  assert.equal(verifySummary({ summary: "The limit was 53000.", fixes: [] }, f).ok, false);
});

test("explain: an upstream failure is a 502 with no detail", async () => {
  process.env.GROQ_API_KEY = "test-key";
  globalThis.fetch = async () => ({ ok: false, status: 500 });
  const res = mockRes();
  await explain(req({ body: { facts } }), res);
  assert.equal(res.code, 502);
  assert.deepEqual(res.body, { error: "summary unavailable" });
});
