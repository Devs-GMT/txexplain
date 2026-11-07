const { expect } = require("chai");
const { ethers } = require("hardhat");

const HASH = ethers.id("some tx");
const TAG_FIX = 0;

async function expectCustomError(promise, contract, name) {
  try {
    await promise;
  } catch (e) {
    const decoded = contract.interface.parseError(e.data);
    expect(decoded && decoded.name).to.equal(name);
    return;
  }
  throw new Error(`expected revert with ${name}`);
}

async function eventOf(tx, contract, name) {
  const receipt = await (await tx).wait();
  for (const log of receipt.logs) {
    const parsed = contract.interface.parseLog(log);
    if (parsed && parsed.name === name) return parsed.args;
  }
  throw new Error(`event ${name} not emitted`);
}

describe("DebugNotes", () => {
  let notes, curator, alice, bob, carol;

  beforeEach(async () => {
    [curator, alice, bob, carol] = await ethers.getSigners();
    notes = await (await ethers.getContractFactory("DebugNotes")).deploy();
  });

  it("sets the deployer as curator", async () => {
    expect(await notes.curator()).to.equal(curator.address);
  });

  it("stores a note and lists it for its tx", async () => {
    const added = await eventOf(notes.connect(alice).addNote(HASH, 677, TAG_FIX, "Raise the gas limit"), notes, "NoteAdded");
    expect([added.id, added.txHash, added.author, added.tag]).to.deep.equal([0n, HASH, alice.address, 0n]);
    const list = await notes.getNotes(HASH);
    expect(list.length).to.equal(1);
    expect(list[0].text).to.equal("Raise the gas limit");
    expect(list[0].author).to.equal(alice.address);
    expect(list[0].chainId).to.equal(677n);
    expect(await notes.getNotes(ethers.id("other"))).to.have.length(0);
  });

  it("returns the ids of a tx's notes so they can be voted on", async () => {
    await notes.connect(alice).addNote(ethers.id("a"), 677, 0, "first");
    await notes.connect(alice).addNote(HASH, 677, 0, "second");
    await notes.connect(bob).addNote(HASH, 677, 1, "third");
    expect((await notes.getNoteIds(HASH)).map(Number)).to.deep.equal([1, 2]);
    expect(await notes.getNoteIds(ethers.id("none"))).to.have.length(0);
  });

  it("rejects empty text, text over 280 bytes and unknown tags", async () => {
    await expectCustomError(notes.addNote(HASH, 677, 0, ""), notes, "EmptyText");
    await expectCustomError(notes.addNote(HASH, 677, 0, "a".repeat(281)), notes, "TextTooLong");
    await expectCustomError(notes.addNote(HASH, 677, 3, "x"), notes, "BadTag");
    await notes.addNote(HASH, 677, 0, "a".repeat(280));
  });

  it("counts one vote per wallet and blocks the author", async () => {
    await notes.connect(alice).addNote(HASH, 677, TAG_FIX, "Fix");
    await expectCustomError(notes.connect(alice).markWorked(0), notes, "AuthorCannotVote");
    const worked = await eventOf(notes.connect(bob).markWorked(0), notes, "Worked");
    expect([worked.id, worked.by, worked.count]).to.deep.equal([0n, bob.address, 1n]);
    await expectCustomError(notes.connect(bob).markWorked(0), notes, "AlreadyVoted");
    await notes.connect(carol).markWorked(0);
    expect((await notes.getNote(0)).worked).to.equal(2n);
    expect(await notes.workedBy(0, bob.address)).to.equal(true);
    expect(await notes.workedBy(0, curator.address)).to.equal(false);
  });

  it("reverts on a missing note", async () => {
    await expectCustomError(notes.markWorked(5), notes, "NoSuchNote");
    await expectCustomError(notes.getNote(0), notes, "NoSuchNote");
  });

  it("lets only the curator hide a note, and hidden notes take no votes", async () => {
    await notes.connect(alice).addNote(HASH, 677, 2, "spam");
    await expectCustomError(notes.connect(alice).setHidden(0, true), notes, "NotCurator");
    await notes.setHidden(0, true);
    expect((await notes.getNote(0)).hidden).to.equal(true);
    await expectCustomError(notes.connect(bob).markWorked(0), notes, "NoteHidden");
    await notes.setHidden(0, false);
    await notes.connect(bob).markWorked(0);
  });

  it("returns recent notes newest first with paging", async () => {
    for (let i = 0; i < 5; i++) await notes.connect(alice).addNote(HASH, 677, 1, `n${i}`);
    const page1 = await notes.recentNotes(0, 2);
    expect(page1.map((n) => n.text)).to.deep.equal(["n4", "n3"]);
    const page2 = await notes.recentNotes(2, 10);
    expect(page2.map((n) => n.text)).to.deep.equal(["n2", "n1", "n0"]);
    expect(await notes.recentNotes(5, 3)).to.have.length(0);
  });

  it("reports note and vote totals", async () => {
    await notes.connect(alice).addNote(HASH, 677, 0, "a");
    await notes.connect(alice).addNote(HASH, 677, 0, "b");
    await notes.connect(bob).markWorked(0);
    await notes.connect(carol).markWorked(0);
    await notes.connect(bob).markWorked(1);
    const [noteCount, workedCount] = await notes.stats();
    expect(noteCount).to.equal(2n);
    expect(workedCount).to.equal(3n);
  });
});
