import { reducedMotion } from "../ui/type.js";

// Every recent mainnet transaction as one dot. Colour is what it did, size is its gas limit, and each group has its own
// patch of the canvas. Point at a dot and it holds still while the space around it bulges like a lens, and the other dots
// from the same sender are joined to it. Click opens the explainer. The list under the scene is the accessible version.
const GROUPS = [
  { key: "call", label: "Other calls", color: "--color-ink-2", at: [0.5, 0.6], s: [0.17, 0.16] },
  { key: "token", label: "Token moves", color: "--color-success", at: [0.3, 0.24], s: [0.1, 0.09] },
  { key: "transfer", label: "BOT transfers", color: "--color-accent", at: [0.12, 0.5], s: [0.06, 0.12] },
  { key: "approve", label: "Approvals", color: "--color-info", at: [0.86, 0.3], s: [0.06, 0.1] },
  { key: "deploy", label: "Deployments", color: "--color-error", at: [0.9, 0.82], s: [0.04, 0.07] },
];
const TOKEN = new Set(["0xa9059cbb", "0x23b872dd", "0x40c10f19"]);
const TOP = 44;
const LENS = 86; // reach of the bulge, in pixels
const GLOW = 2; // the glow reaches this many radii from the centre; the dot itself stays crisp
const HOLD = 26; // how far the pointer can drift from a held dot before it lets go

export const groupOf = (tx) => (tx.to === null ? "deploy" : tx.input === "0x" ? "transfer" : tx.input.startsWith("0x095ea7b3") ? "approve" : TOKEN.has(tx.input.slice(0, 10)) ? "token" : "call");

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// The same transaction always lands in the same place, so the scene does not reshuffle on every refresh.
function seeded(hash) {
  let a = parseInt(hash.slice(2, 10), 16) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r) => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());

/// Size grows with the gas limit, on a log scale: a plain transfer (21,000) is small, a heavy contract call is several times larger.
export const radiusFor = (gas) => (1.8 + Math.min(4.2, Math.log2(1 + gas / 21000) * 0.9)) * 0.85;

