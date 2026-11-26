"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { ChevronDown } from "lucide-react";

import { BrandTabs, SegmentSwitch } from "@/components/monitoring/brand-tabs";
import { MonitoringAuthGate } from "@/components/monitoring/auth-gate";
import { useMonitoringAuth } from "@/components/monitoring/monitoring-shell";
import { useRegisterPageRefresh } from "@/components/monitoring/monitoring-refresh-context";
import { Button } from "@/components/ui/button";
import type { ArtikelenPayload, ArtikelRow } from "@/lib/artikelen";
import type { SiteTitleId } from "@/lib/site-titles";

type Days = "7" | "28" | "90" | "365";
type View = "top" | "recent";

const PERIODS = [
  { id: "7", label: "7 dagen" },
  { id: "28", label: "28 dagen" },
  { id: "90", label: "90 dagen" },
  { id: "365", label: "12 maanden" },
] as const satisfies readonly { id: Days; label: string }[];

const VIEWS = [
  { id: "top", label: "Uitschieters" },
  { id: "recent", label: "Chronologisch" },
] as const satisfies readonly { id: View; label: string }[];

const PAGE_STEP = 50;

type Dagdeel = "ochtend" | "middag" | "avond" | "nacht";
const DAGDELEN: { id: Dagdeel; label: string; range: string }[] = [
  { id: "ochtend", label: "Ochtend", range: "06–12 uur" },
  { id: "middag", label: "Middag", range: "12–18 uur" },
  { id: "avond", label: "Avond", range: "18–24 uur" },
  { id: "nacht", label: "Nacht", range: "00–06 uur" },
];

function dagdeelFor(time: string | null): Dagdeel | null {
  if (!time) return null;
  const h = parseInt(time.slice(0, 2), 10);
  if (Number.isNaN(h)) return null;
  if (h < 6) return "nacht";
  if (h < 12) return "ochtend";
  if (h < 18) return "middag";
  return "avond";
}

function isWeekend(date: string | null): boolean | null {
  if (!date) return null;
  const d = parseISO(date).getDay();
  return d === 0 || d === 6;
}

const WEEKDAYS = ["zo", "ma", "di", "wo", "do", "vr", "za"];

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
}

function nf(n: number): string {
  return n.toLocaleString("nl-NL");
}

type Bucket = { label: string; sub: string; count: number; median: number; avg: number };

function bucketStats(label: string, sub: string, rows: ArtikelRow[]): Bucket {
  const pv = rows.map((r) => r.pageviews);
  return {
    label,
    sub,
    count: rows.length,
    median: median(pv),
    avg: pv.length ? Math.round(pv.reduce((a, b) => a + b, 0) / pv.length) : 0,
  };
}

function TimingInsights({ rows }: { rows: ArtikelRow[] }) {
  const dated = rows.filter((r) => r.inPeriod && r.publishedDate && r.publishedTime);
  if (dated.length < 5) return null;

  const dagdeelBuckets = DAGDELEN.map((d) =>
    bucketStats(
      d.label,
      d.range,
      dated.filter((r) => dagdeelFor(r.publishedTime) === d.id)
    )
  );
  const weekBuckets = [
    bucketStats("Doordeweeks", "ma–vr", dated.filter((r) => isWeekend(r.publishedDate) === false)),
    bucketStats("Weekend", "za–zo", dated.filter((r) => isWeekend(r.publishedDate) === true)),
  ];
  // Alleen groepen met genoeg artikelen komen in aanmerking als "beste" moment.
  const all = [...dagdeelBuckets, ...weekBuckets].filter((b) => b.count >= 10);
  const best = all.length ? Math.max(...all.map((b) => b.median)) : 0;

  const Tile = ({ b }: { b: Bucket }) => {
    const top = b.count >= 10 && b.median === best && best > 0;
    return (
      <div
        className={`rounded-[8px] border p-3 ${
          top ? "border-primary/40 bg-[var(--fnl-blue-pale)]" : "border-border bg-card"
        }`}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-foreground">{b.label}</span>
          <span className="text-[11px] text-muted-foreground">{b.sub}</span>
        </div>
        <div className="mt-1.5 text-xl font-semibold tabular-nums text-foreground">
          {b.count ? nf(b.median) : "–"}
        </div>
        <div className="text-[11px] text-muted-foreground">
          mediaan pageviews · {nf(b.count)} artikelen
          {b.count ? ` · gem. ${nf(b.avg)}` : ""}
        </div>
      </div>
    );
  };

  return (
    <section className="fnl-card p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="fnl-section-title">Wanneer publiceren?</h2>
        <p className="text-xs text-muted-foreground">
          Op basis van {nf(dated.length)} artikelen uit deze periode. Mediaan, zodat één uitschieter
          het beeld niet scheeftrekt.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {dagdeelBuckets.map((b) => (
          <Tile key={b.label} b={b} />
        ))}
        {weekBuckets.map((b) => (
          <Tile key={b.label} b={b} />
        ))}
      </div>
    </section>
  );
}

