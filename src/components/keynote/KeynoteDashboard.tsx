"use client";

import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { WwdcArticlesTable } from "@/components/wwdc/WwdcArticlesTable";
import {
  prefetchWwdcPageImages,
  useWwdcPageImages,
} from "@/components/wwdc/use-wwdc-page-images";
import {
  KEYNOTE_2025,
  KEYNOTE_PERIOD_LABELS,
  type KeynotePeriodKey,
} from "@/config/keynote";
import { WWDC_TOP_ARTICLES, WWDC_TOP_ARTICLES_MAX } from "@/config/wwdc";
import {
  clearKeynoteClientCache,
  KEYNOTE_CLIENT_PERIODS,
  readKeynoteClientCache,
  type KeynoteDashboardPayload,
  writeKeynoteClientCache,
} from "@/lib/keynote-client-cache";
import { clearWwdcPageMetaCache } from "@/lib/wwdc-page-meta-cache";
import type { SiteTitleId } from "@/lib/site-titles";

const BRAND_TABS: { id: SiteTitleId; label: string }[] = [
  { id: "icreate", label: "iCreate" },
  { id: "iphoned", label: "iPhoned" },
  { id: "iculture", label: "iCulture" },
];

const PERIOD_TABS: { id: KeynotePeriodKey; label: string }[] = [
  { id: "weekBefore", label: KEYNOTE_PERIOD_LABELS.weekBefore },
  { id: "startWwdc", label: KEYNOTE_PERIOD_LABELS.startWwdc },
  { id: "afterWwdc", label: KEYNOTE_PERIOD_LABELS.afterWwdc },
];

function formatPeriod(start: string, end: string): string {
  const startFmt = format(parseISO(start), "d MMMM", { locale: nl });
  const endFmt = format(parseISO(end), "d MMMM yyyy", { locale: nl });
  return start === end ? endFmt : `${startFmt} – ${endFmt}`;
}

function collectKeynoteArticleUrls(): string[] {
  const urls = new Set<string>();
  for (const period of KEYNOTE_CLIENT_PERIODS) {
    const payload = readKeynoteClientCache(period);
    if (!payload) continue;
    for (const rows of Object.values(payload.byBrand)) {
      for (const row of rows) urls.add(row.url);
    }
  }
  return [...urls];
}

