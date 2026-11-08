import gsap from "gsap";
import { reducedMotion } from "../ui/type.js";

const finePointer = () => matchMedia("(pointer: fine)").matches;
const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/// A field of hex characters behind a section. The pointer pushes them aside and lights them amber, a click sends a ripple through,
/// and each one that wakes up changes to another character, as if the chain were being read. It only runs while something is moving.
export function initHexField(host) {
  const canvas = host.querySelector(".hexfield");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const CHARS = "0123456789abcdef";
  const STEP_X = 30;
  const STEP_Y = 36;
  const REACH = 105;
  // On the warm hero the characters are light; elsewhere they are grey and light up amber.
  const light = host.dataset.hex === "light";
  const muted = token(light ? "--color-ink" : "--color-muted");
  const accent = token(light ? "--color-ink" : "--color-accent");
  const font = token("--font-outlier");
  let w = 0;
  let h = 0;
  let dpr = 1;
  let glyphs = [];
  let raf = 0;
  let visible = true;
  const pointer = { x: -9999, y: -9999, on: false };
  const ripples = [];

  function build() {
    dpr = Math.min(2, devicePixelRatio || 1);
    w = host.clientWidth;
    h = host.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    glyphs = [];
    for (let y = STEP_Y / 2; y < h; y += STEP_Y) {
      for (let x = STEP_X / 2; x < w; x += STEP_X) glyphs.push({ x, y, ox: 0, oy: 0, vx: 0, vy: 0, heat: 0, c: CHARS[(Math.random() * 16) | 0] });
    }
    draw();
  }

  function step(now) {
    let moving = pointer.on || ripples.length > 0;
    for (let i = ripples.length - 1; i >= 0; i--) if (now - ripples[i].t0 > 1500) ripples.splice(i, 1);
    for (const g of glyphs) {
      let tx = 0;
      let ty = 0;
      let heat = 0;
      const dx = g.x - pointer.x;
      const dy = g.y - pointer.y;
      const d = Math.hypot(dx, dy);
      if (pointer.on && d < REACH) {
        const f = (1 - d / REACH) ** 2;
        tx += (dx / (d || 1)) * f * 29;
        ty += (dy / (d || 1)) * f * 29;
        heat = Math.max(heat, 1 - d / REACH);
      }
      for (const r of ripples) {
        const age = (now - r.t0) / 1000;
        const rd = Math.hypot(g.x - r.x, g.y - r.y);
        const gap = Math.abs(rd - age * 460);
        if (gap < 70) {
          const a = (1 - gap / 70) * Math.max(0, 1 - age / 1.5);
          tx += ((g.x - r.x) / (rd || 1)) * a * 22;
          ty += ((g.y - r.y) / (rd || 1)) * a * 22;
          heat = Math.max(heat, a);
        }
      }
      g.vx = (g.vx + (tx - g.ox) * 0.16) * 0.74;
      g.vy = (g.vy + (ty - g.oy) * 0.16) * 0.74;
      g.ox += g.vx;
      g.oy += g.vy;
      const wasCold = g.heat < 0.35;
      g.heat += (heat - g.heat) * (heat > g.heat ? 0.45 : 0.05);
      if (wasCold && g.heat >= 0.35) g.c = CHARS[(Math.random() * 16) | 0];
      if (Math.abs(g.ox) > 0.05 || Math.abs(g.oy) > 0.05 || g.heat > 0.01) moving = true;
    }
    return moving;
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${12 * dpr}px ${font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = muted;
    ctx.globalAlpha = light ? 0.12 : 0.1;
    for (const g of glyphs) if (g.heat < 0.04) ctx.fillText(g.c, (g.x + g.ox) * dpr, (g.y + g.oy) * dpr);
    ctx.fillStyle = accent;
    for (const g of glyphs) {
      if (g.heat < 0.04) continue;
      ctx.globalAlpha = 0.12 + g.heat * 0.8;
      ctx.fillText(g.c, (g.x + g.ox) * dpr, (g.y + g.oy) * dpr);
    }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    raf = 0;
    const moving = step(now);
    draw();
    if (moving && visible) raf = requestAnimationFrame(frame);
  }
  const wake = () => {
    if (!raf && visible) raf = requestAnimationFrame(frame);
  };

  new ResizeObserver(build).observe(host);
  build();
  if (reducedMotion()) return;
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) wake();
  }).observe(host);

  const place = (e) => {
    const r = host.getBoundingClientRect();
    pointer.x = e.clientX - r.left;
    pointer.y = e.clientY - r.top;
  };
  host.addEventListener("pointermove", (e) => {
    place(e);
    pointer.on = true;
    wake();
  });
  host.addEventListener("pointerleave", () => {
    pointer.on = false;
    wake();
  });
  host.addEventListener("pointerdown", (e) => {
    place(e);
    ripples.push({ x: pointer.x, y: pointer.y, t0: performance.now() });
    wake();
  });
}

