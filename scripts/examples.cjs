// Creates the example transactions shown on the site. Run once on testnet:
// npx hardhat run scripts/examples.cjs --network botTestnet
const hre = require("hardhat");

async function main() {
  const { DEBUG_NOTES } = await import("../src/config.js"); // one place for the address
  const [me] = await hre.ethers.getSigners();
  const notes = await hre.ethers.getContractAt("DebugNotes", DEBUG_NOTES[968], me);
  const target = hre.ethers.id("example failed tx");
  const out = {};

  // gasLimit is forced on the failing calls, otherwise estimateGas refuses to send them.
  let tx = await notes.addNote(target, 968, 1, "Example note: this transaction ran out of gas.");
  out.success = (await tx.wait()).hash;

  tx = await notes.addNote(target, 968, 0, "Raise the gas limit.", { gasLimit: 70000 });
  out.outOfGas = (await tx.wait().catch((e) => e.receipt)).hash;

  tx = await notes.markWorked(0, { gasLimit: 100000 });
  out.customError = (await tx.wait().catch((e) => e.receipt)).hash;

  tx = await me.sendTransaction({ to: hre.ethers.Wallet.createRandom().address, value: hre.ethers.parseEther("0.001") });
  out.nativeTransfer = (await tx.wait()).hash;

  console.log(JSON.stringify(out, null, 2));
  console.log("stats", (await notes.stats()).map(String));
}
main().catch((e) => { console.error(e.message); process.exitCode = 1; });
