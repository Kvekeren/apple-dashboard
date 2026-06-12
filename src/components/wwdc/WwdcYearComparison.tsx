"use client";

import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { useCallback, useEffect, useRef, useState } from "react";

import type { WwdcComparePayload } from "@/app/api/wwdc/compare/route";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { WwdcPeriodKey } from "@/config/wwdc";
import {
  clearWwdcCompareClientCache,
  readWwdcCompareClientCache,
  WWDC_COMPARE_PERIODS,
  writeWwdcCompareClientCache,
} from "@/lib/wwdc-compare-client-cache";
import type { SiteTitleId } from "@/lib/site-titles";
import type { WwdcBrandTotals } from "@/lib/wwdc-traffic";

const BRAND_TABS: { id: SiteTitleId; label: string }[] = [
  { id: "icreate", label: "iCreate" },
  { id: "iphoned", label: "iPhoned" },
  { id: "iculture", label: "iCulture" },
];

const PERIOD_TABS: { id: WwdcPeriodKey; label: string }[] = [
  { id: "weekBefore", label: "Week vóór WWDC" },
  { id: "startWwdc", label: "Start WWDC" },
  { id: "afterWwdc", label: "Na WWDC" },
];

type MetricKey = keyof WwdcBrandTotals;

const METRIC_ROWS: { key: MetricKey; label: string }[] = [
  { key: "pageviews", label: "Pageviews (GA4)" },
  { key: "discover", label: "Discover (GSC)" },
  { key: "googleSearch", label: "Google Search (GSC)" },
  { key: "newsletter", label: "Nieuwsbrief (GA4)" },
];

function formatPeriod(start: string, end: string): string {
  const startFmt = format(parseISO(start), "d MMMM", { locale: nl });
  const endFmt = format(parseISO(end), "d MMMM yyyy", { locale: nl });
  return start === end ? endFmt : `${startFmt} – ${endFmt}`;
}

function formatChange(current: number, previous: number): {
  text: string;
  className: string;
} {
  if (previous <= 0) {
    return { text: "—", className: "text-muted-foreground" };
  }
  const change = current - previous;
  const changePercent = Math.round((change / previous) * 100);
  const positive = change > 0;
  const negative = change < 0;
  return {
    text: `${positive ? "+" : ""}${changePercent}%`,
    className: positive
      ? "text-[var(--fnl-success)]"
      : negative
        ? "text-[var(--fnl-danger)]"
        : "text-muted-foreground",
  };
}

