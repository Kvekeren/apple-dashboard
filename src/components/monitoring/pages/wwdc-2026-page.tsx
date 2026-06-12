"use client";

import { useCallback } from "react";

import { MonitoringAuthGate } from "@/components/monitoring/auth-gate";
import { useMonitoringAuth } from "@/components/monitoring/monitoring-shell";
import { useRegisterPageRefresh } from "@/components/monitoring/monitoring-refresh-context";
import { WwdcDashboard } from "@/components/wwdc/WwdcDashboard";
import { WwdcYearComparison } from "@/components/wwdc/WwdcYearComparison";

export function Wwdc2026Page() {
  const { gscConnected } = useMonitoringAuth();

  const refreshPage = useCallback(() => {
    window.dispatchEvent(new CustomEvent("wwdc-refresh", { detail: { year: 2026 } }));
  }, []);

  useRegisterPageRefresh(gscConnected ? refreshPage : null, gscConnected);

  return (
    <MonitoringAuthGate>
      <div className="space-y-10">
        <WwdcDashboard year={2026} />
        <WwdcYearComparison />
      </div>
    </MonitoringAuthGate>
  );
}
