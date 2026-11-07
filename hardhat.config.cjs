require("@nomicfoundation/hardhat-ethers");
require("dotenv").config();

// Key comes from .env (gitignored). Without it, only the local network works.
const accounts = process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [];

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: { evmVersion: "paris", optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    botTestnet: { url: "https://rpc.bohr.life", chainId: 968, accounts },
    botMainnet: { url: "https://rpc.botchain.ai", chainId: 677, accounts },
  },
};
