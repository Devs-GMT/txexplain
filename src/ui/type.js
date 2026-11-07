import gsap from "gsap";
import { TextPlugin } from "gsap/TextPlugin";

gsap.registerPlugin(TextPlugin);

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/// Types `text` into `el` with GSAP's TextPlugin; the amber cursor (.is-typing) shows only while it runs.
/// Under reduced motion the text appears at once. Resolves when the text is complete.
export function typeInto(el, text, { cps = 70 } = {}) {
  gsap.killTweensOf(el);
  if (reducedMotion()) {
    el.textContent = text;
    el.classList.remove("is-typing");
    return Promise.resolve();
  }
  el.textContent = "";
  el.classList.add("is-typing");
  return new Promise((resolve) => {
    gsap.to(el, {
      duration: Math.min(3.2, text.length / cps),
      ease: "none",
      text: { value: text, delimiter: "" },
      onComplete() {
        el.classList.remove("is-typing");
        resolve();
      },
    });
  });
}
