"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Horizontale rij met één kaart per merk, schermbreed (full bleed) terwijl de rest van de pagina
 * in de container blijft. De eerste kaart lijnt uit met de content; de rij loopt door tot de
 * schermrand zodat zichtbaar is dat er meer rechts staat. Pijlknoppen en trackpad/touch scrollen.
 */

/** Zelfde inspringing als de pagina-container (max-w var(--container-max), px-4 / sm:px-6). */
const GUTTER =
  "px-4 sm:px-[max(1.5rem,calc((100vw-var(--container-max))/2+1.5rem))] " +
  "scroll-px-4 sm:scroll-px-[max(1.5rem,calc((100vw-var(--container-max))/2+1.5rem))]";

export function BrandScrollRow({
  children,
  ariaLabel,
  itemClassName = "w-[300px] sm:w-[330px]",
}: {
  children: ReactNode[];
  ariaLabel: string;
  itemClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update, children.length]);

  function scrollBy(dir: 1 | -1) {
    const el = ref.current;
    if (!el) return;
    const first = el.firstElementChild as HTMLElement | null;
    const step = first ? first.offsetWidth + 12 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  return (
    <div className="relative left-1/2 w-[100vw] -translate-x-1/2">
      <div
        ref={ref}
        onScroll={update}
        role="region"
        aria-label={ariaLabel}
        className={`flex snap-x snap-mandatory gap-3 overflow-x-auto pt-1 pb-3 [scrollbar-width:thin] ${GUTTER}`}
      >
        {children.map((child, i) => (
          <div key={i} className={`flex shrink-0 snap-start ${itemClassName}`}>
            {child}
          </div>
        ))}
      </div>
      {canLeft ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Scroll naar links"
          onClick={() => scrollBy(-1)}
          className="absolute top-1/2 left-3 z-10 hidden size-9 -translate-y-1/2 rounded-full bg-background shadow-md sm:inline-flex"
        >
          <ChevronLeft className="size-4" />
        </Button>
      ) : null}
      {canRight ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Scroll naar rechts"
          onClick={() => scrollBy(1)}
          className="absolute top-1/2 right-3 z-10 hidden size-9 -translate-y-1/2 rounded-full bg-background shadow-md sm:inline-flex"
        >
          <ChevronRight className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
