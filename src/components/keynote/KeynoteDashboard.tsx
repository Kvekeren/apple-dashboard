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
  KEYNOTE_PERIOD_LABELS,
  keynotePeriodRange,
  type KeynotePeriodKey,
} from "@/config/keynote";
import { BrandTabs } from "@/components/monitoring/brand-tabs";
import type { WwdcSortKey } from "@/components/wwdc/WwdcArticlesTable";
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

const PERIOD_TABS: KeynotePeriodKey[] = ["prevWeek", "thisWeek", "nextWeek"];

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
  const [activeBrand, setActiveBrand] = useState<SiteTitleId>("icreate");
  const [period, setPeriod] = useState<KeynotePeriodKey>("thisWeek");
  const [sortKey, setSortKey] = useState<WwdcSortKey>("pageviews");
  const [sortAsc, setSortAsc] = useState(false);
  const changeSort = (k: WwdcSortKey) => {
    if (k === sortKey) setSortAsc((v) => !v);
    else {
      setSortKey(k);
      setSortAsc(false);
    }
  };
  const [data, setData] = useState<KeynoteDashboardPayload | null>(() =>
    readKeynoteClientCache("thisWeek")
  );
  const [loading, setLoading] = useState(() => !readKeynoteClientCache("thisWeek"));
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

  const allRows = [...(data?.byBrand[activeBrand] ?? [])].sort((a, b) => {
    const diff = b[sortKey] - a[sortKey];
    return (sortAsc ? -diff : diff) || b.pageviews - a.pageviews;
  });
  const articleLimit = showAllArticles ? WWDC_TOP_ARTICLES_MAX : WWDC_TOP_ARTICLES;
  const rows = allRows.slice(0, articleLimit);
  const hasMoreArticles = !showAllArticles && allRows.length > WWDC_TOP_ARTICLES;
  const urlsForMeta = allRows.map((r) => r.url);
  const pageOgImages = useWwdcPageImages(urlsForMeta, allRows.length > 0);
  const topLabel = showAllArticles ? WWDC_TOP_ARTICLES_MAX : WWDC_TOP_ARTICLES;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Vorig jaar</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Wat deed het goed in dezelfde week vorig jaar? Kies de week geleden, de huidige of de
          volgende week; je ziet dan de best presterende artikelen uit hetzelfde weeknummer een jaar
          eerder (maandag t/m zondag). Discover en Google Search zijn klikken uit Search Console,
          nieuwsbrief zijn GA4-weergaven via nieuwsbriefsessies, weergaven zijn alle GA4-pageviews.
          Klik op een kolomkop om daarop te sorteren.
        </p>
      </header>

      <div className="fnl-segment w-full max-w-2xl" role="tablist" aria-label="Week">
        {PERIOD_TABS.map((id) => {
          const range = keynotePeriodRange(id);
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={period === id}
              data-active={period === id ? "true" : "false"}
              className="fnl-segment-item flex flex-1 flex-col items-center px-3 py-1.5 leading-tight"
              onClick={() => setPeriod(id)}
            >
              <span className="text-xs font-semibold sm:text-sm">{KEYNOTE_PERIOD_LABELS[id]}</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                week {range.isoWeek} · {formatPeriod(range.startDate, range.endDate)}
              </span>
            </button>
          );
        })}
      </div>

      <BrandTabs value={activeBrand} onChange={setActiveBrand} />

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
          <WwdcArticlesTable
            rows={rows}
            pageOgImages={pageOgImages}
            showViewsColumn
            sortKey={sortKey}
            sortAsc={sortAsc}
            onSortChange={changeSort}
          />
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
