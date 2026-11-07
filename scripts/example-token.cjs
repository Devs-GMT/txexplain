// Sends 10 testnet USDT to a throwaway address so the site has a real ERC-20 Transfer to explain.
// npx hardhat run scripts/example-token.cjs --network botTestnet
const hre = require("hardhat");
const USDT_968 = "0x75edC9335175Fc0552D51D48439F229c10420fe3";

async function main() {
  const [me] = await hre.ethers.getSigners();
  const abi = ["function transfer(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"];
  const usdt = new hre.ethers.Contract(USDT_968, abi, me);
  const to = hre.ethers.Wallet.createRandom().address;
  const tx = await usdt.transfer(to, 10_000_000n); // 10 USDT at 6 decimals
  const r = await tx.wait();
  console.log(JSON.stringify({ tokenTransfer: r.hash, to, status: r.status, gasUsed: String(r.gasUsed) }, null, 2));
  console.log("balance after", String(await usdt.balanceOf(me.address)));
}
main().catch((e) => { console.error(e.message); process.exitCode = 1; });
