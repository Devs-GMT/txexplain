import gsap from "gsap";
import { reducedMotion } from "../ui/type.js";
import { initTilt } from "../site/fx.js";

/// The explanation arrives in order: cards rise one after another, the gas bar fills, the gas number counts up,
/// the timeline draws itself, and cards lean toward the pointer. With reduced motion nothing moves.
export function revealResult(stage) {
  const cards = stage.querySelectorAll(".result .card, .result .sect");
  cards.forEach((c) => {
    if (c.classList.contains("card")) {
      c.dataset.spot = "";
      c.dataset.tilt = "2";
    }
  });
  if (reducedMotion()) return;
  initTilt(stage);
  gsap.from(cards, { opacity: 0, y: 26, duration: 0.6, stagger: 0.07, ease: "power3.out", clearProps: "opacity,transform" });
  const bar = stage.querySelector(".gas-bar span");
  if (bar) gsap.fromTo(bar, { scaleX: 0 }, { scaleX: getComputedStyle(bar).getPropertyValue("--pct"), duration: 1.1, delay: 0.4, ease: "power3.out" });
  stage.querySelectorAll("[data-count]").forEach((el) => {
    const end = Number(el.dataset.count);
    const o = { n: 0 };
    gsap.to(o, { n: end, duration: 1, delay: 0.4, ease: "power2.out", onUpdate: () => { el.textContent = Math.round(o.n).toLocaleString("en-US"); }, onComplete: () => { el.textContent = end.toLocaleString("en-US"); } });
  });
  gsap.from(stage.querySelectorAll(".timeline li"), { opacity: 0, x: -10, duration: 0.45, stagger: 0.12, delay: 0.5, ease: "power2.out", clearProps: "opacity,transform" });
}

/// While the chain is being read, a line of hex shuffles and the real hash settles into it as the steps tick.
export function startScan(el, hash) {
  if (!el || reducedMotion()) {
    if (el) el.textContent = hash;
    return () => {};
  }
  const HEX = "0123456789abcdef";
  let settled = 0;
  const id = setInterval(() => {
    if (!el.isConnected) return clearInterval(id);
    let out = "";
    for (let i = 0; i < hash.length; i++) out += i < settled ? hash[i] : i < 2 ? hash[i] : HEX[(Math.random() * 16) | 0];
    el.textContent = out;
  }, 55);
  return {
    settle(fraction) {
      settled = Math.floor(hash.length * fraction);
    },
    stop() {
      clearInterval(id);
      el.textContent = hash;
    },
  };
}
