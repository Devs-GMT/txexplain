// Manual check against the real Groq API: explains each example tx and prints what the server would return.
// Needs GROQ_API_KEY in .dev.vars. Run: node scripts/try-ai.mjs
import dotenv from "dotenv";
import { EXAMPLE_TXS } from "../src/config.js";
import { explainTx } from "../src/lib/explain.js";
import explain from "../api/explain.js";

dotenv.config({ path: ".dev.vars", quiet: true });

for (const [name, hash] of Object.entries(EXAMPLE_TXS)) {
  const facts = await explainTx(hash);
  const res = { code: 200, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, setHeader() {} };
  await explain({ method: "POST", headers: { host: "x" }, socket: {}, body: { facts } }, res);
  console.log(`\n[${name}] ${res.code}`);
  console.log(JSON.stringify(res.body, null, 2));
}
