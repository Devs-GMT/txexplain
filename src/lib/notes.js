import { Contract, Interface } from "ethers";
import { DEBUG_NOTES } from "../config.js";
import { getProvider } from "./rpc.js";
import { describeWalletError, signerFor } from "./wallet.js";

const NOTE = "tuple(address author, bytes32 txHash, uint32 chainId, uint8 tag, string text, uint32 worked, uint64 at, bool hidden)";
const ABI = [
  "function addNote(bytes32 txHash, uint32 chainId, uint8 tag, string text) returns (uint256 id)",
  "function markWorked(uint256 id)",
  "function getNoteIds(bytes32 txHash) view returns (uint256[])",
  `function getNote(uint256 id) view returns (${NOTE})`,
  `function recentNotes(uint256 from, uint256 count) view returns (${NOTE}[])`,
  "function stats() view returns (uint256 noteCount, uint256 workedCount)",
  "function workedBy(uint256 id, address who) view returns (bool)",
  "event NoteAdded(uint256 indexed id, bytes32 indexed txHash, address indexed author, uint8 tag)",
  "error EmptyText()",
  "error TextTooLong()",
  "error BadTag()",
  "error NoSuchNote()",
  "error NoteHidden()",
  "error AuthorCannotVote()",
  "error AlreadyVoted()",
];

// What the contract's custom errors mean to someone holding a wallet.
const REVERT_MESSAGES = {
  EmptyText: "Write a note first.",
  TextTooLong: "That note is too long. The limit is 280 bytes.",
  BadTag: "Pick Fix, Explanation or Warning.",
  NoSuchNote: "That note does not exist.",
  NoteHidden: "That note was hidden by the curator.",
  AuthorCannotVote: "You can't mark your own note as worked.",
  AlreadyVoted: "You already marked this note as worked.",
};

const iface = new Interface(ABI);

// On the send path ethers gives the raw revert bytes in e.data and leaves e.revert empty,
// and wallets nest the same bytes under error.data, so look in all three places.
function revertName(e) {
  if (e?.revert?.name) return e.revert.name;
  const data = [e?.data, e?.error?.data, e?.info?.error?.data].find((d) => typeof d === "string" && d.startsWith("0x"));
  return data ? iface.parseError(data)?.name : undefined;
}

function friendly(e) {
  const message = REVERT_MESSAGES[revertName(e)];
  return describeWalletError(message ? { ...e, code: "REVERTED", message } : e);
}

export const TAGS = ["Fix", "Explanation", "Warning"];
export const MAX_NOTE_BYTES = 280;

/// Notes need a deployed DebugNotes on that chain; mainnet stays off until it is deployed.
export const notesAvailable = (chainId) => Boolean(DEBUG_NOTES[chainId]);

const reader = (chainId) => new Contract(DEBUG_NOTES[chainId], ABI, getProvider(chainId));

// Positional, not n.at: a named field called "at" collides with Array.prototype.at on ethers results.
const shape = (n, id) => {
  const [author, txHash, chainId, tag, text, worked, at, hidden] = n;
  return { id, author, txHash, chainId: Number(chainId), tag: Number(tag), tagName: TAGS[Number(tag)], text, worked: Number(worked), at: Number(at), hidden };
};

/// Visible notes for a tx. `viewer` (a wallet address) adds workedByViewer so the 👍 can show as already given.
export async function readNotes(chainId, txHash, viewer) {
  const c = reader(chainId);
  const ids = (await c.getNoteIds(txHash)).map(Number);
  const notes = await Promise.all(
    ids.map(async (id) => ({
      ...shape(await c.getNote(id), id),
      workedByViewer: viewer ? await c.workedBy(id, viewer) : false,
    })),
  );
  return notes.filter((n) => !n.hidden);
}

export async function readStats(chainId) {
  const [notes, worked] = await reader(chainId).stats();
  return { notes: Number(notes), worked: Number(worked) };
}

/// The newest note on the contract, or null before the first one. Feeds the footer card.
export async function readLatestNote(chainId) {
  const c = reader(chainId);
  const [latest] = await c.recentNotes(0, 1);
  if (!latest) return null;
  const { notes } = await readStats(chainId);
  return shape(latest, notes - 1);
}

export const noteByteLength = (text) => new TextEncoder().encode(text).length;

export async function saveNote(chainId, txHash, tag, text) {
  const trimmed = text.trim();
  if (!trimmed) throw describeWalletError({ message: "Write a note first." });
  if (noteByteLength(trimmed) > MAX_NOTE_BYTES) throw describeWalletError({ message: `Notes are limited to ${MAX_NOTE_BYTES} bytes.` });
  try {
    const signer = await signerFor(chainId);
    const c = new Contract(DEBUG_NOTES[chainId], ABI, signer);
    const receipt = await (await c.addNote(txHash, chainId, tag, trimmed)).wait();
    const added = receipt.logs.map((l) => c.interface.parseLog(l)).find((l) => l?.name === "NoteAdded");
    return { id: Number(added.args.id), hash: receipt.hash };
  } catch (e) {
    throw friendly(e);
  }
}

export async function markWorked(chainId, id) {
  try {
    const signer = await signerFor(chainId);
    const receipt = await (await new Contract(DEBUG_NOTES[chainId], ABI, signer).markWorked(id)).wait();
    return { hash: receipt.hash };
  } catch (e) {
    throw friendly(e);
  }
}
