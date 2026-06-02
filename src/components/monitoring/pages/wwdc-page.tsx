"use client";

import { useCallback } from "react";

import { MonitoringAuthGate } from "@/components/monitoring/auth-gate";
import { useMonitoringAuth } from "@/components/monitoring/monitoring-shell";
import { useRegisterPageRefresh } from "@/components/monitoring/monitoring-refresh-context";
import { WwdcDashboard } from "@/components/wwdc/WwdcDashboard";

export function WwdcPage() {
  const { gscConnected } = useMonitoringAuth();

  const refreshPage = useCallback(() => {
    window.dispatchEvent(new CustomEvent("wwdc-refresh"));
  }, []);

  useRegisterPageRefresh(gscConnected ? refreshPage : null, gscConnected);

  return (
    <MonitoringAuthGate>
      <WwdcDashboard />
    </MonitoringAuthGate>
  );
}
