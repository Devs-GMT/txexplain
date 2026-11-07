// Runs against the real testnet 968 example transactions, so it needs the RPC to be reachable.
import { test } from "node:test";
import assert from "node:assert/strict";
import { AbiCoder, formatEther } from "ethers";
import { EXAMPLE_TXS } from "../config.js";
import { explainTx, isTxHash } from "./explain.js";
import { decodeRevertData } from "./revert.js";
import { BUNDLED_ABIS, parseUserAbi } from "./abis.js";

test("isTxHash accepts 32-byte hashes only", () => {
  assert.equal(isTxHash(EXAMPLE_TXS.success), true);
  assert.equal(isTxHash("0x1234"), false);
  assert.equal(isTxHash("hello"), false);
});

test("decodeRevertData: Error(string)", () => {
  const body = AbiCoder.defaultAbiCoder().encode(["string"], ["Not the owner"]);
  const r = decodeRevertData("0x08c379a0" + body.slice(2), BUNDLED_ABIS);
  assert.deepEqual([r.kind, r.message], ["error", "Not the owner"]);
});

test("decodeRevertData: Panic(0x11) and empty data", () => {
  const body = AbiCoder.defaultAbiCoder().encode(["uint256"], [0x11]);
  const p = decodeRevertData("0x4e487b71" + body.slice(2), BUNDLED_ABIS);
  assert.deepEqual([p.kind, p.code], ["panic", "0x11"]);
  assert.match(p.message, /arithmetic/);
  assert.equal(decodeRevertData("0x", BUNDLED_ABIS).kind, "empty");
});

test("decodeRevertData: custom error from a bundled ABI, unknown selector otherwise", () => {
  const known = BUNDLED_ABIS.find((a) => a.name === "DebugNotes").iface.getError("NotCurator").selector;
  assert.equal(decodeRevertData(known, BUNDLED_ABIS).name, "NotCurator");
  assert.equal(decodeRevertData("0xdeadbeef", BUNDLED_ABIS).kind, "unknown");
});

test("parseUserAbi takes an array or an artifact", () => {
  const abi = ["function ping()"];
  assert.equal(parseUserAbi(JSON.stringify([{ type: "function", name: "ping", inputs: [], outputs: [], stateMutability: "nonpayable" }])).name, "your ABI");
  assert.throws(() => parseUserAbi({ nope: abi }));
});

test("successful addNote: decoded call, event, contract name, cost", async () => {
  const f = await explainTx(EXAMPLE_TXS.success);
  assert.equal(f.status, "success");
  assert.equal(f.chainId, 968);
  assert.equal(f.contractName, "DebugNotes");
  assert.equal(f.call.name, "addNote");
  assert.equal(f.call.abi, "DebugNotes");
  assert.equal(f.call.inputs.find((i) => i.name === "chainId").value, "968");
  assert.equal(f.events[0].name, "NoteAdded");
  assert.equal(f.revert, null);
  assert.equal(f.gas.costBot, formatEther(BigInt(f.gas.used) * BigInt(f.gas.price)));
  assert.ok(Number(f.gas.costBot) > 0);
});

test("out of gas: used equals limit, fix says to raise it", async () => {
  const f = await explainTx(EXAMPLE_TXS.outOfGas);
  assert.equal(f.status, "failed");
  assert.equal(f.gas.used, f.gas.limit);
  assert.equal(f.revert.kind, "out-of-gas");
  assert.match(f.fixes[0], /Raise the gas limit above 70000/);
});

test("custom error is recovered by replaying the call", async () => {
  const f = await explainTx(EXAMPLE_TXS.customError);
  assert.equal(f.status, "failed");
  assert.equal(f.revert.kind, "custom");
  assert.equal(f.revert.name, "AuthorCannotVote");
  assert.deepEqual(f.fixes, ["Mark the note as worked from a different wallet than the one that wrote it"]);
});

test("ERC-20 transfer: token symbol and human amount", async () => {
  const f = await explainTx(EXAMPLE_TXS.transfer);
  assert.equal(f.transfers.length, 1);
  assert.equal(f.transfers[0].symbol, "USDT");
  assert.equal(f.transfers[0].amount, "10.0");
  assert.equal(f.call.name, "transfer");
});

test("plain BOT transfer: value moved, no call", async () => {
  const f = await explainTx(EXAMPLE_TXS.nativeTransfer);
  assert.equal(f.valueBot, "0.001");
  assert.equal(f.call, null);
  assert.equal(f.transfers.length, 0);
});

test("unknown hash returns null", async () => {
  assert.equal(await explainTx("0x" + "ab".repeat(32)), null);
});

test("contract creation: deployed address and bytecode size", async () => {
  const f = await explainTx("0xf8857d1f36baace3ed3a8e2067a71ad43aa9effdd93d2d22dda639849a40ee6d");
  assert.equal(f.to, null);
  assert.equal(f.created.address, "0xFa7b17eB7989DbF7A2D90a583A25d5Ad9e764b7d");
  assert.ok(f.created.bytecodeBytes > 1000);
  assert.equal(f.call, null);
});
