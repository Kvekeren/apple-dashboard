"use client";

import { Badge } from "@/components/ui/badge";
import { badgeClassForLabel } from "@/lib/site-titles";
import { CIJFERS, favIconUrl, type CijfersData } from "@/lib/monitoring/shared";

export function VergelijkingDashboard({ cjf }: { cjf: CijfersData | null }) {
  if (!cjf)
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">Vergelijking laden…</div>
    );
  return (
    <div className="space-y-6">
      <p className="font-mono text-xs text-muted-foreground">
        {cjf.periods.current.startDate}–{cjf.periods.current.endDate} versus{" "}
        {cjf.periods.previous.startDate}–{cjf.periods.previous.endDate}
      </p>
      {cjf.sources.map(({ source, metrics }) => (
        <div key={source} className="fnl-card overflow-hidden">
          <div className="border-b border-border bg-muted/40 px-4 py-3">
            <Badge variant="outline" className={badgeClassForLabel(source)}>
              {favIconUrl(source) && (
                <img alt="" src={favIconUrl(source)} className="mr-1 inline size-4" />
              )}
              {source}
            </Badge>
          </div>
          <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
            {CIJFERS.map(({ key, label }) => {
              const m = metrics[key];
              if (!m) return null;
              return (
                <div
                  key={key}
                  className="rounded-[8px] border border-border bg-[var(--fnl-blue-pale)]/60 p-3"
                >
                  <div className="text-xs font-medium text-muted-foreground">{label}</div>
                  <div className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                    {m.current}
                  </div>
                  {m.changePercent != null && (
                    <div
                      className={`text-xs font-medium ${
                        m.change > 0 ? "text-[var(--fnl-success)]" : "text-[var(--fnl-danger)]"
                      }`}
                    >
                      {m.change > 0 ? "+" : ""}
                      {m.changePercent}%
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">eerder: {m.previous}</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
