"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { ChevronDown, Download, Search } from "lucide-react";

import { BrandTabs, SegmentSwitch } from "@/components/monitoring/brand-tabs";
import { Button } from "@/components/ui/button";
import type { ConversieArtikelenPayload, ConversieArtikelRow } from "@/lib/conversie-artikelen";
import type { SiteTitleId } from "@/lib/site-titles";

type Days = "7" | "28" | "90";
const PERIODS = [
  { id: "7", label: "7 dagen" },
  { id: "28", label: "28 dagen" },
  { id: "90", label: "90 dagen" },
] as const satisfies readonly { id: Days; label: string }[];

type SortKey =
  | "sessions"
  | "pageviews"
  | "outboundClicks"
  | "ctr"
  | "nativeClicks"
  | "affiliateClicks"
  | "conversions"
  | "revenue"
  | "adRevenue"
  | "totalRevenue"
  | "rpm";

const PAGE_STEP = 50;

const nf = (n: number) => Math.round(n).toLocaleString("nl-NL");
const eur = (n: number) =>
  n.toLocaleString("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: n >= 100 ? 0 : 2 });
const pct = (n: number) => `${(n * 100).toLocaleString("nl-NL", { maximumFractionDigits: 1 })}%`;

function derived(r: ConversieArtikelRow) {
  const total = r.revenue + r.adRevenue;
  return {
    ctr: r.pageviews ? r.outboundClicks / r.pageviews : 0,
    totalRevenue: total,
    rpm: r.pageviews ? (total / r.pageviews) * 1000 : 0,
  };
}

/** Klikratio pas meetellen vanaf dit aantal pageviews (anders 1 view + 18 klikken = 1.800%). */
const MIN_PV_FOR_RATIO = 100;

function sortValue(r: ConversieArtikelRow, key: SortKey): number {
  if (key === "ctr" || key === "totalRevenue" || key === "rpm") return derived(r)[key];
  return r[key];
}

function toCsv(rows: ConversieArtikelRow[], payload: ConversieArtikelenPayload): string {
  const head = [
    "Pagina",
    "Type pagina",
    "Sessies",
    "Pageviews",
    "Uitklikken",
    "Klikratio",
    ...(payload.meta.hasNativeClicks ? ["Native klikken"] : []),
    ...(payload.meta.hasAffiliateClicks ? ["Affiliate-klikken (WCT)"] : []),
    payload.meta.conversionsLabel,
    payload.meta.revenueLabel,
    "Advertentie-omzet",
    "Totale omzet",
    "RPM",
  ];
  const esc = (v: string | number) => {
    const s = typeof v === "number" ? String(Math.round(v * 100) / 100).replace(".", ",") : v;
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((r) => {
    const d = derived(r);
    return [
      r.url,
      r.pageType,
      r.sessions,
      r.pageviews,
      r.outboundClicks,
      d.ctr,
      ...(payload.meta.hasNativeClicks ? [r.nativeClicks] : []),
      ...(payload.meta.hasAffiliateClicks ? [r.affiliateClicks] : []),
      r.conversions,
      r.revenue,
      r.adRevenue,
      d.totalRevenue,
      d.rpm,
    ]
      .map(esc)
      .join(";");
  });
  // Puntkomma + komma-decimalen: opent direct goed in Nederlandse Excel/Numbers.
  return [head.join(";"), ...lines].join("\n");
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[8px] border border-border bg-card p-3">
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">{value}</div>
      {sub ? <div className="text-[11px] text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

export function ConversieArtikelen() {
  const [brand, setBrand] = useState<SiteTitleId>("iphoned");
  const [days, setDays] = useState<Days>("28");
  const [data, setData] = useState<ConversieArtikelenPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("totalRevenue");
  const [sortAsc, setSortAsc] = useState(false);
  const [visible, setVisible] = useState(PAGE_STEP);

  const load = useCallback(
    async (refresh = false) => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ brand, days });
        if (refresh) qs.set("refresh", "1");
        const res = await fetch(`/api/conversies-artikelen?${qs}`, { credentials: "include" });
        if (!res.ok) {
          setData(null);
          setError(
            res.status === 401
              ? "Google-sessie verlopen. Log opnieuw in via het icoon rechtsboven."
              : "Conversiedata laden mislukt."
          );
          return;
        }
        setData((await res.json()) as ConversieArtikelenPayload);
      } catch {
        setData(null);
        setError("Conversiedata laden mislukt.");
      } finally {
        setLoading(false);
      }
    },
    [brand, days]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onRefresh = () => void load(true);
    window.addEventListener("conversions-refresh", onRefresh);
    return () => window.removeEventListener("conversions-refresh", onRefresh);
  }, [load]);

  const current = data?.brand === brand ? data : null;

  const types = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of current?.rows ?? []) counts.set(r.pageType, (counts.get(r.pageType) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [current]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (current?.rows ?? [])
      .filter((r) => typeFilter === "all" || r.pageType === typeFilter)
      .filter((r) => !q || r.path.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sortKey === "ctr") {
          // Pagina's met weinig pageviews altijd onderaan bij sorteren op klikratio.
          const aOk = a.pageviews >= MIN_PV_FOR_RATIO;
          const bOk = b.pageviews >= MIN_PV_FOR_RATIO;
          if (aOk !== bOk) return aOk ? -1 : 1;
        }
        const diff = sortValue(b, sortKey) - sortValue(a, sortKey);
        return (sortAsc ? -diff : diff) || b.pageviews - a.pageviews;
      });
  }, [current, query, typeFilter, sortKey, sortAsc]);

  const changeFilter = (fn: () => void) => {
    fn();
    setVisible(PAGE_STEP);
  };

  function downloadCsv() {
    if (!current) return;
    const blob = new Blob([`﻿${toCsv(rows, current)}`], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `conversies-${brand}-${current.meta.startDate}_${current.meta.endDate}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const t = current?.totals;
  const totalRevenue = t ? t.revenue + t.adRevenue : 0;
  const showAff = current?.meta.hasAffiliateClicks ?? true;
  const showNative = current?.meta.hasNativeClicks ?? false;
  const estimate = current?.meta.revenueIsEstimate ?? false;

  // Korte kolomkoppen in de tabel; de volledige namen staan bij de kerncijfers en in de CSV.
  const columns: { key: SortKey; label: string; title?: string; hidden?: boolean }[] = [
    { key: "sessions", label: "Sessies" },
    { key: "pageviews", label: "Pageviews" },
    { key: "outboundClicks", label: "Uitklikken" },
    { key: "ctr", label: "Klikratio", title: "Uitklikken per pageview" },
    { key: "nativeClicks", label: "Native", title: "Native klikken", hidden: !showNative },
    { key: "affiliateClicks", label: "WCT", title: "Affiliate-klikken (WeCanTrack)", hidden: !showAff },
    { key: "conversions", label: estimate ? "Sales" : "Aankopen", title: current?.meta.conversionsLabel },
    { key: "revenue", label: estimate ? "Commissie" : "Shop-omzet", title: current?.meta.revenueLabel },
    { key: "adRevenue", label: "Advertentie", title: "Advertentie-omzet" },
    { key: "totalRevenue", label: "Omzet", title: estimate ? "Omzet in GA4 (excl. CPC)" : "Totale omzet" },
    { key: "rpm", label: "RPM", title: "Omzet per 1.000 pageviews" },
  ];
  const visibleColumns = columns.filter((c) => !c.hidden);

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <BrandTabs
          value={brand}
          onChange={(b) => changeFilter(() => {
            setBrand(b);
            setTypeFilter("all");
          })}
        />
        <div className="flex flex-wrap items-center gap-3">
          <SegmentSwitch value={days} onChange={(d) => changeFilter(() => setDays(d))} options={PERIODS} ariaLabel="Periode" />
          {current ? (
            <span className="text-xs text-muted-foreground">
              {format(parseISO(current.meta.startDate), "d MMM", { locale: nl })} –{" "}
              {format(parseISO(current.meta.endDate), "d MMM yyyy", { locale: nl })} · GA4
            </span>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-sm text-[var(--fnl-danger)]">{error}</p> : null}

      {loading && !current ? (
        <div className="fnl-card py-16 text-center text-sm text-muted-foreground">Conversies laden…</div>
      ) : current && t ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <Kpi label="Pageviews" value={nf(t.pageviews)} sub={`${nf(t.sessions)} sessies`} />
            <Kpi label="Uitklikken" value={nf(t.outboundClicks)} sub={`klikratio ${pct(t.pageviews ? t.outboundClicks / t.pageviews : 0)}`} />
            {showNative ? <Kpi label="Native klikken" value={nf(t.nativeClicks)} /> : null}
            {showAff ? <Kpi label="Affiliate-klikken (WCT)" value={nf(t.affiliateClicks)} /> : null}
            <Kpi label={current.meta.conversionsLabel} value={nf(t.conversions + current.unattributed.conversions)} />
            <Kpi
              label={current.meta.revenueLabel}
              value={eur(t.revenue + current.unattributed.revenue)}
              sub={
                [
                  estimate ? "ongevalideerd, hoger dan goedgekeurd" : "",
                  current.unattributed.revenue > 0 ? `${eur(current.unattributed.revenue)} zonder pagina` : "",
                ]
                  .filter(Boolean)
                  .join(" · ") || undefined
              }
            />
            <Kpi label="Advertentie-omzet" value={eur(t.adRevenue + current.unattributed.adRevenue)} />
            <Kpi
              label={estimate ? "Omzet in GA4" : "Totale omzet"}
              value={eur(totalRevenue + current.unattributed.revenue + current.unattributed.adRevenue)}
              sub={estimate ? "excl. CPC-omzet" : undefined}
            />
            <Kpi label="RPM" value={eur(t.pageviews ? (totalRevenue / t.pageviews) * 1000 : 0)} sub="omzet per 1.000 pageviews" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-[8px] border border-border bg-card px-3 py-1.5 sm:max-w-xs">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => changeFilter(() => setQuery(e.target.value))}
                placeholder="Zoek in URL…"
                className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {["all", ...types].map((ty) => (
                <button
                  key={ty}
                  type="button"
                  onClick={() => changeFilter(() => setTypeFilter(ty))}
                  data-active={typeFilter === ty ? "true" : "false"}
                  className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground data-[active=true]:border-primary data-[active=true]:bg-[var(--fnl-blue-pale)] data-[active=true]:font-semibold data-[active=true]:text-primary"
                >
                  {ty === "all" ? "Alle types" : ty}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" className="ml-auto rounded-[4px]" onClick={downloadCsv}>
              <Download className="mr-1.5 size-4" />
              CSV
            </Button>
          </div>

          <div className="fnl-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-[11px] leading-tight text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Pagina</th>
                    <th className="px-2 py-2 text-left font-medium">Type</th>
                    {visibleColumns.map((c) => (
                      <th key={c.key} className="px-2 py-2 text-right font-medium">
                        <button
                          type="button"
                          onClick={() =>
                            changeFilter(() => {
                              if (sortKey === c.key) setSortAsc((v) => !v);
                              else {
                                setSortKey(c.key);
                                setSortAsc(false);
                              }
                            })
                          }
                          title={c.title}
                          aria-sort={sortKey === c.key ? (sortAsc ? "ascending" : "descending") : undefined}
                          className={`inline-flex items-center gap-1 hover:text-primary ${sortKey === c.key ? "font-semibold text-primary" : ""}`}
                        >
                          {c.label}
                          <span aria-hidden className={sortKey === c.key ? "" : "opacity-30"}>
                            {sortKey === c.key && sortAsc ? "↑" : "↓"}
                          </span>
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, visible).map((r) => {
                    const d = derived(r);
                    return (
                      <tr key={r.path} className="border-b border-border last:border-b-0 hover:bg-muted/30">
                        <td className="max-w-[260px] px-3 py-2">
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={r.url}
                            className="block truncate text-[12px] text-foreground underline-offset-2 hover:text-primary hover:underline"
                          >
                            {r.path}
                          </a>
                        </td>
                        <td className="px-2 py-2 text-xs text-muted-foreground">{r.pageType}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{nf(r.sessions)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{nf(r.pageviews)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{r.outboundClicks ? nf(r.outboundClicks) : "–"}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{r.outboundClicks ? pct(d.ctr) : "–"}</td>
                        {showNative ? (
                          <td className="px-2 py-2 text-right tabular-nums">{r.nativeClicks ? nf(r.nativeClicks) : "–"}</td>
                        ) : null}
                        {showAff ? (
                          <td className="px-2 py-2 text-right tabular-nums">{r.affiliateClicks ? nf(r.affiliateClicks) : "–"}</td>
                        ) : null}
                        <td className="px-2 py-2 text-right tabular-nums">{r.conversions ? nf(r.conversions) : "–"}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{r.revenue ? eur(r.revenue) : "–"}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{r.adRevenue ? eur(r.adRevenue) : "–"}</td>
                        <td className="px-2 py-2 text-right font-semibold tabular-nums">{d.totalRevenue ? eur(d.totalRevenue) : "–"}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{d.totalRevenue ? eur(d.rpm) : "–"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
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
          {estimate ? (
            <div className="rounded-[8px] border border-[var(--fnl-warning)]/35 bg-[#fdf8ed] px-4 py-3 text-xs leading-relaxed text-[var(--fnl-ink-2)]">
              <strong>Hoe betrouwbaar is dit?</strong> Vergeleken met de BigQuery-export van iPhoned
              (29 okt – 25 nov 2026) zijn sessies, uitklikken, native klikken en advertentie-omzet per
              pagina exact gelijk. Affiliate-sales en -commissie uit GA4 liggen ongeveer 1,7–1,8× hoger
              dan de goedgekeurde plus pending sales: GA4 telt op het moment van de sale, het netwerk
              keurt daarna een deel af. Affiliate-klikken (WCT) liggen ~1,4× hoger. <strong>CPC-klikken en
              CPC-omzet staan niet in GA4</strong>; bij iPhoned was dat in die periode met €35.531 de
              grootste omzetpost.
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Bron: GA4. {current.meta.revenueLabel} = omzet uit <code>purchase</code>-events
            {showAff ? " (WeCanTrack)" : " (shop)"}; advertentie-omzet = advertentie-inkomsten uit{" "}
            <code>ad_impression</code>
            {showNative
              ? estimate
                ? "; native klikken = uitklikken met type “native”"
                : "; uitklikken = alle clickout-events (affiliate, prijsvergelijker, shop, outbound, native); native = clickout_native"
              : ""}
            . Klikratio = uitklikken
            per pageview. RPM = omzet in GA4 per 1.000 pageviews.
          </p>
        </>
      ) : null}
    </div>
  );
}
