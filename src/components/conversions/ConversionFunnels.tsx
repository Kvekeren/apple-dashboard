"use client";

import type { ConversionFunnelResult } from "@/lib/conversion-types";

function FunnelBlock({ funnel }: { funnel: ConversionFunnelResult }) {
  const maxCount = Math.max(...funnel.steps.map((s) => s.count), 1);

  return (
    <div className="fnl-card p-4">
      <h4 className="text-sm font-semibold text-foreground">{funnel.label}</h4>
      <div className="mt-3 space-y-2">
        {funnel.steps.map((step, idx) => {
          const widthPct = Math.max(8, (step.count / maxCount) * 100);
          return (
            <div key={step.eventName}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-medium">{step.label}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {step.count.toLocaleString("nl-NL")}
                  {idx > 0 && step.rateFromPrevious != null ? (
                    <span className="ml-1 text-[10px]">
                      ({step.rateFromPrevious.toFixed(1).replace(".", ",")}%)
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-[#004077] transition-all"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              {idx === 0 && funnel.steps.length > 1 ? (
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  Basis: {step.count.toLocaleString("nl-NL")} events
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ConversionFunnels({ funnels }: { funnels: ConversionFunnelResult[] }) {
  if (funnels.length === 0) {
    return (
      <div className="fnl-card p-6 text-center text-sm text-muted-foreground">
        Geen funnels geconfigureerd voor dit merk.
      </div>
    );
  }

  return (
    <section>
      <h3 className="fnl-section-title mb-3">Funnels</h3>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {funnels.map((f) => (
          <FunnelBlock key={f.id} funnel={f} />
        ))}
      </div>
    </section>
  );
}
