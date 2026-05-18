"use client";

import { useEffect, useState } from "react";
import { Features } from "./Features";
import { Hero } from "./Hero";
import { StickyHeader } from "./StickyHeader";

function useParallax() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    let ticking = false;

    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(() => {
          setScrollY(globalThis.scrollY);
          ticking = false;
        });
        ticking = true;
      }
    }

    globalThis.addEventListener("scroll", onScroll, { passive: true });
    return () => globalThis.removeEventListener("scroll", onScroll);
  }, []);

  return scrollY;
}

export function HomePageHeroShell() {
  const scrollY = useParallax();

  return (
    <>
      <StickyHeader scrollY={scrollY} />
      <Hero scrollY={scrollY} />
      <div id="features">
        <Features scrollY={scrollY} />
      </div>
    </>
  );
}