function PublishedCell({ row }: { row: ArtikelRow }) {
  if (!row.publishedDate) {
    return <span className="text-xs text-muted-foreground">onbekend</span>;
  }
  const d = parseISO(row.publishedDate);
  const deel = dagdeelFor(row.publishedTime);
  const weekend = isWeekend(row.publishedDate);
  return (
    <div className="leading-tight">
      <div className="text-xs tabular-nums text-foreground">
        <span>
          {WEEKDAYS[d.getDay()]} {format(d, "d MMM yyyy", { locale: nl })}
        </span>
        {row.publishedTime ? <span className="text-muted-foreground"> · {row.publishedTime}</span> : null}
      </div>
      <div className="mt-0.5 flex gap-1">
        {deel ? (
          <span className="rounded-[3px] bg-muted px-1.5 py-px text-[10px] font-medium text-muted-foreground capitalize">
            {deel}
          </span>
        ) : null}
        {weekend ? (
          <span className="rounded-[3px] bg-[var(--fnl-blue-pale)] px-1.5 py-px text-[10px] font-medium text-primary">
            weekend
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ArticleTable({ rows, maxViews, ranked }: { rows: ArtikelRow[]; maxViews: number; ranked: boolean }) {
  return (
    <div className="fnl-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
              <th className="w-10 px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Artikel</th>
              <th className="w-48 px-3 py-2 font-medium">Gepubliceerd</th>
              <th className="w-40 px-3 py-2 text-right font-medium">Pageviews</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.url} className="border-b border-border last:border-b-0 hover:bg-muted/30">
                <td className="px-3 py-2.5 align-top text-xs tabular-nums text-muted-foreground">
                  {ranked ? i + 1 : ""}
                </td>
                <td className="px-3 py-2.5 align-top">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] leading-snug text-foreground underline-offset-2 hover:text-primary hover:underline"
                  >
                    {r.title || r.url}
                  </a>
                  {r.type ? (
                    <span className="ml-2 inline-block rounded-[3px] border border-border px-1.5 py-px align-middle text-[10px] text-muted-foreground">
                      {r.type}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 align-top">
                  <PublishedCell row={r} />
                </td>
                <td className="px-3 py-2.5 align-top">
                  <div className="text-right text-sm font-semibold tabular-nums text-foreground">
                    {nf(r.pageviews)}
                  </div>
                  <div className="mt-1 h-1 w-full rounded-full bg-muted">
                    <div
                      className="h-1 rounded-full bg-primary/70"
                      style={{ width: `${maxViews ? Math.max(2, (r.pageviews / maxViews) * 100) : 0}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ArtikelenPage() {
  const { gscConnected } = useMonitoringAuth();
  const [brand, setBrand] = useState<SiteTitleId>("icreate");
  const [days, setDays] = useState<Days>("28");
  const [view, setView] = useState<View>("top");
  const [onlyInPeriod, setOnlyInPeriod] = useState(true);
  const [visible, setVisible] = useState(PAGE_STEP);
  const [data, setData] = useState<ArtikelenPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ brand, days });
        if (refresh) qs.set("refresh", "1");
        const res = await fetch(`/api/artikelen?${qs}`, { credentials: "include" });
        if (!res.ok) {
          setData(null);
          setError(
            res.status === 401
              ? "Google-sessie verlopen. Log opnieuw in via het icoon rechtsboven."
              : "Artikelen laden mislukt."
          );
          return;
        }
        setData((await res.json()) as ArtikelenPayload);
      } catch {
        setData(null);
        setError("Artikelen laden mislukt.");
      } finally {
        setLoading(false);
      }
    },
    [brand, days]
  );

  useEffect(() => {
    if (gscConnected) void load();
  }, [gscConnected, load]);

  useEffect(() => setVisible(PAGE_STEP), [brand, days, view, onlyInPeriod]);

  const refresh = useCallback(() => load(true), [load]);
  useRegisterPageRefresh(gscConnected ? refresh : null, gscConnected);

  const rows = useMemo(() => {
    const all = data?.brand === brand ? data.rows : [];
    if (view === "recent") {
      return all
        .filter((r) => r.inPeriod && r.publishedDate)
        .sort((a, b) =>
          `${b.publishedDate}${b.publishedTime ?? ""}`.localeCompare(
            `${a.publishedDate}${a.publishedTime ?? ""}`
          )
        );
    }
    return all.filter((r) => !onlyInPeriod || r.inPeriod).sort((a, b) => b.pageviews - a.pageviews);
  }, [data, brand, view, onlyInPeriod]);

  const maxViews = useMemo(() => rows.reduce((m, r) => Math.max(m, r.pageviews), 0), [rows]);
  const shown = rows.slice(0, visible);

  return (
    <MonitoringAuthGate>
      <div className="mb-10 space-y-5">
        <header className="space-y-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Artikelen</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Per titel de grootste uitschieters in pageviews (GA4), met publicatiedatum en -tijd. Of
              chronologisch, om snel te zien hoe recente artikelen het doen.
            </p>
          </div>
          <BrandTabs value={brand} onChange={setBrand} />
          <div className="flex flex-wrap items-center gap-3">
            <SegmentSwitch value={days} onChange={setDays} options={PERIODS} ariaLabel="Periode" />
            <SegmentSwitch value={view} onChange={setView} options={VIEWS} ariaLabel="Weergave" />
            {view === "top" ? (
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={onlyInPeriod}
                  onChange={(e) => setOnlyInPeriod(e.target.checked)}
                  className="size-4 accent-[var(--primary)]"
                />
                Alleen artikelen gepubliceerd in deze periode
              </label>
            ) : null}
          </div>
          {data?.brand === brand ? (
            <p className="text-xs text-muted-foreground">
              Pageviews van {format(parseISO(data.meta.startDate), "d MMMM yyyy", { locale: nl })} t/m{" "}
              {format(parseISO(data.meta.endDate), "d MMMM yyyy", { locale: nl })}. Artikelen van de
              laatste dagen hebben nog minder tijd gehad om views te verzamelen.
              {data.missingDates > 0
                ? ` Van ${nf(data.missingDates)} toppagina's is de publicatiedatum nog onbekend; die vullen zich bij een volgende verversing aan.`
                : ""}
            </p>
          ) : null}
        </header>

        {error ? <p className="text-sm text-[var(--fnl-danger)]">{error}</p> : null}

        {loading && data?.brand !== brand ? (
          <div className="fnl-card py-16 text-center text-sm text-muted-foreground">
            Artikelen laden… (bij 90 dagen of 12 maanden kan dit de eerste keer even duren)
          </div>
        ) : data?.brand === brand ? (
          <>
            {loading ? <p className="text-xs text-muted-foreground">Verversen…</p> : null}
            <TimingInsights rows={data.rows} />
            {rows.length ? (
              <ArticleTable rows={shown} maxViews={maxViews} ranked={view === "top"} />
            ) : (
              <div className="fnl-card py-12 text-center text-sm text-muted-foreground">
                Geen artikelen gevonden voor deze periode.
              </div>
            )}
            {rows.length > visible ? (
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-[4px] text-primary hover:bg-[var(--fnl-blue-pale)]"
                  onClick={() => setVisible((n) => n + PAGE_STEP)}
                >
                  <ChevronDown className="size-4" />
                  Meer tonen ({nf(rows.length - visible)} over)
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </MonitoringAuthGate>
  );
}
