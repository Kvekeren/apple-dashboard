"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Horizontale rij met één kaart per merk. Op brede schermen passen er ~3,5 kaarten in beeld,
 * zodat duidelijk is dat er meer rechts staat; pijlknoppen en trackpad/touch scrollen.
 */
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
    <div className="relative">
      <div
        ref={ref}
        onScroll={update}
        role="region"
        aria-label={ariaLabel}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 [scrollbar-width:thin]"
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
          className="absolute top-1/2 left-0 z-10 hidden size-9 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background shadow-md sm:inline-flex"
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
          className="absolute top-1/2 right-0 z-10 hidden size-9 translate-x-1/2 -translate-y-1/2 rounded-full bg-background shadow-md sm:inline-flex"
        >
          <ChevronRight className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
