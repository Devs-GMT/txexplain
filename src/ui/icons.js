import { html } from "./html.js";

// Our own status marks, drawn as strokes so they can draw themselves in. pathLength="1" lets CSS animate any of them with one dash value.
const mark = (d) => html`<svg class="ico" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path pathLength="1" d="${d}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export const iconCheck = mark("M3.5 8.6 6.7 11.6 12.6 4.7");
export const iconCross = mark("M4.4 4.4 11.6 11.6M11.6 4.4 4.4 11.6");
export const iconWait = mark("M8 4.2V8l2.6 1.6");
