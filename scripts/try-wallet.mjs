// End-to-end check of src/lib/notes.js write paths on testnet 968 without a browser.
// A fake window.ethereum (EIP-1193) signs with real keys, so saveNote/markWorked run the same code as the site.
// It spends a little testnet BOT and adds one note (with one vote) to the failed example tx on every run;
// hide extra copies afterwards with setHidden as the curator.
// Run: node scripts/try-wallet.mjs
import dotenv from "dotenv";
import { JsonRpcProvider, Wallet, parseEther } from "ethers";
import { CHAINS, EXAMPLE_TXS } from "../src/config.js";

dotenv.config({ quiet: true });

const rpc = new JsonRpcProvider(CHAINS[968].rpc, 968, { staticNetwork: true });

function injected(wallet) {
  const w = wallet.connect(rpc);
  return {
    async request({ method, params = [] }) {
      if (method === "eth_requestAccounts" || method === "eth_accounts") return [w.address];
      if (method === "wallet_switchEthereumChain") {
        if (parseInt(params[0].chainId, 16) !== 968) throw Object.assign(new Error("unknown chain"), { code: 4902 });
        return null;
      }
      if (method === "eth_sendTransaction") {
        const { to, data, value } = params[0];
        return (await w.sendTransaction({ to, data, value })).hash;
      }
      return rpc.send(method, params);
    },
  };
}

const deployer = new Wallet(process.env.DEPLOYER_PRIVATE_KEY);
const voter = Wallet.createRandom();

// Fund the voter from the deployer with plain ethers; this part is test setup, not the code under test.
await (await deployer.connect(rpc).sendTransaction({ to: voter.address, value: parseEther("0.05") })).wait();

const { saveNote, markWorked, readNotes, readStats, readLatestNote } = await import("../src/lib/notes.js");
const target = EXAMPLE_TXS.outOfGas;

globalThis.window = { ethereum: injected(deployer) };
const saved = await saveNote(968, target, 0, "Raise the gas limit above 70000 and send it again.");
console.log("saved note", saved);

globalThis.window = { ethereum: injected(voter) };
console.log("vote", await markWorked(968, saved.id));

const notes = await readNotes(968, target, voter.address);
console.log("notes for tx", notes);
console.log("stats", await readStats(968));
console.log("latest", await readLatestNote(968));

try {
  await markWorked(968, saved.id);
} catch (e) {
  console.log("second vote refused:", e.code, "-", e.message);
}
