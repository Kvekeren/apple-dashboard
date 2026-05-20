"use client";

import { type ReactNode } from "react";

import { GoogleLogo } from "@/components/google-logo";
import { Button } from "@/components/ui/button";
import { useMonitoringAuth } from "@/components/monitoring/monitoring-shell";
import { redirectToGoogleLogin } from "@/lib/monitoring/shared";

export function MonitoringAuthGate({ children }: { children: ReactNode }) {
  const { gscConnected, gscAuthChecked } = useMonitoringAuth();

  if (!gscAuthChecked) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Laden…</div>;
  }

  if (!gscConnected) {
    return (
      <section className="fnl-card mx-auto max-w-md p-6 text-center">
        <h2 className="text-base font-semibold text-foreground">Google-login vereist</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Log in met Google om deze pagina te bekijken.
        </p>
        <Button
          type="button"
          size="sm"
          className="mt-4 rounded-[4px] font-semibold"
          onClick={redirectToGoogleLogin}
        >
          <GoogleLogo />
          Inloggen met Google
        </Button>
      </section>
    );
  }

  return <>{children}</>;
}
