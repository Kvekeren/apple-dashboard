"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { MonitoringAuthGate } from "@/components/monitoring/auth-gate";
import { useMonitoringAuth } from "@/components/monitoring/monitoring-shell";
import { useRegisterPageRefresh } from "@/components/monitoring/monitoring-refresh-context";
import { HomeDashboard } from "@/components/monitoring/views/home-dashboard";
import {
  TOP_ARTICLES_INITIAL,
  TOP_ARTICLES_MAX,
  TOP_ARTICLES_STEP,
  aggregateGscTopUrlsBySource,
  aggregateWeeklyTopArticlesBySource,
  periodApiQuery,
  slugFromUrl,
  type CijfersData,
  type GscPayload,
  type PeriodPreset,
  type SiteCfg,
  type TopTenMetricFilter,
  SOURCE_LABELS,
} from "@/lib/monitoring/shared";
import { useFetchPageTitlesAndImages } from "@/lib/monitoring/use-fetch-page-meta";

export function HomePage() {
  const { gscConnected } = useMonitoringAuth();

  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("7d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const [yoyPeriodPreset, setYoyPeriodPreset] = useState<PeriodPreset>("7d");
  const [yoyCustomStart, setYoyCustomStart] = useState("");
  const [yoyCustomEnd, setYoyCustomEnd] = useState("");

  const [siteCfg, setSiteCfg] = useState<SiteCfg[] | null>(null);
  const [gscMap, setGscMap] = useState<Record<string, { clicks: number }>>({});
  const [gscSearchMap, setGscSearchMap] = useState<Record<string, { clicks: number }>>({});
  const [gscMeta, setGscMeta] = useState<{ startDate: string; endDate: string } | null>(null);

  const [topPg, setTopPg] = useState<
    { source: string; pageTitle: string; url: string; screenPageViews: number }[]
  >([]);
  const [topMeta, setTopMeta] = useState<{ startDate: string; endDate: string } | null>(null);
  const [topErr, setTopErr] = useState<string | null>(null);
  const [topTenMetric, setTopTenMetric] = useState<TopTenMetricFilter>("ga4");
  const [topArticlesVisible, setTopArticlesVisible] = useState(TOP_ARTICLES_INITIAL);

  const [rt, setRt] = useState<{
    data: { source: string; activeUsers: number }[];
    topPages: { source: string; url: string; pageTitle: string; screenPageViews: number }[];
  } | null>(null);
  const [rtLoad, setRtLoad] = useState(false);

  const [cjfYoy, setCjfYoy] = useState<CijfersData | null>(null);

  const topArticlesRangeQs = useMemo(
    () => periodApiQuery(periodPreset, customStart, customEnd),
    [periodPreset, customStart, customEnd]
  );

  const yoyRangeQs = useMemo(
    () => periodApiQuery(yoyPeriodPreset, yoyCustomStart, yoyCustomEnd),
    [yoyPeriodPreset, yoyCustomStart, yoyCustomEnd]
  );

  useEffect(() => {
    setTopArticlesVisible(TOP_ARTICLES_INITIAL);
  }, [topArticlesRangeQs, topTenMetric]);

  const urlsForTopOgFetch = useMemo(() => {
    const out: string[] = [];
    if (topTenMetric === "ga4") {
      const bySource = aggregateWeeklyTopArticlesBySource(
        topPg,
        SOURCE_LABELS,
        TOP_ARTICLES_MAX
      );
      for (const label of SOURCE_LABELS) {
        for (const row of (bySource[label] ?? []).slice(0, topArticlesVisible)) {
          out.push(row.url);
        }
      }
    } else {
      // Zelfde samenvoeging (AMP/querystring, geen homepage) als de getoonde lijst.
      const map = topTenMetric === "gsc-discover" ? gscMap : gscSearchMap;
      const bySource = aggregateGscTopUrlsBySource(map, SOURCE_LABELS, TOP_ARTICLES_MAX, (u) => u);
      for (const label of SOURCE_LABELS) {
        for (const row of (bySource[label] ?? []).slice(0, topArticlesVisible)) {
          out.push(row.url);
        }
      }
    }
    return out;
  }, [topTenMetric, topPg, gscMap, gscSearchMap, topArticlesVisible]);

  const { titles: discTit, images: pageOgImages } = useFetchPageTitlesAndImages(
    urlsForTopOgFetch,
    gscConnected
  );

  const resolveTopTitle = useCallback(
    (url: string) => discTit[url.replace(/\/$/, "")] ?? discTit[url] ?? slugFromUrl(url),
    [discTit]
  );

  const weeklyTopAllBySource = useMemo(() => {
    if (topTenMetric === "ga4") {
      return aggregateWeeklyTopArticlesBySource(topPg, SOURCE_LABELS, TOP_ARTICLES_MAX);
    }
    const map = topTenMetric === "gsc-discover" ? gscMap : gscSearchMap;
    return aggregateGscTopUrlsBySource(map, SOURCE_LABELS, TOP_ARTICLES_MAX, resolveTopTitle);
  }, [topTenMetric, topPg, gscMap, gscSearchMap, resolveTopTitle]);

  const hasMoreTopArticles = useMemo(
    () =>
      SOURCE_LABELS.some(
        (label) => (weeklyTopAllBySource[label]?.length ?? 0) > topArticlesVisible
      ),
    [weeklyTopAllBySource, topArticlesVisible]
  );

  useEffect(() => {
    fetch("/api/site-config")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.titles && setSiteCfg(j.titles))
      .catch(() => {});
  }, []);

  const loadGsc = useCallback(
    async (ref = false) => {
      try {
        const u = ref
          ? `/api/search-console?${topArticlesRangeQs}&refresh=1`
          : `/api/search-console?${topArticlesRangeQs}`;
        const res = await fetch(u, { credentials: "include" });
        if (!res.ok) {
          setGscSearchMap({});
          return;
        }
        const data = (await res.json()) as GscPayload;
        setGscMap(data.discoverByUrl ?? {});
        setGscSearchMap(data.searchWebByUrl ?? {});
        setGscMeta(data.meta ?? null);
      } catch {
        setGscMap({});
        setGscSearchMap({});
      }
    },
    [topArticlesRangeQs]
  );

  const loadTop = useCallback(
    async (ref = false) => {
      setTopErr(null);
      const u = ref
        ? `/api/ga4-top-pages?${topArticlesRangeQs}&refresh=1`
        : `/api/ga4-top-pages?${topArticlesRangeQs}`;
      try {
        const res = await fetch(u, { credentials: "include" });
        if (!res.ok) {
          setTopPg([]);
          setTopErr(
            res.status === 401
              ? "Google-sessie verlopen. Log opnieuw in via het groene icoon rechtsboven."
              : "Top-artikelen laden mislukt."
          );
          return;
        }
        const j = await res.json();
        setTopPg(j.rows ?? []);
        setTopMeta(j.meta ?? null);
      } catch {
        setTopPg([]);
        setTopErr("Top-artikelen laden mislukt.");
      }
    },
    [topArticlesRangeQs]
  );

  const loadCjfYoy = useCallback(
    async (ref = false) => {
      setCjfYoy(null);
      try {
        const q = ref ? `${yoyRangeQs}&refresh=1` : yoyRangeQs;
        const res = await fetch(`/api/cijfers?${q}&compare=yoy`, { credentials: "include" });
        setCjfYoy(res.ok ? await res.json() : null);
      } catch {
        setCjfYoy(null);
      }
    },
    [yoyRangeQs]
  );

  const loadRt = useCallback(async () => {
    setRtLoad(true);
    try {
      const res = await fetch("/api/ga4-realtime", { credentials: "include" });
      setRt(res.ok ? await res.json() : null);
    } catch {
      setRt(null);
    } finally {
      setRtLoad(false);
    }
  }, []);

  useEffect(() => {
    if (!gscConnected) return;
    void loadGsc();
    void loadTop();
    void loadCjfYoy();
    void loadRt();
  }, [gscConnected, loadGsc, loadTop, loadCjfYoy, loadRt]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadGsc(true), loadTop(true), loadCjfYoy(true), loadRt()]);
  }, [loadGsc, loadTop, loadCjfYoy, loadRt]);

  useRegisterPageRefresh(gscConnected ? refreshAll : null, gscConnected);

  if (!gscConnected) {
    return null;
  }

  return (
    <MonitoringAuthGate>
      <HomeDashboard
        gscMeta={gscMeta}
        topErr={topErr}
        topMeta={topMeta}
        periodPreset={periodPreset}
        setPeriodPreset={setPeriodPreset}
        customStart={customStart}
        setCustomStart={setCustomStart}
        customEnd={customEnd}
        setCustomEnd={setCustomEnd}
        yoyPeriodPreset={yoyPeriodPreset}
        setYoyPeriodPreset={setYoyPeriodPreset}
        yoyCustomStart={yoyCustomStart}
        setYoyCustomStart={setYoyCustomStart}
        yoyCustomEnd={yoyCustomEnd}
        setYoyCustomEnd={setYoyCustomEnd}
        topTenMetric={topTenMetric}
        setTopTenMetric={setTopTenMetric}
        weeklyTopAllBySource={weeklyTopAllBySource}
        topArticlesVisible={topArticlesVisible}
        hasMoreTopArticles={hasMoreTopArticles}
        onLoadMoreTopArticles={() =>
          setTopArticlesVisible((n) => Math.min(n + TOP_ARTICLES_STEP, TOP_ARTICLES_MAX))
        }
        pageOgImages={pageOgImages}
        siteCfg={siteCfg}
        rtLoad={rtLoad}
        rt={rt}
        onRefreshRt={loadRt}
        cjfYoy={cjfYoy}
      />
    </MonitoringAuthGate>
  );
}
