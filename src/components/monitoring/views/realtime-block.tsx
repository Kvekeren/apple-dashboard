"use client";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { listTitleLabelsInOrder } from "@/lib/site-titles";
import {
  favIconUrl,
  realtimeUrlLabel,
  type SiteCfg,
} from "@/lib/monitoring/shared";

const REALTIME_TOP_PAGES_SKELETON = 5;
const REALTIME_URL_SKELETON_WIDTHS = ["w-[92%]", "w-[78%]", "w-[85%]", "w-[70%]", "w-[62%]"] as const;

function RealtimeBlockSkeleton() {
  const labels = listTitleLabelsInOrder();
  return (
    <div className="grid gap-4 sm:grid-cols-3" aria-busy="true" aria-label="Realtime data laden">
      {labels.map((src) => {
        const fav = favIconUrl(src);
        return (
          <div key={src} className="fnl-card-hover p-5">
            <div className="flex flex-col items-center">
              {fav ? <img alt="" src={fav} className="mb-2 size-9 rounded-[8px]" /> : null}
              <div className="font-semibold text-foreground">{src}</div>
              <div className="mt-2 h-9 w-[4.5rem] animate-pulse rounded-[4px] bg-muted" />
              <div className="text-xs text-muted-foreground">actief ~30 min</div>
            </div>
            <ul className="mt-4 border-t border-border pt-3 text-xs text-[var(--fnl-ink-2)]">
              {Array.from({ length: REALTIME_TOP_PAGES_SKELETON }, (_, i) => (
                <li key={i} className="flex justify-between gap-2 py-1">
                  <div
                    className={`h-4 min-w-0 animate-pulse rounded-[2px] bg-primary/20 ${REALTIME_URL_SKELETON_WIDTHS[i]}`}
                  />
                  <span className="h-4 w-6 shrink-0 animate-pulse rounded-[2px] bg-muted" />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export function RealtimeBlock({
  rtLoad,
  rt,
  cfg,
  onRefresh,
}: {
  rtLoad: boolean;
  rt: {
    data: { source: string; activeUsers: number }[];
    topPages: { source: string; url: string; pageTitle: string; screenPageViews: number }[];
  } | null;
  cfg: SiteCfg[] | null;
  onRefresh: () => void;
}) {
  const labels = listTitleLabelsInOrder();
  if (rtLoad) return <RealtimeBlockSkeleton />;
  if (!rt)
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        <Button variant="outline" size="sm" className="rounded-[4px]" onClick={() => onRefresh()}>
          <RefreshCw className="mr-2 size-4" />
          Opnieuw
        </Button>
      </div>
    );
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {labels.map((src) => {
        const row = rt.data.find((x) => x.source === src);
        const lacks = cfg?.some((c) => c.label === src && !c.hasGa4Property);
        const pages = (rt.topPages ?? []).filter((p) => p.source === src);
        return (
          <div key={src} className="fnl-card-hover p-5">
            <div className="flex flex-col items-center">
              {favIconUrl(src) && (
                <img alt="" src={favIconUrl(src)} className="mb-2 size-9 rounded-[8px]" />
              )}
              <div className="font-semibold text-foreground">{src}</div>
              {lacks && (
                <p className="mt-1 text-center text-xs font-medium text-[var(--fnl-warning)]">
                  GA4 .env?
                </p>
              )}
              <div className="mt-2 text-3xl font-semibold tabular-nums text-primary">
                {(row?.activeUsers ?? 0).toLocaleString("nl-NL")}
              </div>
              <div className="text-xs text-muted-foreground">actief ~30 min</div>
            </div>
            {pages.length > 0 && (
              <ul className="mt-4 border-t border-border pt-3 text-xs text-[var(--fnl-ink-2)]">
                {pages.map((p, i) => (
                  <li key={i} className="flex justify-between gap-2 py-1">
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 truncate text-primary underline-offset-2 hover:underline"
                      title={p.url}
                    >
                      {realtimeUrlLabel(p.url)}
                    </a>
                    <span className="shrink-0 tabular-nums text-foreground">
                      {p.screenPageViews}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
