"use client";

import { useCallback, useEffect, useState } from "react";

import { ConversionEngagementMetricDetailPanel } from "@/components/conversions/ConversionEngagementMetricDetailPanel";
import { ConversionEventDetailPanel } from "@/components/conversions/ConversionEventDetailPanel";
import {
  ConversionEventsTable,
  eventOptionsForBrand,
  groupOptionsForBrand,
} from "@/components/conversions/ConversionEventsTable";
import { ConversionFunnels } from "@/components/conversions/ConversionFunnels";
import { ConversionKpiCards } from "@/components/conversions/ConversionKpiCards";
import { ConversionTrendChart } from "@/components/conversions/ConversionTrendChart";
import { TopConversionPagesTable } from "@/components/conversions/TopConversionPagesTable";
import {
  isConversionMetricRow,
  parseConversionMetricRowId,
} from "@/lib/conversion-format";
import {
  conversionApiQuery,
  conversionEventDetailApiQuery,
  conversionMetricDetailApiQuery,
  conversionTrendApiQuery,
} from "@/lib/conversion-query";
import type {
  ConversionCompareMode,
  ConversionEngagementMetricDetail,
  ConversionEventDetail,
  ConversionPeriodPreset,
  ConversionSummaryPayload,
  ConversionTrendPayload,
} from "@/lib/conversion-types";
import type { ConversionGroupFilterId } from "@/config/conversion-events";
import type { SiteTitleId } from "@/lib/site-titles";

