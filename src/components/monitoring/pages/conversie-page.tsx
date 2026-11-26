"use client";

import { useCallback, useState } from "react";

import { MonitoringAuthGate } from "@/components/monitoring/auth-gate";
import { SegmentSwitch } from "@/components/monitoring/brand-tabs";
import { useMonitoringAuth } from "@/components/monitoring/monitoring-shell";
import { useRegisterPageRefresh } from "@/components/monitoring/monitoring-refresh-context";
import { ConversieArtikelen } from "@/components/conversions/ConversieArtikelen";
import { ConversionDashboard } from "@/components/conversions/ConversionDashboard";

type View = "artikelen" | "events";
const VIEWS = [
  { id: "artikelen", label: "Per artikel" },
  { id: "events", label: "Events & funnels" },
] as const satisfies readonly { id: View; label: string }[];

export function ConversiePage() {
  const { gscConnected } = useMonitoringAuth();
  const [view, setView] = useState<View>("artikelen");

  const refreshPage = useCallback(() => {
    window.dispatchEvent(new CustomEvent("conversions-refresh"));
  }, []);

  useRegisterPageRefresh(gscConnected ? refreshPage : null, gscConnected);

  return (
    <MonitoringAuthGate>
      <div className="mb-10 space-y-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Conversies</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              {view === "artikelen"
                ? "Per artikel: sessies, uitklikken, affiliate-klikken, sales en omzet uit GA4, net als de export “Conversies per pagina”. Sorteer op elke kolom of download als CSV."
                : "Events, funnels en KPI's per merk: clicks, engagement, affiliate, advertenties en leads."}
            </p>
          </div>
          <SegmentSwitch value={view} onChange={setView} options={VIEWS} ariaLabel="Weergave" />
        </header>
        {view === "artikelen" ? <ConversieArtikelen /> : <ConversionDashboard />}
      </div>
    </MonitoringAuthGate>
  );
}
