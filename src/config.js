// Single source for chain and contract constants. Mainnet address stays null until the mainnet deploy.
export const CHAINS = {
  677: { name: "BOT Chain Mainnet", rpc: "https://rpc.botchain.ai", explorer: "https://scan.botchain.ai" },
  968: { name: "BOT Chain Testnet", rpc: "https://rpc.bohr.life", explorer: "https://scan.bohr.life" },
};

export const DEBUG_NOTES = {
  677: "0xbA69870c74E127351C23498084f1d04f6C61DF41",
  968: "0xFa7b17eB7989DbF7A2D90a583A25d5Ad9e764b7d",
};

// Example transactions on testnet 968, created by scripts/examples.cjs (transfer by scripts/example-token.cjs). Shown on the site labelled "Example".
export const EXAMPLE_TXS = {
  success: "0x64b96febcb0e93f2fa86b2abfb7646d8e017968bd29595855182ab208d2f9f29",
  outOfGas: "0x79010ee0b1ec1099b1a31038a43b08bed3576be66468c5de9c8b306bf4a1aa2f",
  customError: "0x1116720cc578b3a700f7c03336a6a58e79c6ab1cb8d388cd75722f2e433696a9",
  transfer: "0x2cb56449eeb22fc281b411f2e2e99962d2e26ee63e7dfe906ef06fae1b4b2dd5", // 10 USDT, ERC-20 Transfer
  nativeTransfer: "0xaf8a8784a59b0a76dd6cfadaa68596d8def0a01f59a97b7d6a35673be542529d", // 0.001 BOT, no token
};

// Faucet USDT on testnet. Not ours; used only as the token in the transfer example.
export const TESTNET_USDT = { address: "0x75edC9335175Fc0552D51D48439F229c10420fe3", symbol: "USDT", decimals: 6 };

// The footer card explains the latest note on mainnet; until mainnet exists it reads testnet and says so.
export const FOOTER_CHAIN = DEBUG_NOTES[677] ? 677 : 968;

export const LINKS = {
  botchain: "https://botchain.ai",
  botchainDocs: "https://dev-docs.botchain.ai/docs/intro/",
  faucet: "https://faucet.botchain.ai/basic",
  x: "https://x.com/TxExplain",
  github: "https://github.com/Devs-GMT/txexplain",
};
