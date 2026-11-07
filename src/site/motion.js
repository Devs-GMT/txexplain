import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { reducedMotion, typeInto } from "../ui/type.js";

gsap.registerPlugin(ScrollTrigger);

/// Hero headline types in with a blinking underscore, then the rest of the hero rises in.
export function initHero() {
  const title = document.querySelector(".hero-title");
  if (!title || reducedMotion()) return;
  typeInto(title, title.dataset.type, { cps: 22 });
  gsap.from(".hero-copy > :not(h1), .demo", { opacity: 0, y: 20, duration: 0.7, stagger: 0.12, delay: 0.3, ease: "power3.out", clearProps: "all" });
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

/// The example conversation plays line by line the first time it is seen.
export function initStory() {
  const items = document.querySelectorAll("[data-story] > li");
  if (!items.length || reducedMotion()) return;
  gsap.set(items, { opacity: 0, y: 14 });
  const tl = gsap.timeline({ paused: true });
  items.forEach((li, i) => tl.to(li, { opacity: 1, y: 0, duration: 0.45, ease: "power2.out" }, i * 0.85));
  ScrollTrigger.create({ trigger: ".chat", start: "top 75%", once: true, onEnter: () => tl.play() });
}
