import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { EXAMPLE_TXS } from "../config.js";
import { describeWalletError, ensureChain, signerFor, WalletError, shortAddress } from "./wallet.js";
import { aiSummary, sigLookup, summarize } from "./api.js";
import { templateSummary } from "./template-summary.js";
import { explainTx } from "./explain.js";
import { noteByteLength, notesAvailable, readNotes, saveNote } from "./notes.js";

let realFetch;
beforeEach(() => { realFetch = globalThis.fetch; });
afterEach(() => {
  globalThis.fetch = realFetch;
  delete globalThis.window;
  delete globalThis.localStorage;
});

test("wallet errors map to the PRD messages", () => {
  assert.equal(describeWalletError({ code: 4001 }).code, "rejected");
  assert.equal(describeWalletError({ code: "ACTION_REJECTED" }).code, "rejected");
  assert.equal(describeWalletError({ code: -32002 }).code, "pending-request");
  assert.equal(describeWalletError({ code: "INSUFFICIENT_FUNDS" }).code, "no-gas");
  assert.equal(describeWalletError(new Error("boom")).message, "boom");
  const already = new WalletError("x", "y");
  assert.equal(describeWalletError(already), already);
  assert.equal(shortAddress("0xA2887B451AfEF13248b73dCd78A2623421b58C4C"), "0xA288…8C4C");
});

test("no wallet installed gives a no-wallet error", async () => {
  await assert.rejects(signerFor(968), (e) => e.code === "no-wallet");
});

test("ensureChain adds BOT Chain when the wallet does not know it", async () => {
  const calls = [];
  globalThis.window = { ethereum: { request: async (r) => {
    calls.push(r);
    if (r.method === "wallet_switchEthereumChain") throw { code: 4902 };
    return null;
  } } };
  await ensureChain(677);
  assert.deepEqual(calls.map((c) => c.method), ["wallet_switchEthereumChain", "wallet_addEthereumChain"]);
  const add = calls[1].params[0];
  assert.equal(add.chainId, "0x2a5");
  assert.equal(add.rpcUrls[0], "https://rpc.botchain.ai");
  assert.equal(add.nativeCurrency.symbol, "BOT");
});

test("ensureChain rethrows other wallet errors", async () => {
  globalThis.window = { ethereum: { request: async () => { throw { code: 4001 }; } } };
  await assert.rejects(ensureChain(677), (e) => e.code === 4001);
});

test("sigLookup returns [] on any failure", async () => {
  globalThis.fetch = async () => ({ ok: false });
  assert.deepEqual(await sigLookup("0xa9059cbb"), []);
  globalThis.fetch = async () => { throw new Error("offline"); };
  assert.deepEqual(await sigLookup("0xa9059cbb"), []);
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ signatures: ["transfer(address,uint256)"] }) });
  assert.deepEqual(await sigLookup("0xa9059cbb"), ["transfer(address,uint256)"]);
});

test("aiSummary caches settled results by hash, skips pending ones, and drops rejected answers", async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  let calls = 0;
  globalThis.fetch = async () => { calls++; return { ok: true, json: async () => ({ summary: "ok", fixes: [] }) }; };

  const settled = { hash: "0x" + "11".repeat(32), status: "success" };
  assert.equal((await aiSummary(settled)).summary, "ok");
  await aiSummary(settled);
  assert.equal(calls, 1);

  const pending = { hash: "0x" + "22".repeat(32), status: "pending" };
  await aiSummary(pending);
  await aiSummary(pending);
  assert.equal(calls, 3);

  globalThis.fetch = async () => ({ ok: true, json: async () => ({ summary: null, rejected: "number not in facts" }) });
  assert.equal(await aiSummary({ hash: "0x" + "33".repeat(32), status: "success" }), null);
});

test("saveNote validates before touching the wallet", async () => {
  await assert.rejects(saveNote(968, EXAMPLE_TXS.outOfGas, 0, "   "), /Write a note first/);
  await assert.rejects(saveNote(968, EXAMPLE_TXS.outOfGas, 0, "a".repeat(281)), /limited to 280/);
  assert.equal(noteByteLength("é"), 2);
});

test("notes: available on testnet only until mainnet is deployed", () => {
  assert.equal(notesAvailable(968), true);
  assert.equal(notesAvailable(677), false);
});

test("readNotes returns the visible note on the failed example tx, with a real timestamp", async () => {
  const notes = await readNotes(968, EXAMPLE_TXS.outOfGas);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].tagName, "Fix");
  assert.ok(notes[0].at > 1_700_000_000);
  assert.equal(notes[0].hidden, false);
});

test("summarize falls back to the template when the API fails or rejects the answer", async () => {
  const facts = {
    hash: "0x" + "44".repeat(32), status: "success", from: "0xA2887B451AfEF13248b73dCd78A2623421b58C4C",
    to: "0xFa7b17eB7989DbF7A2D90a583A25d5Ad9e764b7d", contractName: "DebugNotes", valueBot: "0.0", block: 7,
    call: { name: "addNote" }, transfers: [], gas: { costBot: "0.0046" }, fixes: [],
  };
  globalThis.fetch = async () => ({ ok: false });
  const down = await summarize(facts);
  assert.equal(down.source, "template");
  assert.equal(down.summary, "0xA288…8C4C called addNote on DebugNotes. It succeeded in block 7. It cost 0.0046 BOT in gas.");

  globalThis.fetch = async () => ({ ok: true, json: async () => ({ summary: null }) });
  assert.equal((await summarize(facts)).source, "template");

  globalThis.fetch = async () => ({ ok: true, json: async () => ({ summary: "From the AI.", fixes: [] }) });
  assert.equal((await summarize(facts)).source, "ai");
});

test("template summary covers every example transaction using only decoded facts", async () => {
  const { EXAMPLE_TXS } = await import("../config.js");
  const out = {};
  for (const [name, hash] of Object.entries(EXAMPLE_TXS)) out[name] = templateSummary(await explainTx(hash));
  assert.match(out.success, /called addNote on DebugNotes\. It succeeded in block \d+\. It cost [\d.]+ BOT in gas\./);
  assert.match(out.outOfGas, /It failed: Used all 70000 gas it was given\./);
  assert.match(out.customError, /It failed: Custom error AuthorCannotVote\./);
  assert.match(out.transfer, /It moved 10\.0 USDT from 0xA288…8C4C to 0xe143…74Cb\./);
  assert.match(out.nativeTransfer, /sent 0\.001 BOT to 0x/);
});