export function KeynoteDashboard() {
  const config = KEYNOTE_2025;
  const [activeBrand, setActiveBrand] = useState<SiteTitleId>("icreate");
  const [period, setPeriod] = useState<KeynotePeriodKey>("weekBefore");
  const [data, setData] = useState<KeynoteDashboardPayload | null>(() =>
    readKeynoteClientCache("weekBefore")
  );
  const [loading, setLoading] = useState(() => !readKeynoteClientCache("weekBefore"));
  const [error, setError] = useState<string | null>(null);
  const [showAllArticles, setShowAllArticles] = useState(false);
  const prefetchStarted = useRef(false);

  const fetchPeriod = useCallback(async (targetPeriod: KeynotePeriodKey, force = false) => {
    if (!force) {
      const cached = readKeynoteClientCache(targetPeriod);
      if (cached) return cached;
    }

    const qs = new URLSearchParams({ period: targetPeriod });
    if (force) qs.set("refresh", "1");

    const res = await fetch(`/api/keynote?${qs}`, { credentials: "include" });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? "Data ophalen mislukt");
    }

    const payload = (await res.json()) as KeynoteDashboardPayload;
    writeKeynoteClientCache(targetPeriod, payload);
    return payload;
  }, []);

  const loadPeriod = useCallback(
    async (targetPeriod: KeynotePeriodKey, force = false, showLoading = true) => {
      if (!force) {
        const cached = readKeynoteClientCache(targetPeriod);
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

  const prefetchAllPeriods = useCallback(async (force = false) => {
    const missing = force
      ? KEYNOTE_CLIENT_PERIODS
      : KEYNOTE_CLIENT_PERIODS.filter((p) => !readKeynoteClientCache(p));
    if (!missing.length) return;

    await Promise.allSettled(
      missing.map(async (p) => {
        try {
          await fetchPeriod(p, force);
        } catch {
          /* per-periode fout — huidige tab toont eigen fout */
        }
      })
    );

    prefetchWwdcPageImages(collectKeynoteArticleUrls(), force);
  }, [fetchPeriod]);

  useEffect(() => {
    prefetchStarted.current = false;
    setData(readKeynoteClientCache(period));
    setLoading(!readKeynoteClientCache(period));
    setError(null);
    setShowAllArticles(false);
  }, [period]);

  useEffect(() => {
    void loadPeriod(period, false, !readKeynoteClientCache(period));
  }, [period, loadPeriod]);

  useEffect(() => {
    setShowAllArticles(false);
  }, [period, activeBrand]);

  useEffect(() => {
    if (prefetchStarted.current) return;
    prefetchStarted.current = true;
    void prefetchAllPeriods(false);
    prefetchWwdcPageImages(collectKeynoteArticleUrls());
  }, [prefetchAllPeriods]);

  useEffect(() => {
    if (!data) return;
    prefetchWwdcPageImages(collectKeynoteArticleUrls());
  }, [data]);

  useEffect(() => {
    function onRefresh() {
      clearKeynoteClientCache();
      clearWwdcPageMetaCache();
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
    window.addEventListener("keynote-refresh", onRefresh);
    return () => window.removeEventListener("keynote-refresh", onRefresh);
  }, [fetchPeriod, period, prefetchAllPeriods]);

  const allRows = data?.byBrand[activeBrand] ?? [];
  const articleLimit = showAllArticles ? WWDC_TOP_ARTICLES_MAX : WWDC_TOP_ARTICLES;
  const rows = allRows.slice(0, articleLimit);
  const hasMoreArticles = !showAllArticles && allRows.length > WWDC_TOP_ARTICLES;
  const urlsForMeta = allRows.map((r) => r.url);
  const pageOgImages = useWwdcPageImages(urlsForMeta, allRows.length > 0);
  const topLabel = showAllArticles ? WWDC_TOP_ARTICLES_MAX : WWDC_TOP_ARTICLES;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Keynote</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Analyse van best presterende artikelen rond het iPhone-event van{" "}
          {format(parseISO(config.startDate), "d MMMM yyyy", { locale: nl })}: week vóór keynote (
          {format(parseISO(config.weekBeforeStart), "d MMMM", { locale: nl })} –{" "}
          {format(parseISO(config.weekBeforeEnd), "d MMMM", { locale: nl })}), start keynote (
          {format(parseISO(config.startDate), "d MMMM yyyy", { locale: nl })}) en na keynote (
          {format(parseISO(config.afterStart), "d MMMM", { locale: nl })} –{" "}
          {format(parseISO(config.afterEnd), "d MMMM yyyy", { locale: nl })}). Gesorteerd op
          GA4-pageviews, met verkeersbron per kanaal. Discover en Google Search komen uit Search
          Console (clicks); nieuwsbrief = GA4 views per paginapad, incl. sessiebronnen zoals
          nieuwsbrief_ic, nieuwsbrief_ip en nieuwsbrief_iculture.
        </p>
        {data?.meta ? (
          <p className="mt-2 text-sm font-medium text-foreground">
            Periode: {formatPeriod(data.meta.startDate, data.meta.endDate)}
            <span className="ml-2 font-normal text-muted-foreground">({data.meta.periodLabel})</span>
          </p>
        ) : null}
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="fnl-segment w-full max-w-xl" role="tablist" aria-label="Periode">
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

      <div className="fnl-segment w-full max-w-lg" role="tablist" aria-label="Merk">
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
        <div className="py-16 text-center text-sm text-muted-foreground">Laden…</div>
      ) : error ? (
        <div
          role="alert"
          className="fnl-card border-[var(--fnl-warning)]/35 bg-[#fdf8ed] p-6 text-center text-sm text-[var(--fnl-ink-2)]"
        >
          {error}
        </div>
      ) : (
        <section>
          <h2 className="fnl-section-title mb-3">
            Meest gelezen artikelen (top {topLabel})
            {data?.meta ? (
              <span className="ml-2 font-normal text-sm text-muted-foreground">
                {formatPeriod(data.meta.startDate, data.meta.endDate)}
              </span>
            ) : null}
          </h2>
          <WwdcArticlesTable rows={rows} pageOgImages={pageOgImages} />
          {hasMoreArticles ? (
            <div className="mt-4 flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-[4px] text-primary hover:bg-[var(--fnl-blue-pale)]"
                onClick={() => setShowAllArticles(true)}
              >
                <ChevronDown className="size-4" />
                Meer artikelen
              </Button>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
