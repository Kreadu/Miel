"use client";

import { useEffect } from "react";

// Único JS de la landing: marca <html class="js"> (gate de los estilos de
// reveal/tilt en globals.css) y observa los elementos animables una sola vez.
export function ScrollFx() {
  useEffect(() => {
    document.documentElement.classList.add("js");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    document
      .querySelectorAll("[data-reveal], .landing-tilt")
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  return null;
}