export function createScene(canvas, tip, describe) {
  const ctx = canvas.getContext("2d");
  const colors = Object.fromEntries(GROUPS.map((g) => [g.key, css(g.color)]));
  const font = css("--font-outlier");
  const muted = css("--color-muted");
  const ink = css("--color-ink");
  const ink2 = css("--color-ink-2");
  const plate = css("--color-paper");
  let dots = [];
  let motes = [];
  let counts = {};
  let w = 0;
  let h = 0;
  let dpr = 1;
  let raf = 0;
  let visible = false;
  const sprites = new Map();
  // A dot is its colour filled solid, then cut by a mask whose opacity falls away smoothly. Masking keeps the colour clean
  // all the way to the edge, with no grey fringe and no visible ring where the glow ends.
  function sprite(key, rad) {
    const id = `${key}:${Math.round(rad * 4)}:${dpr}`;
    if (sprites.has(id)) return sprites.get(id);
    const R = rad * GLOW;
    const px = Math.ceil(R * 2 * dpr);
    const c = document.createElement("canvas");
    c.width = c.height = px;
    const g = c.getContext("2d");
    g.fillStyle = colors[key];
    g.fillRect(0, 0, px, px);
    g.globalCompositeOperation = "destination-in";
    const m = g.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2);
    // Solid out to the dot's own radius, a short anti-aliased edge, then a faint tail. Fractions are of the glow reach.
    for (const [t, al] of [[0, 1], [0.5, 1], [0.58, 0.85], [0.72, 0.3], [0.88, 0.08], [1, 0]]) m.addColorStop(t, `rgba(0,0,0,${al})`);
    g.fillStyle = m;
    g.fillRect(0, 0, px, px);
    sprites.set(id, c);
    return c;
  }
  let held = null; // the dot under the pointer; it stops moving while held
  let lens = 0;
  const pointer = { x: -9999, y: -9999 };
  const still = reducedMotion();

  function resize() {
    dpr = Math.min(2, devicePixelRatio || 1);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    draw(performance.now());
  }

  function update(txs) {
    const known = new Map(dots.map((d) => [d.tx.hash, d]));
    counts = {};
    dots = txs.map((tx) => {
      const key = groupOf(tx);
      counts[key] = (counts[key] ?? 0) + 1;
      const old = known.get(tx.hash);
      if (old) return old;
      const g = GROUPS.find((x) => x.key === key);
      const r = seeded(tx.hash);
      const gas = Number(BigInt(tx.gas ?? 21000));
      return {
        tx, key, gas,
        u: Math.min(0.97, Math.max(0.03, g.at[0] + gauss(r) * g.s[0])),
        v: Math.min(0.96, Math.max(0.04, g.at[1] + gauss(r) * g.s[1])),
        rad: radiusFor(gas),
        f1: 0.2 + r() * 0.4, f2: 0.13 + r() * 0.3, p1: r() * 6.28, p2: r() * 6.28, amp: 5 + r() * 9,
        x: 0, y: 0, born: performance.now(),
      };
    });
    // Large dots first, so the small ones are never hidden behind them.
    dots.sort((a, b) => b.rad - a.rad);
    if (!motes.length) {
      const r = seeded("0x" + "9e3779b9");
      motes = Array.from({ length: 70 }, () => ({ u: r(), v: r(), a: 0.05 + r() * 0.14, s: 0.6 + r() * 0.9, p: r() * 6.28 }));
    }
    held = null;
    canvas.dataset.count = String(dots.length);
    wake();
    return counts;
  }

  function home(d, t) {
    const s = t / 1000;
    const wob = still ? 0 : 1;
    return [
      d.u * w + (Math.sin(s * d.f1 + d.p1) + 0.5 * Math.sin(s * d.f2 * 2.3 + d.p2)) * d.amp * wob,
      TOP + d.v * (h - TOP - 16) + (Math.cos(s * d.f2 + d.p2) + 0.5 * Math.sin(s * d.f1 * 1.9 + d.p1)) * d.amp * wob,
    ];
  }

  function draw(t) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    for (const m of motes) {
      ctx.globalAlpha = m.a * (still ? 1 : 0.6 + 0.4 * Math.sin(t / 1400 + m.p));
      ctx.fillStyle = muted;
      ctx.beginPath();
      ctx.arc(m.u * w, TOP + m.v * (h - TOP), m.s, 0, Math.PI * 2);
      ctx.fill();
    }

    // Where each dot would be on its own.
    for (const d of dots) [d.bx, d.by] = home(d, t);

    // A held dot keeps the place it had when it was caught.
    if (held && Math.hypot(held.x - pointer.x, held.y - pointer.y) > HOLD) held = null;
    if (held) {
      held.bx = held.hx;
      held.by = held.hy;
    }

    // The lens: dots near the held one are pushed outward, strongest close in, so the space around it looks bulged.
    lens += ((held ? 1 : 0) - lens) * 0.16;
    for (const d of dots) {
      d.x = d.bx;
      d.y = d.by;
      if (held && d !== held && lens > 0.01) {
        const dx = d.bx - held.hx;
        const dy = d.by - held.hy;
        const r = Math.hypot(dx, dy);
        if (r < LENS && r > 0.01) {
          const mapped = LENS * (r / LENS) ** 0.62;
          const push = (mapped - r) * lens;
          d.x = d.bx + (dx / r) * push;
          d.y = d.by + (dy / r) * push;
          d.mag = 1 + 0.35 * (1 - r / LENS) * lens;
          continue;
        }
      }
      d.mag = 1;
    }

    // Choose what is under the pointer, using the places the dots are drawn.
    if (!held) {
      let best = 14;
      for (const d of dots) {
        const dist = Math.hypot(d.x - pointer.x, d.y - pointer.y);
        if (dist < best + d.rad * 0.5) {
          best = dist;
          held = d;
        }
      }
      if (held) {
        held.hx = held.x;
        held.hy = held.y;
        held.x = held.hx;
        held.y = held.hy;
      }
    }

    // Dots from the same sender, joined to the held one.
    if (held) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = colors[held.key];
      for (const d of dots) {
        if (d !== held && d.tx.from === held.tx.from) {
          ctx.globalAlpha = 0.55;
          ctx.beginPath();
          ctx.moveTo(held.hx, held.hy);
          ctx.lineTo(d.x, d.y);
          ctx.stroke();
        }
      }
    }

    // Each dot is a soft glow with a solid core. The sprite is drawn once per colour and size, then stamped.
    for (const d of dots) {
      const age = Math.min(1, (t - d.born) / 700);
      const same = held && d.tx.from === held.tx.from;
      const scale = (d === held ? 1.3 : d.mag) * age;
      const R = d.rad * GLOW * scale;
      ctx.globalAlpha = d === held || same ? 1 : 0.92;
      const sp = sprite(d.key, d.rad);
      ctx.drawImage(sp, d.x - R, d.y - R, R * 2, R * 2);
      if (age < 1) {
        ctx.globalAlpha = 0.45 * (1 - age);
        ctx.strokeStyle = colors[d.key];
        ctx.beginPath();
        ctx.arc(d.x, d.y, 4 + age * 30, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Each patch is named where it sits, on a small dark plate so a dot passing behind never hides the words.
    ctx.font = `500 11px ${font}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (const g of GROUPS) {
      if (!counts[g.key]) continue;
      const text = `${g.label.toUpperCase()}  ${counts[g.key]}`;
      const tw = ctx.measureText(text).width;
      const bx = Math.min(w - tw - 22, Math.max(8, g.at[0] * w - tw / 2 - 7));
      const by = Math.max(TOP + 6, TOP + Math.max(0.04, g.at[1] - g.s[1] * 2.1) * (h - TOP - 16));
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = plate;
      ctx.beginPath();
      ctx.roundRect(bx, by - 10, tw + 14, 20, 10);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = ink2;
      ctx.fillText(text, bx + 7, by + 0.5);
    }
    ctx.restore();

    canvas.style.cursor = held ? "pointer" : "default";
    if (held) {
      tip.hidden = false;
      tip.innerHTML = "";
      describe(tip, held.tx, colors[held.key], dots.filter((d) => d.tx.from === held.tx.from).length, held.gas);
      tip.style.transform = `translate(${Math.min(w - 250, Math.max(8, held.hx + 16 + held.rad))}px, ${held.hy < 160 ? held.hy + 22 : Math.max(8, held.hy - 80)}px)`;
    } else tip.hidden = true;
  }

  function frame(t) {
    raf = 0;
    draw(t);
    if (visible && !still) raf = requestAnimationFrame(frame);
  }
  function wake() {
    if (!raf && (visible || still)) raf = requestAnimationFrame(frame);
  }

  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = e.clientX - r.left;
    pointer.y = e.clientY - r.top;
    wake();
  });
  canvas.addEventListener("pointerleave", () => {
    pointer.x = pointer.y = -9999;
    held = null;
    wake();
  });
  canvas.addEventListener("click", () => {
    if (held) location.href = `/tx/${held.tx.hash}`;
  });
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) wake();
  }).observe(canvas);
  resize();

  return { update, groups: GROUPS, colors };
}