export function ConversionBrandTab({
  brandId,
  periodPreset,
  customStart,
  customEnd,
  compareMode,
  groupFilter,
}: {
  brandId: SiteTitleId;
  periodPreset: ConversionPeriodPreset;
  customStart: string;
  customEnd: string;
  compareMode: ConversionCompareMode;
  groupFilter: ConversionGroupFilterId;
}) {
  const [summary, setSummary] = useState<ConversionSummaryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [trendData, setTrendData] = useState<ConversionTrendPayload | null>(null);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendError, setTrendError] = useState<string | null>(null);
  const [trendEvent, setTrendEvent] = useState(() => eventOptionsForBrand(brandId)[0]?.name ?? "");
  const [trendGroup, setTrendGroup] = useState<string>("all");
  const [trendGranularity, setTrendGranularity] = useState<"day" | "week" | "month">("week");

  const [selectedRow, setSelectedRow] = useState<string | null>(null);
  const [eventDetail, setEventDetail] = useState<ConversionEventDetail | null>(null);
  const [metricDetail, setMetricDetail] = useState<ConversionEngagementMetricDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const qs = conversionApiQuery({
    brand: brandId,
    preset: periodPreset,
    customStart,
    customEnd,
    compareMode,
    groupFilter,
  });

  const loadSummary = useCallback(
    async (ref = false) => {
      setLoading(true);
      setError(null);
      try {
        const url = ref ? `/api/conversions?${qs}&refresh=1` : `/api/conversions?${qs}`;
        const res = await fetch(url, { credentials: "include" });
        const body = await res.json();
        if (!res.ok) {
          setSummary(null);
          setError(body.error ?? "Data ophalen mislukt.");
          return;
        }
        setSummary(body);
      } catch {
        setSummary(null);
        setError("Data ophalen mislukt.");
      } finally {
        setLoading(false);
      }
    },
    [qs]
  );

  const loadTrend = useCallback(async () => {
    setTrendLoading(true);
    setTrendError(null);
    try {
      const trendQs = conversionTrendApiQuery({
        brand: brandId,
        eventName: trendGroup === "all" ? trendEvent : "",
        granularity: trendGranularity,
        preset: "ytd",
      });
      const groupQs = trendGroup !== "all" ? `&group=${trendGroup}` : "";
      const res = await fetch(`/api/conversions/trend?${trendQs}${groupQs}`, {
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok) {
        setTrendData(null);
        setTrendError(body.error ?? "Trend ophalen mislukt.");
        return;
      }
      setTrendData(body);
    } catch {
      setTrendData(null);
      setTrendError("Trend ophalen mislukt.");
    } finally {
      setTrendLoading(false);
    }
  }, [brandId, trendEvent, trendGroup, trendGranularity]);

  const loadEventDetail = useCallback(
    async (eventName: string) => {
      setDetailLoading(true);
      setSelectedRow(eventName);
      setMetricDetail(null);
      try {
        const detailQs = conversionEventDetailApiQuery({
          brand: brandId,
          eventName,
          preset: periodPreset,
          customStart,
          customEnd,
          compareMode,
        });
        const res = await fetch(`/api/conversions/event-detail?${detailQs}`, {
          credentials: "include",
        });
        const body = await res.json();
        if (!res.ok) {
          setEventDetail(null);
          return;
        }
        setEventDetail(body);
      } catch {
        setEventDetail(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [brandId, periodPreset, customStart, customEnd, compareMode]
  );

  const loadMetricDetail = useCallback(
    async (rowName: string) => {
      const metricId = parseConversionMetricRowId(rowName);
      if (!metricId) return;

      setDetailLoading(true);
      setSelectedRow(rowName);
      setEventDetail(null);
      try {
        const detailQs = conversionMetricDetailApiQuery({
          brand: brandId,
          metricId,
          preset: periodPreset,
          customStart,
          customEnd,
          compareMode,
        });
        const res = await fetch(`/api/conversions/metric-detail?${detailQs}`, {
          credentials: "include",
        });
        const body = await res.json();
        if (!res.ok) {
          setMetricDetail(null);
          return;
        }
        setMetricDetail(body);
      } catch {
        setMetricDetail(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [brandId, periodPreset, customStart, customEnd, compareMode]
  );

  const loadRowDetail = useCallback(
    (rowName: string) => {
      if (isConversionMetricRow(rowName)) void loadMetricDetail(rowName);
      else void loadEventDetail(rowName);
    },
    [loadEventDetail, loadMetricDetail]
  );

  const closeDetail = useCallback(() => {
    setSelectedRow(null);
    setEventDetail(null);
    setMetricDetail(null);
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    const onRefresh = () => void loadSummary(true);
    window.addEventListener("conversions-refresh", onRefresh);
    return () => window.removeEventListener("conversions-refresh", onRefresh);
  }, [loadSummary]);

  useEffect(() => {
    void loadTrend();
  }, [loadTrend]);

  useEffect(() => {
    const opts = eventOptionsForBrand(brandId);
    if (opts.length > 0 && !opts.some((o) => o.name === trendEvent)) {
      setTrendEvent(opts[0]!.name);
    }
  }, [brandId, trendEvent]);

  if (loading && !summary) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Conversies laden…</div>;
  }

  if (error) {
    return (
      <div className="fnl-card p-6 text-center text-sm text-[var(--fnl-danger)]">{error}</div>
    );
  }

  if (!summary?.meta.hasGa4Property) {
    return (
      <div className="fnl-card p-6 text-center text-sm text-muted-foreground">
        GA4-property ontbreekt voor {summary?.meta.brandLabel ?? brandId}. Controleer de
        omgevingsvariabelen.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <ConversionKpiCards kpis={summary.kpis} />

      <section>
        <h3 className="fnl-section-title mb-3">Belangrijkste conversies</h3>
        <ConversionEventsTable
          events={summary.events}
          selectedEvent={selectedRow}
          onSelectEvent={(name) => loadRowDetail(name)}
          groupFilter={groupFilter}
        />
      </section>

      {selectedRow && isConversionMetricRow(selectedRow) && (metricDetail || detailLoading) ? (
        <ConversionEngagementMetricDetailPanel
          detail={metricDetail}
          loading={detailLoading}
          onClose={closeDetail}
        />
      ) : null}

      {selectedRow && !isConversionMetricRow(selectedRow) && (eventDetail || detailLoading) ? (
        <ConversionEventDetailPanel
          detail={eventDetail}
          loading={detailLoading}
          onClose={closeDetail}
        />
      ) : null}

      <ConversionTrendChart
        data={trendData}
        loading={trendLoading}
        error={trendError}
        selectedEvent={trendEvent}
        selectedGroup={trendGroup}
        granularity={trendGranularity}
        onEventChange={setTrendEvent}
        onGroupChange={setTrendGroup}
        onGranularityChange={setTrendGranularity}
        eventOptions={eventOptionsForBrand(brandId)}
        groupOptions={groupOptionsForBrand()}
      />

      <ConversionFunnels funnels={summary.funnels} />

      <section>
        <h3 className="fnl-section-title mb-3">Top pagina&apos;s op conversie</h3>
        <TopConversionPagesTable pages={summary.topPages} />
      </section>
    </div>
  );
}