/// After the headline has typed, every letter is its own piece. Letters near the pointer slide away from it and swell,
/// then spring back when it leaves.
export function initHeadline(title, host) {
  if (reducedMotion() || !finePointer()) return;
  const text = title.textContent;
  title.textContent = "";
  for (const word of text.split(" ")) {
    const w = document.createElement("span");
    w.className = "word";
    for (const c of word) {
      const s = document.createElement("span");
      s.className = "ch";
      s.textContent = c;
      w.append(s);
    }
    title.append(w, " ");
  }
  const chars = [...title.querySelectorAll(".ch")];
  let centres = [];
  const measure = () => {
    centres = chars.map((el) => {
      const r = el.getBoundingClientRect();
      return { el, x: r.left + r.width / 2 + scrollX, y: r.top + r.height / 2 + scrollY, on: false };
    });
  };
  measure();
  addEventListener("resize", measure);
  const REACH = 155;
  let queued = null;
  const apply = () => {
    const e = queued;
    queued = null;
    const px = e.clientX + scrollX;
    const py = e.clientY + scrollY;
    for (const c of centres) {
      const dx = c.x - px;
      const dy = c.y - py;
      const d = Math.hypot(dx, dy);
      if (d < REACH) {
        const s = (1 - d / REACH) ** 1.6;
        c.on = true;
        gsap.to(c.el, { x: (dx / (d || 1)) * s * 24, y: (dy / (d || 1)) * s * 24, scale: 1 + s * 0.12, duration: 0.45, ease: "power3.out", overwrite: "auto" });
      } else if (c.on) {
        c.on = false;
        gsap.to(c.el, { x: 0, y: 0, scale: 1, duration: 0.9, ease: "elastic.out(1, 0.5)", overwrite: "auto" });
      }
    }
  };
  host.addEventListener("pointermove", (e) => {
    if (!queued) requestAnimationFrame(apply);
    queued = e;
  });
  host.addEventListener("pointerleave", () => {
    centres.forEach((c) => {
      c.on = false;
      gsap.to(c.el, { x: 0, y: 0, scale: 1, duration: 0.9, ease: "elastic.out(1, 0.5)", overwrite: "auto" });
    });
  });
}

/// Cards lean toward the pointer and catch a glint of light where it is. The light is two custom properties, so no layout work happens.
export function initTilt(root = document) {
  if (reducedMotion() || !finePointer()) return;
  root.querySelectorAll("[data-spot]").forEach((card) => {
    const max = Number(card.dataset.tilt ?? 5);
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
      gsap.to(card, { rotationY: (px - 0.5) * max * 2, rotationX: -(py - 0.5) * max * 2, y: -3, transformPerspective: 900, duration: 0.4, ease: "power2.out", overwrite: "auto" });
    });
    card.addEventListener("pointerleave", () => {
      gsap.to(card, { rotationX: 0, rotationY: 0, y: 0, duration: 0.8, ease: "elastic.out(1, 0.6)", overwrite: "auto" });
    });
  });
}

/// Buttons drift toward the pointer when it comes close, and settle back when it leaves.
export function initMagnet() {
  if (reducedMotion() || !finePointer()) return;
  const items = [...document.querySelectorAll("[data-magnet]")];
  if (!items.length) return;
  let queued = null;
  const apply = () => {
    const e = queued;
    queued = null;
    for (const el of items) {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const near = Math.abs(dx) < r.width / 2 + 70 && Math.abs(dy) < r.height / 2 + 70;
      if (near) {
        el._m = true;
        gsap.to(el, { x: Math.max(-12, Math.min(12, dx * 0.25)), y: Math.max(-8, Math.min(8, dy * 0.3)), duration: 0.35, ease: "power2.out", overwrite: "auto" });
      } else if (el._m) {
        el._m = false;
        gsap.to(el, { x: 0, y: 0, duration: 0.8, ease: "elastic.out(1, 0.5)", overwrite: "auto" });
      }
    }
  };
  addEventListener("pointermove", (e) => {
    if (!queued) requestAnimationFrame(apply);
    queued = e;
  });
}

/// A soft amber light trails the pointer across the page, behind everything.
export function initCursorGlow() {
  if (reducedMotion() || !finePointer()) return;
  const glow = document.createElement("div");
  glow.className = "cursor-glow";
  glow.setAttribute("aria-hidden", "true");
  document.body.append(glow);
  const mx = gsap.quickTo(glow, "x", { duration: 0.16, ease: "power3.out" });
  const my = gsap.quickTo(glow, "y", { duration: 0.16, ease: "power3.out" });
  addEventListener("pointermove", (e) => {
    glow.style.opacity = "1";
    mx(e.clientX);
    my(e.clientY);
  });
  document.addEventListener("pointerleave", () => { glow.style.opacity = "0"; });
}
