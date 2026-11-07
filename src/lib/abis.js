import { Interface } from "ethers";

// Order matters: ERC-20 and ERC-721 share some selectors (approve, transferFrom); the first match wins.
const sources = {
  "ERC-20": [
    "function transfer(address to, uint256 value) returns (bool)",
    "function approve(address spender, uint256 value) returns (bool)",
    "function transferFrom(address from, address to, uint256 value) returns (bool)",
    "event Transfer(address indexed from, address indexed to, uint256 value)",
    "event Approval(address indexed owner, address indexed spender, uint256 value)",
    "error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed)",
    "error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed)",
  ],
  "ERC-721": [
    "function safeTransferFrom(address from, address to, uint256 tokenId)",
    "function safeTransferFrom(address from, address to, uint256 tokenId, bytes data)",
    "function setApprovalForAll(address operator, bool approved)",
    "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
    "event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)",
    "event ApprovalForAll(address indexed owner, address indexed operator, bool approved)",
  ],
  Ownable: [
    "function transferOwnership(address newOwner)",
    "function renounceOwnership()",
    "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)",
    "error OwnableUnauthorizedAccount(address account)",
    "error OwnableInvalidOwner(address owner)",
  ],
  DebugNotes: [
    "function addNote(bytes32 txHash, uint32 chainId, uint8 tag, string text) returns (uint256 id)",
    "function markWorked(uint256 id)",
    "function setHidden(uint256 id, bool hidden)",
    "event NoteAdded(uint256 indexed id, bytes32 indexed txHash, address indexed author, uint8 tag)",
    "event Worked(uint256 indexed id, address indexed by, uint32 count)",
    "event Hidden(uint256 indexed id, bool hidden)",
    "error EmptyText()",
    "error TextTooLong()",
    "error BadTag()",
    "error NoSuchNote()",
    "error NoteHidden()",
    "error AuthorCannotVote()",
    "error AlreadyVoted()",
    "error NotCurator()",
  ],
};

export const BUNDLED_ABIS = Object.entries(sources).map(([name, fragments]) => ({
  name,
  iface: new Interface(fragments),
}));

/// Accepts a plain ABI array or a Hardhat/Remix artifact ({ abi: [...] }), as JSON text or parsed.
export function parseUserAbi(input) {
  const parsed = typeof input === "string" ? JSON.parse(input) : input;
  const abi = Array.isArray(parsed) ? parsed : parsed?.abi;
  if (!Array.isArray(abi)) throw new Error("ABI must be a JSON array or an artifact with an abi field");
  return { name: "your ABI", iface: new Interface(abi) };
}
