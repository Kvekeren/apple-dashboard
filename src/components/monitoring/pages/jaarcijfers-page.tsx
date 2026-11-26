"use client";

import { useCallback, useEffect, useState } from "react";

import { MonitoringAuthGate } from "@/components/monitoring/auth-gate";
import { useMonitoringAuth } from "@/components/monitoring/monitoring-shell";
import { useRegisterPageRefresh } from "@/components/monitoring/monitoring-refresh-context";
import {
  JaarcijfersDashboard,
  type JaarMetricKey,
  type JaarMetricSeries,
} from "@/components/monitoring/views/jaarcijfers-dashboard";
import { gscClicksRowsToYtdWeekly } from "@/lib/monitoring/shared";

const EMPTY: JaarMetricSeries = { rows: [], rowsPrevious: [] };
const EMPTY_ALL: Record<JaarMetricKey, JaarMetricSeries> = {
  pageviews: EMPTY,
  discover: EMPTY,
  organisch: EMPTY,
  nieuwsbrief: EMPTY,
};

export function JaarcijfersPage() {
  const { gscConnected } = useMonitoringAuth();
  const [series, setSeries] = useState<Record<JaarMetricKey, JaarMetricSeries>>(EMPTY_ALL);
  const [ytdPreviousYear, setYtdPreviousYear] = useState<number | null>(null);
  const [ytdYear, setYtdYear] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const loadAll = useCallback(async (ref = false) => {
    const q = ref ? "?refresh=1" : "";
    setLoading(true);
    try {
      const [ga4Res, gscRes] = await Promise.all([
        fetch(`/api/ga4-ytd-sessions${q}`, { credentials: "include" }),
        fetch(`/api/gsc-ytd-clicks${q}`, { credentials: "include" }),
      ]);
      const next: Record<JaarMetricKey, JaarMetricSeries> = { ...EMPTY_ALL };

      if (ga4Res.ok) {
        const j = await ga4Res.json();
        next.pageviews = { rows: j.rows ?? [], rowsPrevious: j.rowsPreviousYear ?? [] };
        next.nieuwsbrief = {
          rows: j.newsletter?.rows ?? [],
          rowsPrevious: j.newsletter?.rowsPreviousYear ?? [],
        };
        if (j.meta?.year != null) setYtdYear(j.meta.year);
        if (j.meta?.previousYear != null) setYtdPreviousYear(j.meta.previousYear);
      }
      if (gscRes.ok) {
        const g = await gscRes.json();
        next.discover = {
          rows: gscClicksRowsToYtdWeekly(g.discover?.rows ?? []),
          rowsPrevious: gscClicksRowsToYtdWeekly(g.discover?.rowsPreviousYear ?? []),
        };
        next.organisch = {
          rows: gscClicksRowsToYtdWeekly(g.search?.rows ?? []),
          rowsPrevious: gscClicksRowsToYtdWeekly(g.search?.rowsPreviousYear ?? []),
        };
        if (g.meta?.year != null) setYtdYear(g.meta.year);
        if (g.meta?.previousYear != null) setYtdPreviousYear(g.meta.previousYear);
      }
      setSeries(next);
    } catch {
      setSeries(EMPTY_ALL);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!gscConnected) return;
    void loadAll();
  }, [gscConnected, loadAll]);

  const refreshPage = useCallback(() => loadAll(true), [loadAll]);
  useRegisterPageRefresh(gscConnected ? refreshPage : null, gscConnected);

  return (
    <MonitoringAuthGate>
      <JaarcijfersDashboard
        series={series}
        ytdPreviousYear={ytdPreviousYear}
        ytdYear={ytdYear}
        loading={loading}
      />
    </MonitoringAuthGate>
  );
}
