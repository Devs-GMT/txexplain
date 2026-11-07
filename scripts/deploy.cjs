// Usage: npx hardhat run scripts/deploy.cjs --network botTestnet
// Mainnet (--network botMainnet) only after the wallet holds BOT for gas.
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) throw new Error("Set DEPLOYER_PRIVATE_KEY in .env");

  const { chainId } = await hre.ethers.provider.getNetwork();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`chain ${chainId}, deployer ${deployer.address}, balance ${hre.ethers.formatEther(balance)} BOT`);
  if (balance === 0n) throw new Error("Deployer has 0 BOT, cannot pay for gas");

  const notes = await (await hre.ethers.getContractFactory("DebugNotes")).deploy();
  const tx = notes.deploymentTransaction();
  console.log(`deploy tx ${tx.hash}`);
  await notes.waitForDeployment();
  console.log(`DebugNotes at ${await notes.getAddress()}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
