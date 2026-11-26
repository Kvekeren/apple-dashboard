"use client";

import { ChevronDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  SOURCE_LABELS,
  favIconUrl,
  normArticleUrl,
  type SiteCfg,
  type WeeklyTopArticleRow,
} from "@/lib/monitoring/shared";
import { badgeClassForLabel } from "@/lib/site-titles";
import { BrandScrollRow } from "@/components/monitoring/views/brand-scroll-row";

export function TopArticlesSourceGrid({
  weeklyTopAllBySource,
  topArticlesVisible,
  hasMoreTopArticles,
  onLoadMoreTopArticles,
  pageOgImages,
  siteCfg,
  showGa4Warning = false,
  emptyLabel = "Geen data",
}: {
  weeklyTopAllBySource: Record<string, WeeklyTopArticleRow[]>;
  topArticlesVisible: number;
  hasMoreTopArticles: boolean;
  onLoadMoreTopArticles: () => void;
  pageOgImages: Record<string, string>;
  siteCfg?: SiteCfg[] | null;
  showGa4Warning?: boolean;
  emptyLabel?: string;
}) {
  function resolveTopRowOgImage(url: string): string | undefined {
    const n = normArticleUrl(url);
    return pageOgImages[n] ?? pageOgImages[url];
  }

  return (
    <>
      <BrandScrollRow ariaLabel="Meest gelezen artikelen per titel">
        {SOURCE_LABELS.map((src) => {
          const lacksGa4 =
            showGa4Warning && siteCfg?.some((c) => c.label === src && !c.hasGa4Property);
          const allRows = weeklyTopAllBySource[src] ?? [];
          const rows = allRows.slice(0, topArticlesVisible);
          const fav = favIconUrl(src);
          return (
            <div key={src} className="fnl-card-hover flex w-full flex-col p-4">
              <div className="flex flex-col items-center border-b border-border pb-2.5">
                {fav ? <img alt="" src={fav} className="mb-1.5 size-8 rounded-[8px]" /> : null}
                <Badge variant="outline" className={badgeClassForLabel(src)}>
                  {src}
                </Badge>
                {lacksGa4 ? (
                  <p className="mt-2 text-center text-xs font-medium text-[var(--fnl-warning)]">
                    GA4 .env?
                  </p>
                ) : null}
              </div>
              {!rows.length ? (
                <p className="mt-3 flex-1 text-center text-sm text-muted-foreground">
                  {emptyLabel}
                </p>
              ) : (
                <div className="mt-3 flex flex-1 flex-col gap-2">
                  {rows.map((r, i) => {
                    const imgSrc = resolveTopRowOgImage(r.url);
                    return (
                      <div
                        key={`${src}-${i}-${r.pageTitle.slice(0, 48)}`}
                        className="flex gap-2.5 border-b border-border pb-2.5 last:border-b-0 last:pb-0"
                      >
                        <div className="w-[100px] shrink-0 sm:w-[112px]">
                          {imgSrc ? (
                            <a
                              href={r.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block"
                            >
                              <img
                                alt=""
                                src={imgSrc}
                                className="aspect-video w-full rounded-[3px] border border-border object-cover"
                              />
                            </a>
                          ) : (
                            <div
                              className="aspect-video w-full rounded-[3px] border border-dashed border-border bg-muted/50"
                              aria-hidden
                            />
                          )}
                        </div>
                        <div className="flex min-w-0 flex-1 gap-1.5 leading-snug">
                          <span className="shrink-0 pt-0.5 text-[11px] tabular-nums text-muted-foreground">
                            {i + 1}.
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
                              <a
                                href={r.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="min-w-0 flex-1 text-xs leading-snug text-foreground underline-offset-2 hover:text-primary hover:underline"
                              >
                                {r.pageTitle}
                              </a>
                              <span className="shrink-0 tabular-nums text-[11px] text-muted-foreground sm:pt-px">
                                {r.metricValue.toLocaleString("nl-NL")}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </BrandScrollRow>
      {hasMoreTopArticles ? (
        <div className="mt-4 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-[4px] text-primary hover:bg-[var(--fnl-blue-pale)]"
            onClick={onLoadMoreTopArticles}
          >
            <ChevronDown className="size-4" />
            Meer laden
          </Button>
        </div>
      ) : null}
    </>
  );
}
