"use client";

import { type Dispatch, type SetStateAction } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { badgeClassForLabel } from "@/lib/site-titles";
import { favIconUrl, slugFromUrl } from "@/lib/monitoring/shared";
import type { NewsArticle } from "@/components/monitoring/news-sitemaps-client";

export function DiscoverDashboard({
  bySrcDisc,
  visLabels,
  discExp,
  setDiscExp,
  urlArticle,
  discTit,
  norm,
}: {
  bySrcDisc: Record<string, { url: string; clicks: number; impressions: number }[]>;
  visLabels: string[];
  discExp: Record<string, number>;
  setDiscExp: Dispatch<SetStateAction<Record<string, number>>>;
  urlArticle: Record<string, NewsArticle>;
  discTit: Record<string, string>;
  norm: (u: string) => string;
}) {
  return (
    <div className="space-y-8">
      {visLabels.map((src) => {
        const rows = bySrcDisc[src] ?? [];
        const n = discExp[src] ?? 15;
        const vis = rows.slice(0, n);
        return (
          <div key={src} className="fnl-card overflow-hidden">
            <div className="border-b border-border bg-muted/40 px-4 py-3">
              <Badge variant="outline" className={badgeClassForLabel(src)}>
                {src}
              </Badge>{" "}
              <span className="text-sm text-muted-foreground">({rows.length})</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paginatitel</TableHead>
                  <TableHead className="text-right w-[72px]">Clicks</TableHead>
                  <TableHead className="text-right w-[72px]">CTR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!vis.length ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                      Geen Discover
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {vis.map((row, idx) => {
                      const ttl =
                        idx < 5
                          ? urlArticle[norm(row.url)]?.title ??
                            discTit[row.url] ??
                            slugFromUrl(row.url)
                          : slugFromUrl(row.url);
                      return (
                        <TableRow key={`${row.url}-${idx}`}>
                          <TableCell>
                            <a
                              href={row.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-medium text-primary hover:text-[var(--fnl-blue-dark)] hover:underline"
                            >
                              {favIconUrl(src) ? (
                                <img alt="" src={favIconUrl(src)} className="size-4" />
                              ) : null}
                              {ttl}
                              <ExternalLink className="size-3 opacity-60" />
                            </a>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{row.clicks}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.impressions
                              ? `${((row.clicks / row.impressions) * 100).toFixed(1)}%`
                              : "–"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {rows.length > n && (
                      <TableRow>
                        <TableCell colSpan={3}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full rounded-[4px] text-primary hover:bg-[var(--fnl-blue-pale)]"
                            onClick={() =>
                              setDiscExp((x) => ({
                                ...x,
                                [src]: (x[src] ?? 15) + 15,
                              }))
                            }
                          >
                            <ChevronDown className="size-4" />
                            Meer
                          </Button>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        );
      })}
    </div>
  );
}
