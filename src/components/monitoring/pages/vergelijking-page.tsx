"use client";

import { useCallback, useEffect, useState } from "react";

import { MonitoringAuthGate } from "@/components/monitoring/auth-gate";
import { useMonitoringAuth } from "@/components/monitoring/monitoring-shell";
import { useRegisterPageRefresh } from "@/components/monitoring/monitoring-refresh-context";
import { VergelijkingDashboard } from "@/components/monitoring/views/vergelijking-dashboard";
import { CIJFERS_RANGE_QS, type CijfersData } from "@/lib/monitoring/shared";

export function VergelijkingPage() {
  const { gscConnected } = useMonitoringAuth();
  const [cjf, setCjf] = useState<CijfersData | null>(null);

  const loadCjf = useCallback(async (ref = false) => {
    try {
      const u = ref
        ? `/api/cijfers?${CIJFERS_RANGE_QS}&refresh=1`
        : `/api/cijfers?${CIJFERS_RANGE_QS}`;
      const res = await fetch(u, { credentials: "include" });
      setCjf(res.ok ? await res.json() : null);
    } catch {
      setCjf(null);
    }
  }, []);

  useEffect(() => {
    if (!gscConnected) return;
    void loadCjf();
  }, [gscConnected, loadCjf]);

  const refreshPage = useCallback(() => loadCjf(true), [loadCjf]);
  useRegisterPageRefresh(gscConnected ? refreshPage : null, gscConnected);

  return (
    <MonitoringAuthGate>
      <VergelijkingDashboard cjf={cjf} />
    </MonitoringAuthGate>
  );
}
