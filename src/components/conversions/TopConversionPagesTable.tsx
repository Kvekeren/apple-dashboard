"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { slugFromUrl } from "@/lib/monitoring/shared";
import type { TopConversionPageRow } from "@/lib/conversion-types";

export function TopConversionPagesTable({ pages }: { pages: TopConversionPageRow[] }) {
  if (pages.length === 0) {
    return (
      <div className="fnl-card p-6 text-center text-sm text-muted-foreground">
        Geen pagina&apos;s met conversies in deze periode.
      </div>
    );
  }

  return (
    <div className="fnl-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Pagina</TableHead>
            <TableHead className="text-right">Pageviews</TableHead>
            <TableHead className="text-right">Conversies</TableHead>
            <TableHead className="text-right">Conversieratio</TableHead>
            <TableHead className="text-right">Affiliate-clicks</TableHead>
            <TableHead className="text-right">Omzet</TableHead>
            <TableHead>Belangrijkste event</TableHead>
            <TableHead className="text-right">Groei</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pages.map((p) => {
            const title =
              p.pageTitle && p.pageTitle !== "(not set)"
                ? p.pageTitle
                : slugFromUrl(p.url);
            const positive = (p.changePercent ?? 0) > 0;
            const negative = (p.changePercent ?? 0) < 0;
            return (
              <TableRow key={p.url}>
                <TableCell className="max-w-[240px]">
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="line-clamp-2 text-sm font-medium hover:underline"
                  >
                    {title}
                  </a>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {p.pageviews.toLocaleString("nl-NL")}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {p.conversions.toLocaleString("nl-NL")}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {p.conversionRate != null
                    ? `${p.conversionRate.toFixed(2).replace(".", ",")}%`
                    : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {p.affiliateClicks.toLocaleString("nl-NL")}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {p.revenue > 0
                    ? p.revenue.toLocaleString("nl-NL", {
                        style: "currency",
                        currency: "EUR",
                      })
                    : "—"}
                </TableCell>
                <TableCell className="text-xs">{p.topEventLabel}</TableCell>
                <TableCell className="text-right">
                  {p.changePercent != null ? (
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        positive
                          ? "text-[var(--fnl-success)]"
                          : negative
                            ? "text-[var(--fnl-danger)]"
                            : "text-muted-foreground"
                      }`}
                    >
                      {positive ? "+" : ""}
                      {p.changePercent}%
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
