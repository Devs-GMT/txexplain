import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { reducedMotion } from "../ui/type.js";
import { initHeadline } from "./fx.js";

gsap.registerPlugin(ScrollTrigger, SplitText);

/// Hero headline types in with a blinking underscore, then the rest of the hero rises in.
export function initHero() {
  const title = document.querySelector(".hero-title");
  if (!title) return;
  // The page opens fully drawn. Only the pointer moves the letters.
  initHeadline(title, title.closest(".hero"));
}

/// The page opens one warm colour and goes black as you scroll: the colour is a fixed layer whose opacity follows the scroll.
/// The bands in it light up and a soft light follows the pointer, both at once with no easing lag on the bands.
export function initHeat() {
  const heat = document.querySelector(".hero-heat");
  if (!heat) return;
  if (reducedMotion()) return;
  gsap.to(heat, { opacity: 0, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: () => `+=${Math.round(innerHeight * 0.85)}`, scrub: 0.25 } });
  if (!matchMedia("(pointer: fine)").matches) return;
  const spot = heat.querySelector(".hero-spot");
  const x = gsap.quickTo(spot, "x", { duration: 0.12, ease: "power3.out" });
  const y = gsap.quickTo(spot, "y", { duration: 0.12, ease: "power3.out" });
  addEventListener("pointermove", (e) => {
    spot.style.opacity = "1";
    heat.style.setProperty("--hx", `${e.clientX}px`);
    heat.style.setProperty("--hy", `${e.clientY}px`);
    x(e.clientX);
    y(e.clientY);
  });
  document.addEventListener("pointerleave", () => { spot.style.opacity = "0"; heat.style.setProperty("--hx", "-50%"); });
}

/// Below-the-fold blocks fade up once as they enter. Anything already on screen, or any run with reduced motion, is left alone,
/// so content is never hidden when the script is slow or fails.
export function initReveals() {
  if (reducedMotion()) return;
  const below = [...document.querySelectorAll("[data-reveal]")].filter((el) => el.getBoundingClientRect().top > innerHeight * 0.9);
  gsap.set(below, { opacity: 0, y: 28 });
  ScrollTrigger.batch(below, {
    start: "top 88%",
    once: true,
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 0.7, stagger: 0.1, ease: "power3.out", overwrite: true, clearProps: "transform" }),
  });
}

/// The failed-transaction tour. On a wide screen the section pins and the conversation plays as you scroll: each stage lights up
/// in the list and its messages arrive in the phone. On a narrow screen, or with reduced motion, the list and the whole
/// conversation are simply there.
export function initTour() {
  const track = document.querySelector("[data-tour]");
  if (!track) return;
  const items = [...track.querySelectorAll(".rail li")];
  const msgs = [...track.querySelectorAll("[data-stage]")];
  const phone = track.querySelector("[data-phone]");
  const composer = track.querySelector("[data-composer]");
  const mq = matchMedia("(min-width: 60.01rem)");
  if (!mq.matches || reducedMotion()) return;

  track.classList.add("is-pinned");
  track.style.setProperty("--steps", items.length);

  let on = -1;
  const set = (i) => {
    if (i === on || phone.dataset.live) return;
    const forward = i > on;
    on = i;
    items.forEach((li, k) => li.classList.toggle("is-on", k === i));
    msgs.forEach((el) => {
      const shown = Number(el.dataset.stage) <= i;
      if (shown === el.classList.contains("is-shown")) return;
      el.classList.toggle("is-shown", shown);
      if (shown && forward) gsap.fromTo(el, { y: 14 }, { y: 0, duration: 0.5, ease: "power2.out", clearProps: "transform" });
    });
    // The scripted example types its hash into the box, unless the visitor has started typing their own.
    if (i === 0 && forward && !phone.dataset.typing) {
      const text = "0x79010ee0…a1aa2f";
      const o = { n: 0 };
      gsap.to(o, { n: text.length, duration: 1.1, ease: "none", onUpdate: () => { if (!phone.dataset.typing) composer.value = text.slice(0, Math.round(o.n)); }, onComplete: () => { if (!phone.dataset.typing) composer.value = ""; } });
    }
    const shake = track.querySelector("[data-shake]");
    if (shake && i === 2 && forward) gsap.to(shake, { keyframes: { x: [-5, 5, -3, 3, 0] }, duration: 0.4, delay: 0.3, ease: "power1.inOut" });
    const ticks = track.querySelectorAll(".checks li");
    if (i === 3 && forward) gsap.fromTo(ticks, { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: 0.4, delay: 0.3, ease: "power2.out" });
  };
  set(0);

  ScrollTrigger.create({
    trigger: track,
    start: "top top+=68",
    end: "bottom bottom",
    onUpdate: (self) => set(Math.min(items.length - 1, Math.floor(self.progress * items.length))),
  });
}

/// Section headings rise out of a mask, line by line, the first time they scroll into view. Without motion they are plain text.
export function initSplit() {
  if (reducedMotion()) return;
  document.querySelectorAll("[data-split]").forEach((el) => {
    SplitText.create(el, {
      type: "lines",
      mask: "lines",
      autoSplit: true,
      onSplit: (self) => gsap.from(self.lines, { yPercent: 108, duration: 0.9, stagger: 0.09, ease: "power4.out", scrollTrigger: { trigger: el, start: "top 90%", once: true } }),
    });
  });
}

/// The ribbon of things TxExplain can read drifts left on its own and speeds up, in either direction, with the scroll.
export function initRibbon() {
  const track = document.querySelector("[data-ribbon-track]");
  if (!track || reducedMotion()) return;
  const drift = gsap.to(track, { xPercent: -50, duration: 38, ease: "none", repeat: -1 });
  ScrollTrigger.create({
    trigger: ".ribbon",
    start: "top bottom",
    end: "bottom top",
    onUpdate: (self) => {
      const v = self.getVelocity();
      gsap.to(drift, { timeScale: Math.sign(v || 1) * (1 + Math.min(Math.abs(v) / 260, 7)), duration: 0.2, overwrite: true });
      gsap.to(drift, { timeScale: 1, duration: 1.2, delay: 0.15 });
    },
  });
}

/// A thin amber line along the top edge fills as the page is read.
export function initProgress() {
  if (reducedMotion()) return;
  const bar = document.createElement("div");
  bar.className = "progress";
  bar.setAttribute("aria-hidden", "true");
  document.body.append(bar);
  gsap.to(bar, { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.25 } });
}
