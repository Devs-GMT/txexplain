import { test } from "node:test";
import assert from "node:assert/strict";
import Prism from "prismjs";
import "prismjs/components/prism-json.js";
import { parseUserAbi } from "./abis.js";

test("the raw view never turns chain text into markup", () => {
  const raw = { input: "</code><img src=x onerror=alert(1)>", note: "<script>alert(1)</script>" };
  const out = Prism.highlight(JSON.stringify(raw, null, 2), Prism.languages.json, "json");
  assert.equal(out.includes("<img"), false);
  assert.equal(out.includes("<script"), false);
  assert.ok(out.includes("&lt;img"));
});

test("a pasted ABI is bounded before it is parsed", () => {
  assert.throws(() => parseUserAbi("[" + " ".repeat(700_000) + "]"), /too large/);
  assert.throws(() => parseUserAbi(JSON.stringify(Array.from({ length: 3100 }, () => ({ type: "function", name: "f", inputs: [], outputs: [] })))), /too many/);
  assert.ok(parseUserAbi('[{"type":"function","name":"boom","inputs":[],"outputs":[]}]').iface);
});
