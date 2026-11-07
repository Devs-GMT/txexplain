// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// Public debug notes attached to transaction hashes, with a one-per-wallet
/// "this fix worked" vote. No tokens, no payments.
contract DebugNotes {
    uint8 public constant TAG_FIX = 0;
    uint8 public constant TAG_EXPLANATION = 1;
    uint8 public constant TAG_WARNING = 2;
    uint256 public constant MAX_TEXT_BYTES = 280;

    struct Note {
        address author;
        bytes32 txHash;
        uint32 chainId;
        uint8 tag;
        string text;
        uint32 worked;
        uint64 at;
        bool hidden;
    }

    Note[] public notes;
    mapping(bytes32 => uint256[]) private notesForTx;
    mapping(uint256 => mapping(address => bool)) public workedBy;
    address public curator;
    uint256 public totalWorked;

    event NoteAdded(uint256 indexed id, bytes32 indexed txHash, address indexed author, uint8 tag);
    event Worked(uint256 indexed id, address indexed by, uint32 count);
    event Hidden(uint256 indexed id, bool hidden);

    error EmptyText();
    error TextTooLong();
    error BadTag();
    error NoSuchNote();
    error NoteHidden();
    error AuthorCannotVote();
    error AlreadyVoted();
    error NotCurator();

    constructor() {
        curator = msg.sender;
    }

    // The length limit is in bytes, so a note with non-ASCII text holds fewer than 280 characters.
    function addNote(bytes32 txHash, uint32 chainId, uint8 tag, string calldata text)
        external
        returns (uint256 id)
    {
        uint256 len = bytes(text).length;
        if (len == 0) revert EmptyText();
        if (len > MAX_TEXT_BYTES) revert TextTooLong();
        if (tag > TAG_WARNING) revert BadTag();

        id = notes.length;
        notes.push(Note(msg.sender, txHash, chainId, tag, text, 0, uint64(block.timestamp), false));
        notesForTx[txHash].push(id);
        emit NoteAdded(id, txHash, msg.sender, tag);
    }

    function markWorked(uint256 id) external {
        if (id >= notes.length) revert NoSuchNote();
        Note storage n = notes[id];
        if (n.hidden) revert NoteHidden();
        if (n.author == msg.sender) revert AuthorCannotVote();
        if (workedBy[id][msg.sender]) revert AlreadyVoted();

        workedBy[id][msg.sender] = true;
        n.worked += 1;
        totalWorked += 1;
        emit Worked(id, msg.sender, n.worked);
    }

    function setHidden(uint256 id, bool hidden) external {
        if (msg.sender != curator) revert NotCurator();
        if (id >= notes.length) revert NoSuchNote();
        notes[id].hidden = hidden;
        emit Hidden(id, hidden);
    }

    function getNote(uint256 id) external view returns (Note memory) {
        if (id >= notes.length) revert NoSuchNote();
        return notes[id];
    }

    /// Ids are what markWorked needs; getNotes returns the notes themselves without them.
    function getNoteIds(bytes32 txHash) external view returns (uint256[] memory) {
        return notesForTx[txHash];
    }

    /// Includes hidden notes; the caller filters on `hidden`.
    function getNotes(bytes32 txHash) external view returns (Note[] memory out) {
        uint256[] storage ids = notesForTx[txHash];
        out = new Note[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            out[i] = notes[ids[i]];
        }
    }

    /// Newest first. `from` is how many of the newest notes to skip.
    function recentNotes(uint256 from, uint256 count) external view returns (Note[] memory out) {
        uint256 total = notes.length;
        if (from >= total) return new Note[](0);
        uint256 n = total - from;
        if (count < n) n = count;
        out = new Note[](n);
        for (uint256 i = 0; i < n; i++) {
            out[i] = notes[total - 1 - from - i];
        }
    }

    function stats() external view returns (uint256 noteCount, uint256 workedCount) {
        return (notes.length, totalWorked);
    }
}