export function WwdcYearComparison() {
  const [activeBrand, setActiveBrand] = useState<SiteTitleId>("icreate");
  const [period, setPeriod] = useState<WwdcPeriodKey>("weekBefore");
  const [data, setData] = useState<WwdcComparePayload | null>(() =>
    readWwdcCompareClientCache("weekBefore")
  );
  const [loading, setLoading] = useState(() => !readWwdcCompareClientCache("weekBefore"));
  const [error, setError] = useState<string | null>(null);
  const prefetchStarted = useRef(false);

  const fetchPeriod = useCallback(async (targetPeriod: WwdcPeriodKey, force = false) => {
    if (!force) {
      const cached = readWwdcCompareClientCache(targetPeriod);
      if (cached) return cached;
    }

    const qs = new URLSearchParams({ period: targetPeriod });
    if (force) qs.set("refresh", "1");

    const res = await fetch(`/api/wwdc/compare?${qs}`, { credentials: "include" });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? "Vergelijking ophalen mislukt");
    }

    const payload = (await res.json()) as WwdcComparePayload;
    writeWwdcCompareClientCache(targetPeriod, payload);
    return payload;
  }, []);

  const loadPeriod = useCallback(
    async (targetPeriod: WwdcPeriodKey, force = false, showLoading = true) => {
      if (!force) {
        const cached = readWwdcCompareClientCache(targetPeriod);
        if (cached) {
          setData(cached);
          setError(null);
          setLoading(false);
          return;
        }
      }

      if (showLoading) setLoading(true);
      setError(null);
      try {
        const payload = await fetchPeriod(targetPeriod, force);
        setData(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Onbekende fout");
        if (force) setData(null);
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [fetchPeriod]
  );

  const prefetchAllPeriods = useCallback(
    async (force = false) => {
      const missing = force
        ? WWDC_COMPARE_PERIODS
        : WWDC_COMPARE_PERIODS.filter((p) => !readWwdcCompareClientCache(p));
      if (!missing.length) return;

      await Promise.allSettled(
        missing.map(async (p) => {
          try {
            await fetchPeriod(p, force);
          } catch {
            /* per-periode fout */
          }
        })
      );
    },
    [fetchPeriod]
  );

  useEffect(() => {
    void loadPeriod(period, false, !readWwdcCompareClientCache(period));
  }, [period, loadPeriod]);

  useEffect(() => {
    if (prefetchStarted.current) return;
    prefetchStarted.current = true;
    void prefetchAllPeriods(false);
  }, [prefetchAllPeriods]);

  useEffect(() => {
    function onRefresh(event: Event) {
      const detail = (event as CustomEvent<{ year?: number }>).detail;
      if (detail?.year != null && detail.year !== 2026) return;

      clearWwdcCompareClientCache();
      void (async () => {
        setLoading(true);
        setError(null);
        try {
          await prefetchAllPeriods(true);
          const payload = await fetchPeriod(period, true);
          setData(payload);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Onbekende fout");
          setData(null);
        } finally {
          setLoading(false);
        }
      })();
    }
    window.addEventListener("wwdc-refresh", onRefresh);
    return () => window.removeEventListener("wwdc-refresh", onRefresh);
  }, [fetchPeriod, period, prefetchAllPeriods]);

  const brandData = data?.byBrand[activeBrand];
  const y2026 = brandData?.y2026;
  const y2025 = brandData?.y2025;

  return (
    <section className="space-y-6 border-t border-border pt-8">
      <header>
        <h2 className="fnl-section-title">WWDC 2026 vs 2025</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Totaalcijfers per merk en periode: pageviews (GA4), Discover- en Google
          Search-clicks (GSC) en nieuwsbrief-pageviews (GA4).
        </p>
        {data?.meta ? (
          <div className="mt-2 space-y-1 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">2026:</span>{" "}
              {formatPeriod(data.meta.dates2026.startDate, data.meta.dates2026.endDate)}
            </p>
            <p>
              <span className="font-medium text-foreground">2025:</span>{" "}
              {formatPeriod(data.meta.dates2025.startDate, data.meta.dates2025.endDate)}
            </p>
          </div>
        ) : null}
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="fnl-segment w-full max-w-xl" role="tablist" aria-label="Periode vergelijking">
          {PERIOD_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={period === tab.id}
              data-active={period === tab.id ? "true" : "false"}
              className="fnl-segment-item flex-1 px-3 py-2 text-xs font-medium sm:text-sm"
              onClick={() => setPeriod(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="fnl-segment w-full max-w-lg" role="tablist" aria-label="Merk vergelijking">
        {BRAND_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeBrand === tab.id}
            data-active={activeBrand === tab.id ? "true" : "false"}
            className="fnl-segment-item flex-1 px-4 py-2 text-sm font-medium"
            onClick={() => setActiveBrand(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Laden…</div>
      ) : error ? (
        <div
          role="alert"
          className="fnl-card border-[var(--fnl-warning)]/35 bg-[#fdf8ed] p-6 text-center text-sm text-[var(--fnl-ink-2)]"
        >
          {error}
        </div>
      ) : y2026 && y2025 ? (
        <div className="fnl-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Kanaal</TableHead>
                <TableHead className="w-[140px] text-right">2026</TableHead>
                <TableHead className="w-[140px] text-right">2025</TableHead>
                <TableHead className="w-[100px] text-right">Verschil</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {METRIC_ROWS.map(({ key, label }) => {
                const current = y2026[key];
                const previous = y2025[key];
                const change = formatChange(current, previous);
                return (
                  <TableRow key={key}>
                    <TableCell className="font-medium">{label}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {current.toLocaleString("nl-NL")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {previous.toLocaleString("nl-NL")}
                    </TableCell>
                    <TableCell className={`text-right text-sm font-semibold tabular-nums ${change.className}`}>
                      {change.text}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="fnl-card p-6 text-center text-sm text-muted-foreground">
          Geen vergelijkingsdata beschikbaar.
        </div>
      )}
    </section>
  );
}
