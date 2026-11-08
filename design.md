# TxExplain design system

Source of truth for colour and type is `src/styles/tokens.css`. The product brief (PRD section 8) and giga.ai set the direction. This file records the decisions so a new page does not drift.

## 1. Visual theme
A dark, confident developer-tool site. Flat graphite surfaces, hairline borders, one amber accent. Motion explains the product (typing, decoding, a failed call shaking), it does not decorate.

## 2. Colour roles
- Paper `#0B0C0E`, cards `#131519`, raised `#1A1D23`, rule `#24272E`
- Ink `#F2F3F5`, muted `#8E939C`
- Accent `#FF8A1F` (primary buttons, cursor, active tab, links on dark). Text on accent is paper.
- Success `#2ECC8F`, failure `#FF5A5F`, info `#5AA9FF`. Explanation cards carry a thin (2px) status-coloured top border, as the PRD asks. Status marks are our own stroked SVG icons (check, cross, wait) that draw themselves in; no text glyphs.

## 3. Typography
- Display: Satoshi 900 for the hero and closing lines, 700 for section headings, tight tracking.
- Body: Inter 400, 500 and 600 (single-storey a, open digits).
- Hashes, selectors, values, labels that name data: JetBrains Mono 400 and 500, slashed zero.
- Dot-matrix (Doto 700) is the machine voice: the decoded sentence, the failure reason, the Success/Failed status in the app. Headlines stay Satoshi.
- Section labels start with a small amber square and are numbered mono (01 Try it, 02 Live ...), a giga.ai pattern the PRD keeps.
- The eyebrow above the hero is mono, uppercase, tracked (a giga.ai pattern the PRD keeps).

## 4. Components
- Buttons are pills. One amber primary per screen, ghost outline for the rest. Heights 40 to 52px.
- Switch (tabs): pill track, the chosen option amber with a soft glow. Arrow keys move between tabs.
- Field: pill, mono text, an amber ring and glow on focus.
- Card: `#131519`, 1px rule, 14px radius, no shadow. Cards that invite a look carry `data-spot`: an amber light follows the pointer, the border turns amber, the card lifts 3px.
- Tooltip: a "?" button opens a one-sentence box on hover, focus or tap.

## 5. Layout
- Container 1440px, 64px gutters (24 at tablet, 16 at phone). Sections are separated by 120 to 176px of space.
- Hero: headline, one sentence, two actions on the left; the live widget on the right.
- The tour pins on wide screens and stacks as five cards below 60rem.

## 5b. Hero
Warm wash at the top (orange to rust, three tokens `--heat-*`) that fades to the graphite page as the hero scrolls away. Headline left, one sentence right, then a two-part deck: a dark screen and a graphite panel with a rotary selector for the example type.

## 6. Pointer and motion
- Hex field behind the hero and the closing line: characters are pushed aside and lit amber by the pointer, change to another character as they wake, and a click sends a ripple.
- Headline letters slide away from the pointer and swell, then spring back.
- Cards lean toward the pointer (up to 6 degrees) with a glint of light where it is. The hero widget leans 3 degrees.
- Primary buttons drift toward the pointer when it is near. A soft amber light trails the pointer across the page.
- How it works is a canvas: four bundles of fine lines run into one node, small lights travel along them, and the bundles lean toward the pointer.
- Read a real one is a canvas too: each recent mainnet transaction is a dot orbiting its group, backing away from the pointer, glowing on hover, opening the explainer on click.
- In the app, hex shuffles while the chain is read and settles into the real hash, results arrive in sequence, the gas bar fills and the gas number counts up.
- All of it needs a fine pointer and no reduced-motion preference; otherwise the page is static and complete.

## 6b. Depth
Flat. The only glows are the active switch tab, the focused field and a faint ambient glow behind the hero widget.

## 7. Do and don't
- Do keep copy short and concrete. Label every sample "Example".
- Don't invent numbers, quotes or logos. Don't use eyebrows anywhere but the hero, middle dots, or text glyphs and emoji as icons.
- Don't animate width, height, top or left. Transform and opacity only.

## 8. Responsive
Desktop first. 60rem: one column, the tour stacks, the pipe diagram becomes a list. 40rem: forms wrap, cards go single column. `prefers-reduced-motion` turns off typing, scramble, pinning, marquee and flow lines; every state is then shown at once.

## 8b. Security
Headers live in `vercel.json`. CSP allows scripts from self only and connects only to the two BOT Chain RPCs and /api. Chain text is always escaped. The AI endpoint treats the facts it receives as untrusted data.

## 9. Test it
`npm run test:e2e` runs Playwright in the installed Chrome at 1280 and 390px: the hero widget, tabs, form errors, the tour, the hex strip, tooltips, pointer effects (letters, hex field, card tilt, bending lines), horizontal overflow, layout shift under 0.1, and reduced motion.
