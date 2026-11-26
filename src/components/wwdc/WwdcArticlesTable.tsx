"use client";

import { ExternalLink } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { normArticleUrl } from "@/lib/monitoring/shared";
import type { WwdcArticleTrafficRow } from "@/lib/wwdc-traffic";

type ChannelKey = "discover" | "googleSearch" | "newsletter";

export type WwdcSortKey = ChannelKey | "pageviews";

const CHANNEL_LABELS: Record<ChannelKey, string> = {
  discover: "Discover (GSC)",
  googleSearch: "Google Search (GSC)",
  newsletter: "Nieuwsbrief (GA4)",
};

const CHANNEL_HEAT: Record<ChannelKey, [number, number, number]> = {
  discover: [0, 64, 119],
  googleSearch: [26, 82, 57],
  newsletter: [180, 120, 0],
};

function heatmapBg(value: number, max: number, channel: ChannelKey): string | undefined {
  if (value <= 0 || max <= 0) return undefined;
  const t = value / max;
  const [r, g, b] = CHANNEL_HEAT[channel];
  const alpha = 0.06 + t * 0.32;
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
}

function formatViews(n: number): string {
  return n > 0 ? n.toLocaleString("nl-NL") : "—";
}

function SortableHead({
  label,
  column,
  sortKey,
  onSortChange,
}: {
  label: string;
  column: WwdcSortKey;
  sortKey?: WwdcSortKey;
  onSortChange?: (k: WwdcSortKey) => void;
}) {
  if (!onSortChange) return <>{label}</>;
  const active = sortKey === column;
  return (
    <button
      type="button"
      onClick={() => onSortChange(column)}
      aria-sort={active ? "descending" : undefined}
      className={`inline-flex items-center justify-end gap-1 text-right hover:text-primary ${active ? "font-semibold text-primary" : ""}`}
    >
      {label}
      <span aria-hidden className={active ? "opacity-100" : "opacity-30"}>
        ↓
      </span>
    </button>
  );
}

export function WwdcArticlesTable({
  rows,
  pageOgImages,
  showViewsColumn = false,
  sortKey,
  onSortChange,
}: {
  rows: WwdcArticleTrafficRow[];
  pageOgImages: Record<string, string>;
  /** Extra kolom "Weergaven" (totaal GA4-pageviews). */
  showViewsColumn?: boolean;
  /** Maakt kolomkoppen klikbaar (aflopend sorteren). */
  sortKey?: WwdcSortKey;
  onSortChange?: (k: WwdcSortKey) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="fnl-card p-6 text-center text-sm text-muted-foreground">
        Geen artikelen gevonden in deze periode.
      </div>
    );
  }

  const maxByChannel: Record<ChannelKey, number> = {
    discover: Math.max(...rows.map((r) => r.discover), 0),
    googleSearch: Math.max(...rows.map((r) => r.googleSearch), 0),
    newsletter: Math.max(...rows.map((r) => r.newsletter), 0),
  };

  function resolveOgImage(url: string): string | undefined {
    const n = normArticleUrl(url);
    return pageOgImages[n] ?? pageOgImages[url];
  }

  return (
    <div className="fnl-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[260px]">Artikel</TableHead>
            {(Object.keys(CHANNEL_LABELS) as ChannelKey[]).map((key) => (
              <TableHead key={key} className="w-[110px] text-right text-xs whitespace-normal">
                <SortableHead
                  label={CHANNEL_LABELS[key]}
                  column={key}
                  sortKey={sortKey}
                  onSortChange={onSortChange}
                />
              </TableHead>
            ))}
            {showViewsColumn ? (
              <TableHead className="w-[110px] text-right text-xs whitespace-normal">
                <SortableHead
                  label="Weergaven"
                  column="pageviews"
                  sortKey={sortKey}
                  onSortChange={onSortChange}
                />
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => {
            const imgSrc = resolveOgImage(row.url);
            return (
              <TableRow key={row.url}>
                <TableCell className="py-3">
                  <div className="flex gap-2.5">
                    <div className="w-[100px] shrink-0 sm:w-[112px]">
                      {imgSrc ? (
                        <a
                          href={row.url}
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
                    <div className="min-w-0 flex-1 leading-snug">
                      <div className="flex gap-1.5">
                        <span className="shrink-0 pt-0.5 text-[11px] tabular-nums text-muted-foreground">
                          {index + 1}.
                        </span>
                        <div className="min-w-0 flex-1">
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group inline-flex max-w-full items-start gap-1 text-xs leading-snug text-foreground underline-offset-2 hover:text-primary hover:underline"
                          >
                            <span className="line-clamp-3">{row.pageTitle}</span>
                            <ExternalLink className="mt-0.5 size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
                          </a>
                          {showViewsColumn ? null : (
                            <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
                              {row.pageviews.toLocaleString("nl-NL")}
                              <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                                pageviews
                              </span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </TableCell>
                {(Object.keys(CHANNEL_LABELS) as ChannelKey[]).map((key) => {
                  const value = row[key];
                  const bg = heatmapBg(value, maxByChannel[key], key);
                  return (
                    <TableCell
                      key={key}
                      className="text-right align-middle tabular-nums text-sm"
                      style={bg ? { backgroundColor: bg } : undefined}
                    >
                      {formatViews(value)}
                    </TableCell>
                  );
                })}
                {showViewsColumn ? (
                  <TableCell className="text-right align-middle text-sm font-semibold tabular-nums text-foreground">
                    {formatViews(row.pageviews)}
                  </TableCell>
                ) : null}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
