# TxExplain

Paste a BOT Chain transaction hash and get a plain-English explanation of what happened: the call, the events, why it failed, and what to try next. You can also leave a note on a transaction through the `DebugNotes` contract.

Works on BOT Chain mainnet (chain 677) and testnet (chain 968).

## How it works

1. The browser reads the transaction, receipt and logs straight from the public BOT Chain RPC.
2. It decodes the call and events (function selectors, known ABIs, a pasted ABI, or a signature lookup through `/api/sig`, backed by 4byte.directory).
3. For failed transactions it replays the call to recover the revert reason and maps it to a few fixes.
4. `/api/explain` sends only the decoded facts to Groq (`openai/gpt-oss-120b`) for a short summary. A verifier drops any summary that contains a number or hex string that is not in the facts, and a template summary is used instead.

The AI never sees raw user input beyond the decoded facts, and it is told to treat them as data.

## Run it

```bash
npm install
cp .env.example .env          # only needed for contract deploys
echo GROQ_API_KEY=... > .dev.vars   # only needed for AI summaries
npm run dev                   # http://localhost:5173
```

Without a Groq key the app still works and uses the template summary.

| Command | What it does |
| --- | --- |
| `npm test` | Contract tests (Hardhat) and library and server unit tests. The library tests call the real RPC. |
| `npm run test:offline` | Server tests only, no network. |
| `npm run test:e2e` | Playwright against dev and a production build. Needs Google Chrome installed. |
| `npm run build` | Production build into `dist/`. |

Testnet RPC (`rpc.bohr.life`) may need a VPN depending on your network.

## Contracts

`contracts/DebugNotes.sol` stores a short note and a tag against a transaction hash. The address for each chain is in one place, `src/config.js` (`DEBUG_NOTES`).

| Chain | Address |
| --- | --- |
| Testnet 968 | `0xFa7b17eB7989DbF7A2D90a583A25d5Ad9e764b7d` |
| Mainnet 677 | Not deployed yet |

Deploy with `npx hardhat run scripts/deploy.cjs --network botTestnet` (or `botMainnet`) using a fresh wallet in `.env`.

## Deploy

Hosted on Vercel. Set `GROQ_API_KEY` as a project secret. Optional: `GROQ_MODEL`, `ALLOWED_ORIGINS`. Security headers and the CSP are in `vercel.json`.

## Limits

- Replaying a failed transaction for its revert reason needs an RPC that keeps state for old blocks. On the public RPC, older transactions may show the status without a reason.
- Rate limits on `/api/*` are kept in memory per serverless instance, so they are a speed bump, not a hard cap.
- Event and function names come from the verified ABIs the app knows, a pasted ABI, or signature lookup. Unknown calls are shown as raw selectors.
- The examples on the site are labelled as examples. The transaction feed is live data from mainnet.
- Wallet signing was tested on desktop MetaMask only.

## Layout

```
contracts/   DebugNotes.sol
api/         Vercel functions (explain, sig)
server/      Shared server code and its tests
src/lib/     Decoding, revert recovery, fixes, notes, wallet
src/site/    Landing page
src/app/     Explain page (/tx/<hash>)
design.md    Design system
```
