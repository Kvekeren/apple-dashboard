"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  IDEEEN_CATEGORY_SECTIONS,
  IDEEEN_INITIAL,
  IDEEEN_STEP,
  faviconForPublisher,
  formatDiscoverArticleDate,
  ownTitleLabelFromArticle,
  type DiscoverSnoopArticle,
  type IdeeenCategoryKey,
  type IdeeenCategoryPayload,
  type IdeeenVisibleKey,
} from "@/lib/discover-snoop";
import { badgeClassForLabel } from "@/lib/site-titles";

export type IdeeenScope = "nl" | "worldwide";

const SCOPE_TABS: { value: IdeeenScope; label: string }[] = [
  { value: "nl", label: "Nederland" },
  { value: "worldwide", label: "Wereldwijd" },
];

function initialVisibleState(): Record<IdeeenVisibleKey, number> {
  return {
    "tel-nl": IDEEEN_INITIAL,
    "tel-worldwide": IDEEEN_INITIAL,
    "electronics-nl": IDEEEN_INITIAL,
    "electronics-worldwide": IDEEEN_INITIAL,
  };
}

function DiscoverArticleCard({
  article,
  rank,
}: {
  article: DiscoverSnoopArticle;
  rank: number;
}) {
  const ownLabel = ownTitleLabelFromArticle(article);
  const imgSrc = article.image?.trim();
  const favicon = faviconForPublisher(article.publisher_url);
  const dateLabel = formatDiscoverArticleDate(article.firstviewed);

  return (
    <article
      className={`flex min-h-[96px] overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_rgba(60,64,67,0.08),0_1px_3px_rgba(60,64,67,0.04)] transition-shadow hover:shadow-[0_2px_6px_rgba(60,64,67,0.12),0_6px_14px_rgba(60,64,67,0.06)] sm:min-h-[113px] ${
        ownLabel ? "border-primary/20" : "border-border"
      }`}
    >
      {imgSrc ? (
        <img
          src={imgSrc}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-[96px] w-[120px] shrink-0 object-cover bg-muted sm:h-[113px] sm:w-[160px]"
        />
      ) : (
        <div
          className="h-[96px] w-[120px] shrink-0 bg-muted sm:h-[113px] sm:w-[160px]"
          aria-hidden
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {favicon ? (
              <img
                alt=""
                src={favicon}
                className="size-5 shrink-0 rounded-sm bg-background object-contain"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="flex size-5 shrink-0 items-center justify-center rounded-sm bg-muted text-[9px] font-semibold text-muted-foreground">
                {article.publisher.charAt(0)}
              </span>
            )}
            <span className="truncate text-xs font-medium text-muted-foreground">
              {article.publisher}
            </span>
          </div>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground tabular-nums">
            #<span className="font-bold text-foreground">{String(rank).padStart(2, "0")}</span>
          </span>
        </div>

        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="line-clamp-2 text-sm font-medium leading-snug text-foreground hover:text-primary hover:underline"
        >
          {article.title}
        </a>

        <div className="mt-auto flex items-end justify-between gap-2 pt-0.5">
          <div className="flex min-w-0 flex-wrap gap-1">
            {ownLabel ? (
              <Badge
                variant="outline"
                className={`h-5 px-1.5 text-[10px] ${badgeClassForLabel(ownLabel)}`}
              >
                {ownLabel}
              </Badge>
            ) : null}
            {article.is_new ? (
              <Badge
                variant="outline"
                className="h-5 border-[var(--fnl-warning)]/40 bg-[#fdf8ed] px-1.5 text-[10px] text-[var(--fnl-ink-2)]"
              >
                Nieuw
              </Badge>
            ) : null}
          </div>
          {dateLabel ? (
            <span className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground/80">
              {dateLabel}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function IdeeenFeed({
  rows,
  visible,
  onLoadMore,
}: {
  rows: DiscoverSnoopArticle[];
  visible: number;
  onLoadMore: () => void;
}) {
  const vis = rows.slice(0, visible);
  const hasMore = rows.length > visible;

  return (
    <div className="space-y-2">
      {!rows.length ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Geen artikelen</p>
      ) : (
        <>
          <div className="flex flex-col gap-2.5">
            {vis.map((article, i) => (
              <DiscoverArticleCard
                key={`${article.url}-${i}`}
                article={article}
                rank={i + 1}
              />
            ))}
          </div>
          {hasMore ? (
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-[4px] text-primary hover:bg-[var(--fnl-blue-pale)]"
                onClick={onLoadMore}
              >
                <ChevronDown className="size-4" />
                Meer laden
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function IdeeenColumn({
  label,
  rows,
  visible,
  onLoadMore,
}: {
  label: string;
  rows: DiscoverSnoopArticle[];
  visible: number;
  onLoadMore: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <h2 className="fnl-section-title">{label}</h2>
      <IdeeenFeed rows={rows} visible={visible} onLoadMore={onLoadMore} />
    </div>
  );
}

export function IdeeenDashboard({
  sections,
  week,
  loadErr,
  dataVersion,
}: {
  sections: Record<IdeeenCategoryKey, IdeeenCategoryPayload>;
  week: number | null;
  loadErr: string | null;
  dataVersion: string;
}) {
  const [scope, setScope] = useState<IdeeenScope>("nl");
  const [visible, setVisible] = useState(initialVisibleState);

  useEffect(() => {
    setVisible(initialVisibleState());
  }, [dataVersion]);

  function loadMore(key: IdeeenVisibleKey) {
    const [category, keyScope] = key.split("-") as [IdeeenCategoryKey, IdeeenScope];
    const total = sections[category]?.[keyScope]?.items.length ?? 0;
    setVisible((v) => ({
      ...v,
      [key]: Math.min(total, v[key] + IDEEEN_STEP),
    }));
  }

  const emptyCategory: IdeeenCategoryPayload = {
    nl: { items: [], meta: { total: null } },
    worldwide: { items: [], meta: { total: null } },
  };

  return (
    <section className="mb-10">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            DiscoverSnoop
            {week != null ? (
              <span className="ml-2 font-normal text-base text-muted-foreground sm:text-lg">
                Week {week}
              </span>
            ) : null}
          </h1>
          <p className="my-5 max-w-2xl text-sm text-muted-foreground">
            Best presterende artikelen in Google Discover via DiscoverSnoop. Bekijk het volledige
            overzicht op de{" "}
            <a
              href="https://discoverknallers.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Discoverknallers
            </a>
            -pagina.
          </p>
        </div>
        <div
          className="flex w-full gap-1 rounded-[8px] border border-border bg-muted p-1 sm:w-fit sm:shrink-0"
          role="tablist"
          aria-label="Markt"
        >
          {SCOPE_TABS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={scope === value}
              data-active={scope === value ? "true" : "false"}
              onClick={() => setScope(value)}
              className="fnl-segment-item min-w-0 flex-1 px-3 py-2 text-center sm:flex-none"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loadErr ? (
        <div
          role="alert"
          className="mb-3 rounded-[8px] border border-[var(--fnl-warning)]/35 bg-[#fdf8ed] px-4 py-3 text-sm text-[var(--fnl-ink-2)]"
        >
          {loadErr}
        </div>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2">
        {IDEEEN_CATEGORY_SECTIONS.map(({ key, label }) => {
          const visibleKey = `${key}-${scope}` as IdeeenVisibleKey;
          const rows = (sections[key] ?? emptyCategory)[scope].items;
          return (
            <IdeeenColumn
              key={key}
              label={label}
              rows={rows}
              visible={visible[visibleKey]}
              onLoadMore={() => loadMore(visibleKey)}
            />
          );
        })}
      </div>
    </section>
  );
}
