import { reducedMotion } from "../ui/type.js";

// "How it works": each of four sources is a comb of dots that sends out a fan of fine lines, and the fans run into one node.
// The dots and lines undulate like cloth. Point at a source and it goes still and brightens, so you can read it.
// Lines are drawn additively and then faded at the source end, so the colour blends smoothly instead of showing edges.
const LINES = 14;
const STEPS = 56;
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function initPipe() {
  const canvas = document.querySelector(".pipe-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const pipe = canvas.closest(".pipe");
  const accent = css("--color-accent");
  const warm = css("--color-focus");
  const still = reducedMotion();
  let w = 0;
  let h = 0;
  let dpr = 1;
  let srcY = [];
  let endY = 0;
  let raf = 0;
  let visible = false;
  let lights = [];
  const calm = [];
  const pointer = { x: -999, y: -999, lean: 0, want: 0 };

  function measure() {
    if (!canvas.offsetParent) return;
    dpr = Math.min(2, devicePixelRatio || 1);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const top = canvas.getBoundingClientRect().top;
    srcY = [...pipe.querySelectorAll(".pipe-in li")].map((li) => li.getBoundingClientRect().top + li.offsetHeight / 2 - top);
    const node = pipe.querySelector(".pipe-node--facts");
    endY = node.getBoundingClientRect().top + node.offsetHeight / 2 - top;
    srcY.forEach((_, i) => (calm[i] ??= { v: 0, want: 0 }));
    lights = srcY.flatMap((_, s) => Array.from({ length: 5 }, () => ({ s, l: (Math.random() * LINES) | 0, t: Math.random(), v: 0.07 + Math.random() * 0.1 })));
    draw(0);
  }

  const bez = (p0, p1, p2, p3, t) => {
    const u = 1 - t;
    return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
  };

  // One line as a list of points, so a travelling wave can be laid over the curve.
  function pointAt(s, l, t, time) {
    const k = calm[s].v;
    const spread = (l - (LINES - 1) / 2) * 3.6;
    const y0 = srcY[s] + spread;
    const y1 = endY + spread * 0.12;
    const lean = pointer.lean ? (pointer.y - (y0 + y1) / 2) * pointer.lean * 0.18 : 0;
    const x = bez(0, w * 0.5, w * 0.5, w, t);
    const y = bez(y0, y0 + lean, y1 + lean, y1, t);
    const env = Math.sin(Math.PI * t) ** 1.2;
    const wave = still ? 0 : Math.sin(time * 1.4 + t * 5.2 + l * 0.42 + s * 1.7) * 7 * (1 - k) * (0.35 + 0.65 * env) + (t < 0.3 ? Math.sin(time * 1.9 + l * 0.6 + s) * 9 * (1 - k) * (1 - t / 0.3) : 0);
    const sway = t < 0.2 && !still ? Math.cos(time * 1.3 + l * 0.8 + s) * 3.5 * (1 - k) * (1 - t / 0.2) : 0;
    return [x + sway, y + wave];
  }

  function draw(time) {
    if (!w || !srcY.length) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. The fans, added together; where they overlap they build up toward the node.
    ctx.globalCompositeOperation = "lighter";
    ctx.lineWidth = 0.9;
    for (let s = 0; s < srcY.length; s++) {
      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.13 + calm[s].v * 0.12;
      for (let l = 0; l < LINES; l++) {
        ctx.beginPath();
        for (let i = 0; i <= STEPS; i++) {
          const [x, y] = pointAt(s, l, i / STEPS, time);
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
    }
    // 2. A warmer pass near the node so the join reads as heat, not as a hard edge.
    const heat = ctx.createLinearGradient(w * 0.55, 0, w, 0);
    heat.addColorStop(0, "rgba(0,0,0,0)");
    heat.addColorStop(1, warm);
    ctx.globalCompositeOperation = "source-atop";
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = heat;
    ctx.fillRect(0, 0, w, h);

    // 3. Fade the source end to nothing, smoothly.
    ctx.globalCompositeOperation = "destination-in";
    ctx.globalAlpha = 1;
    const fade = ctx.createLinearGradient(0, 0, w, 0);
    fade.addColorStop(0, "rgba(0,0,0,0.05)");
    fade.addColorStop(0.3, "rgba(0,0,0,0.55)");
    fade.addColorStop(0.7, "rgba(0,0,0,0.95)");
    fade.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, w, h);

    // 4. The comb of dots at each source, and the lights travelling along the lines.
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = warm;
    for (let s = 0; s < srcY.length; s++) {
      for (let l = 0; l < LINES; l++) {
        const [x, y] = pointAt(s, l, 0, time);
        const tw = still ? 0 : Math.sin(time * 2.2 + l * 0.9 + s * 2);
        ctx.globalAlpha = Math.min(1, 0.5 + tw * 0.25 + calm[s].v * 0.45);
        ctx.beginPath();
        ctx.arc(x + 1.5, y, 1.5 + tw * 0.5 * (1 - calm[s].v), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // The point where everything meets pulses.
    const pulse = still ? 0 : (Math.sin(time * 2.6) + 1) / 2;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(w - 2, endY, 3 + pulse * 2, 0, Math.PI * 2);
    ctx.fill();
    for (const p of lights) {
      const [x, y] = pointAt(p.s, p.l, p.t, time);
      ctx.globalAlpha = 0.9 * Math.sin(Math.PI * p.t);
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  let last = 0;
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    pointer.lean += (pointer.want - pointer.lean) * 0.08;
    for (let s = 0; s < calm.length; s++) calm[s].v += (calm[s].want - calm[s].v) * 0.1;
    for (const p of lights) p.t = (p.t + p.v * dt) % 1;
    draw(now / 1000);
    if (visible) raf = requestAnimationFrame(frame);
  }

  new ResizeObserver(measure).observe(pipe);
  measure();
  if (still) return;
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !raf) raf = requestAnimationFrame(frame);
  }).observe(pipe);

  pipe.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = e.clientX - r.left;
    pointer.y = e.clientY - r.top;
    pointer.want = 1;
    // A source goes still when the pointer is on its chip or close to its comb.
    srcY.forEach((y, s) => {
      const near = Math.abs(pointer.y - y) < 34 && pointer.x < w * 0.45;
      calm[s].want = near ? 1 : 0;
    });
  });
  pipe.addEventListener("pointerleave", () => {
    pointer.want = 0;
    calm.forEach((c) => (c.want = 0));
  });
}
