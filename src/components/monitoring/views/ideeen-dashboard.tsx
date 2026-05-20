"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ExternalLink, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  IDEEEN_CATEGORY_SECTIONS,
  IDEEEN_INITIAL,
  IDEEEN_STEP,
  faviconForPublisher,
  ownTitleLabelFromArticle,
  type DiscoverSnoopArticle,
  type IdeeenCategoryKey,
} from "@/lib/discover-snoop";
import { badgeClassForLabel } from "@/lib/site-titles";

const INITIAL_VISIBLE: Record<IdeeenCategoryKey, number> = {
  tel: IDEEEN_INITIAL,
  electronics: IDEEEN_INITIAL,
};

function formatScore(score: number): string {
  return Number.isFinite(score) ? score.toFixed(1) : "–";
}

function ArticleCard({ article, rank }: { article: DiscoverSnoopArticle; rank: number }) {
  const ownLabel = ownTitleLabelFromArticle(article);
  const favicon = faviconForPublisher(article.publisher_url);
  const imgSrc = article.image?.trim();

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_rgba(60,64,67,0.08),0_1px_3px_rgba(60,64,67,0.04)] transition-shadow hover:shadow-[0_2px_6px_rgba(60,64,67,0.12),0_6px_14px_rgba(60,64,67,0.06)] ${
        ownLabel ? "border-primary/25 bg-[var(--fnl-blue-pale)]/30" : "border-border"
      }`}
    >
      {imgSrc ? (
        <img
          src={imgSrc}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="aspect-[16/9] w-full object-cover bg-muted"
        />
      ) : (
        <div className="aspect-[16/9] w-full bg-muted" aria-hidden />
      )}

      <div className="flex flex-col gap-1.5 p-3">
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {favicon ? (
              <img
                alt=""
                src={favicon}
                className="size-5 shrink-0 rounded-full bg-background object-contain p-0.5"
              />
            ) : (
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
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
          <span className="shrink-0 rounded-full bg-[var(--fnl-blue-pale)] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-primary">
            {formatScore(article.score)}
          </span>
        </div>

        <a
          href={article.url}
          target="_blank"
          rel="noreferrer"
          className="line-clamp-3 text-sm font-medium leading-snug text-foreground hover:text-primary hover:underline"
        >
          {article.title}
          <ExternalLink className="ml-1 inline size-3 opacity-50" />
        </a>

        {(ownLabel || article.is_new) && (
          <div className="flex flex-wrap items-center gap-2">
            {ownLabel ? (
              <Badge variant="outline" className={badgeClassForLabel(ownLabel)}>
                {ownLabel}
              </Badge>
            ) : null}
            {article.is_new ? (
              <Badge
                variant="outline"
                className="border-[var(--fnl-warning)]/40 bg-[#fdf8ed] text-[var(--fnl-ink-2)]"
              >
                Nieuw
              </Badge>
            ) : null}
          </div>
        )}
      </div>
    </article>
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
  const vis = rows.slice(0, visible);
  const hasMore = rows.length > visible;

  return (
    <div className="fnl-card flex min-w-0 flex-col overflow-hidden">
      <div className="border-b border-border bg-muted/40 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{label}</h2>
        <p className="text-xs text-muted-foreground">
          {vis.length} van {rows.length} artikelen
        </p>
      </div>

      {!rows.length ? (
        <p className="flex flex-1 items-center justify-center px-4 py-10 text-center text-sm text-muted-foreground">
          Geen artikelen geladen
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-2.5 p-3">
            {vis.map((article, idx) => (
              <ArticleCard
                key={`${article.url}-${idx}`}
                article={article}
                rank={idx + 1}
              />
            ))}
          </div>
          {hasMore ? (
            <div className="border-t border-border px-3 pb-3 pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full rounded-[4px] text-primary hover:bg-[var(--fnl-blue-pale)]"
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

export function IdeeenDashboard({
  sections,
  week,
  loadErr,
  dataVersion,
}: {
  sections: Record<
    (typeof IDEEEN_CATEGORY_SECTIONS)[number]["key"],
    DiscoverSnoopArticle[]
  >;
  week: number | null;
  loadErr: string | null;
  dataVersion: string;
}) {
  const [visible, setVisible] = useState(INITIAL_VISIBLE);

  useEffect(() => {
    setVisible(INITIAL_VISIBLE);
  }, [dataVersion]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="fnl-section-title flex items-center gap-2">
          <Sparkles className="size-5 text-primary" aria-hidden />
          Ideeën
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Best presterende artikelen in Google Discover per categorie (NL-markt), via DiscoverSnoop.
          Standaard top 10; laad meer voor de volledige top 20.
          {week != null ? (
            <>
              {" "}
              Week <span className="tabular-nums font-medium text-foreground">{week}</span>.
            </>
          ) : null}
        </p>
      </div>

      {loadErr ? (
        <div
          role="alert"
          className="rounded-[8px] border border-[var(--fnl-warning)]/35 bg-[#fdf8ed] px-4 py-3 text-sm text-[var(--fnl-ink-2)]"
        >
          {loadErr}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        {IDEEEN_CATEGORY_SECTIONS.map(({ key, label }) => (
          <IdeeenColumn
            key={key}
            label={label}
            rows={sections[key] ?? []}
            visible={visible[key]}
            onLoadMore={() =>
              setVisible((v) => ({
                ...v,
                [key]: Math.min((sections[key] ?? []).length, v[key] + IDEEEN_STEP),
              }))
            }
          />
        ))}
      </div>
    </div>
  );
}
