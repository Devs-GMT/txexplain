# Demo video, 90 seconds

Built from the PRD: the clip follows **failed transaction, reason, fix, note**, ends on the project links, and goes out in the X post that tags @BOTChain_ai. Target 88 seconds, 1920x1080, 30 fps, captions only.

## Rules taken from the PRD and the project

- Everything on screen is a recording of the live app. No invented numbers, names or transactions.
- Example transactions keep their "Example" chip on screen.
- The AI summary is shown as the app wrote it, with its "AI summary from decoded data" label. One take, not re-rolled for a better sentence.
- Motion matches the site: transform and opacity only, the summary types in with an amber cursor, hex text scrambles into words. No decorative effects.
- Same look as the site: ink `#0B0C0E`, amber `#FF8A1F`, success `#2ECC8F`, fail `#FF5A5F`, Satoshi headlines, Doto for the "machine voice" lines.
- Copy is short and concrete. No emoji, no middle dots, none of the banned marketing words.
- The note shown at the end is a real note already saved on-chain. A wallet signing a new one is not recorded, because the wallet pop-up is outside the page.

## Scenes

| Time | Scene | On screen | Caption |
| --- | --- | --- | --- |
| 0:00-0:05 | Hook | Hex rows drift on the dark ground. The question types in with the amber cursor. | Why did my transaction fail? |
| 0:05-0:14 | Problem | The Raw tab of the failed example: calldata and logs, scrolling slowly. | This is what the chain gives you. |
| 0:14-0:30 | Paste | The failed hash is typed into the box. Explain is pressed. The four steps tick one by one, a 0:03 timer runs. | Paste the hash. |
| 0:30-0:46 | Reason | "Failed" status card, then "Why it failed": Custom error AuthorCannotVote, and "What to try". | The reason, in plain words. |
| 0:46-0:58 | Summary | The AI summary types in. The "AI summary from decoded data" chip stays visible. | Written from decoded facts only. |
| 0:58-1:10 | Fix and note | The Debug notes card of that transaction, then the "This fix worked" counter. | Fixed it? Leave a note. |
| 1:10-1:20 | Mainnet | The mainnet deployment transaction: Success, BOT Chain Mainnet, cost. Then the footer card with the DebugNotes contract. | Live on BOT Chain mainnet. |
| 1:20-1:28 | Close | Slogan, then the links. A small line: "AI explanations are based on decoded data. Double-check important transactions." | Read the chain. Skip the hex. |

Closing links: txexplain.vercel.app, @TxExplain, github.com/Devs-GMT/txexplain, tag @BOTChain_ai.

## Transitions

- Between scenes: a 0.3 s cross-fade with a 12 px upward slide (opacity and transform only).
- Scene 1 to 2 and 7 to 8: the last text scrambles through hex characters and settles into the next caption.
- Captions slide up 16 px and fade in, hold, fade out. One caption at a time, eight words at most.
- Zoom: slow push-in of 4 percent over the length of a scene, only on scenes 4, 5 and 7 to draw the eye to the card.
- No hard cuts to black, no spins, no wipes.

## Audio

No voice. Optional quiet track with no lyrics, only if it is royalty-free; otherwise silent. X plays video muted by default, so the captions carry it.

## Build

1. Record each scene from the live site with Chrome automation into 1280x720 clips (retina scale).
2. Compose in Remotion: clips, captions, transitions, timer and the closing card.
3. Render one MP4 for X, and export a still of scene 4 as a check against the thumbnail.
