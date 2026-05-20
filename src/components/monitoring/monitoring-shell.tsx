"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CircleCheck, CircleOff, RefreshCw } from "lucide-react";

import { GoogleLogo } from "@/components/google-logo";
import { Button } from "@/components/ui/button";
import {
  GoogleConnectionDialog,
  GoogleLoginInlinePrompt,
  GoogleLoginPromptDialog,
  GOOGLE_LOGIN_DISMISS_KEY,
} from "@/components/monitoring/google-auth-ui";
import {
  MonitoringRefreshProvider,
  useMonitoringRefresh,
} from "@/components/monitoring/monitoring-refresh-context";
import { GSC_AUTH_ERR, MONITORING_NAV } from "@/lib/monitoring/shared";

type MonitoringAuthContextValue = {
  gscConnected: boolean;
  gscAuthChecked: boolean;
};

const MonitoringAuthContext = createContext<MonitoringAuthContextValue>({
  gscConnected: false,
  gscAuthChecked: false,
});

export function useMonitoringAuth() {
  return useContext(MonitoringAuthContext);
}

function MonitoringShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const googleDialogRef = useRef<HTMLDialogElement>(null);
  const googleLoginDialogRef = useRef<HTMLDialogElement>(null);
  const { refreshing, refreshAvailable, runRefresh } = useMonitoringRefresh();

  const [gscConnected, setGscConnected] = useState(false);
  const [gscAuthChecked, setGscAuthChecked] = useState(false);
  const [loginPromptDismissed, setLoginPromptDismissed] = useState(false);
  const [gscAuthError, setGscAuthError] = useState<string | null>(null);

  const checkGsc = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/status", { credentials: "include" });
      if (res.ok) setGscConnected((await res.json()).connected);
    } catch {
      setGscConnected(false);
    } finally {
      setGscAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    setLoginPromptDismissed(sessionStorage.getItem(GOOGLE_LOGIN_DISMISS_KEY) === "1");
    void checkGsc();
  }, [checkGsc]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("gsc_connected") === "1") {
      setGscConnected(true);
      window.history.replaceState({}, "", pathname);
    }
    const e = p.get("gsc_error");
    if (e) {
      setGscAuthError(GSC_AUTH_ERR[e] ?? `Fout (${e})`);
      window.history.replaceState({}, "", pathname);
    }
  }, [pathname]);

  function dismissLoginPrompt() {
    sessionStorage.setItem(GOOGLE_LOGIN_DISMISS_KEY, "1");
    setLoginPromptDismissed(true);
  }

  function clearLoginPromptDismiss() {
    sessionStorage.removeItem(GOOGLE_LOGIN_DISMISS_KEY);
    setLoginPromptDismissed(false);
  }

  async function disconnectGsc() {
    googleDialogRef.current?.close();
    try {
      await fetch("/api/auth/disconnect", { method: "POST", credentials: "include" });
      setGscConnected(false);
      clearLoginPromptDismiss();
      if (pathname !== "/" && pathname !== "/recent" && pathname !== "/ideeen")
        router.push("/");
    } catch {
      /* ignore */
    }
  }

  const showLoginPrompt =
    gscAuthChecked && !gscConnected && !loginPromptDismissed && pathname === "/";

  return (
    <MonitoringAuthContext.Provider value={{ gscConnected, gscAuthChecked }}>
    <div className="min-h-screen bg-background">
      <header className="fnl-monitoring-nav sticky top-0 z-50 bg-[var(--fnl-blue-pale)]">
        <div className="mx-auto flex h-12 max-w-[var(--container-max)] items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="shrink-0">
            <Image
              src="/brand/wordmark.png"
              alt="F&L Media"
              width={188}
              height={36}
              className="h-7 w-auto"
              priority
            />
          </Link>

          <nav className="fnl-monitoring-tabs" aria-label="Monitoring">
            {MONITORING_NAV.map(({ href, label, requiresAuth }) => {
              const disabled = requiresAuth && !gscConnected;
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return disabled ? (
                <span
                  key={href}
                  className="fnl-monitoring-tab shrink-0 cursor-not-allowed opacity-40"
                  aria-disabled
                >
                  {label}
                </span>
              ) : (
                <Link
                  key={href}
                  href={href}
                  prefetch
                  data-active={active ? "true" : "false"}
                  className="fnl-monitoring-tab shrink-0"
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground"
              disabled={refreshing || !refreshAvailable}
              onClick={runRefresh}
              aria-label="Gegevens vernieuwen"
            >
              {refreshing ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/40 border-t-primary" />
              ) : (
                <RefreshCw className="size-4" />
              )}
            </Button>
            {!gscConnected ? (
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => googleLoginDialogRef.current?.showModal()}
                aria-label="Niet ingelogd bij Google"
                title="Niet ingelogd"
              >
                <CircleOff className="size-4" strokeWidth={2.25} />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-[#1a5239] hover:bg-[#eaf5ef]/80 hover:text-[#1a5239]"
                onClick={() => googleDialogRef.current?.showModal()}
                aria-label="Google-verbinding bekijken"
                title="Google verbonden"
              >
                <CircleCheck className="size-4" strokeWidth={2.25} />
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[var(--container-max)] px-4 py-6 sm:px-6">
        {gscAuthError && (
          <div
            role="alert"
            className="mb-6 flex justify-between gap-4 rounded-[8px] border border-[var(--fnl-warning)]/35 bg-[#fdf8ed] px-4 py-3 text-sm text-[var(--fnl-ink-2)]"
          >
            <span>{gscAuthError}</span>
            <button
              type="button"
              className="shrink-0 font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => setGscAuthError(null)}
            >
              Sluiten
            </button>
          </div>
        )}

        {showLoginPrompt && <GoogleLoginInlinePrompt onDismiss={dismissLoginPrompt} />}

        {children}
      </div>

      {gscConnected ? (
        <GoogleConnectionDialog dialogRef={googleDialogRef} onDisconnect={disconnectGsc} />
      ) : (
        <GoogleLoginPromptDialog dialogRef={googleLoginDialogRef} />
      )}
    </div>
    </MonitoringAuthContext.Provider>
  );
}

export function MonitoringShell({ children }: { children: ReactNode }) {
  return (
    <MonitoringRefreshProvider>
      <MonitoringShellInner>{children}</MonitoringShellInner>
    </MonitoringRefreshProvider>
  );
}
