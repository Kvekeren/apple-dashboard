"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { HistorischGa4AvailabilityReport } from "@/lib/ga4-historisch-availability";

function SampleTable({
  title,
  table,
}: {
  title: string;
  table: { headers: string[]; rows: string[][] };
}) {
  return (
    <div className="mb-4">
      <p className="mb-2 text-xs font-medium text-slate-600">{title}</p>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {table.headers.map((h) => (
                <th key={h} className="px-3 py-2 font-medium text-slate-800">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0">
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-2 text-slate-700">
                    {cell || "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function HistorischPage() {
  const [report, setReport] = useState<HistorischGa4AvailabilityReport | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (refresh: boolean) => {
    setLoading(true);
    setErr(null);
    try {
      const url = refresh
        ? "/api/historisch/ga4-availability?refresh=1"
        : "/api/historisch/ga4-availability";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setReport(null);
        setErr(j.error ?? `HTTP ${res.status}`);
        return;
      }
      setReport((await res.json()) as HistorischGa4AvailabilityReport);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Onbekende fout");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200 px-6 py-6">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Stap 1 — alleen beschikbaarheid
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Historisch Nieuwsblad — GA4 dataprobe
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Dit rapport toont wat de Data API teruggeeft: geen grafieken, geen interpretatie. Vernieuwen
            gebeurt op verzoek; resultaat wordt maximaal een week gecached.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/" className="text-sm font-medium text-slate-700 underline-offset-4 hover:underline">
              Home
            </Link>
            <Link
              href="/api/auth/google"
              className="text-sm font-medium text-slate-700 underline-offset-4 hover:underline"
            >
              Google-login
            </Link>
            <button
              type="button"
              onClick={() => void load(true)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              disabled={loading}
            >
              Opnieuw ophalen
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        {loading && <p className="text-sm text-slate-600">Bezig met ophalen…</p>}
        {err && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {err}
          </div>
        )}

        {report && (
          <div className="space-y-10 text-sm leading-relaxed">
            <section>
              <h2 className="text-base font-semibold text-slate-900">1. Databron</h2>
              <ul className="mt-2 list-inside list-disc text-slate-700">
                <li>
                  <span className="font-medium">Bron:</span> {report.dataSource}
                </li>
                <li>
                  <span className="font-medium">Merk / property-mapping:</span> {report.brand} → env{" "}
                  <code className="rounded bg-slate-100 px-1">{report.propertyEnvKey}</code>{" "}
                  {report.propertyIdConfigured ? "(ingesteld)" : "(ontbreekt)"}
                </li>
                {report.generatedAt && (
                  <li>
                    <span className="font-medium">Rapport gegenereerd:</span> {report.generatedAt}
                  </li>
                )}
              </ul>
              {report.fatalError && (
                <p className="mt-2 text-red-700">{report.fatalError}</p>
              )}
            </section>

            <section>
              <h2 className="text-base font-semibold text-slate-900">2. Perioden (API bereikbaar?)</h2>
              <p className="mt-1 text-slate-600">
                Elke periode: één totaal <code className="rounded bg-slate-100 px-1">sessions</code>
                -rapport plus max. 5 voorbeeldregels per dag.
              </p>
              <ul className="mt-3 space-y-4">
                {report.periods.map((p) => (
                  <li key={p.id} className="rounded-lg border border-slate-200 p-4">
                    <p className="font-medium text-slate-900">{p.label}</p>
                    <p className="text-xs text-slate-500">
                      {p.startDate} — {p.endDate}
                    </p>
                    {p.error ? (
                      <p className="mt-2 text-red-700">Niet beschikbaar: {p.error}</p>
                    ) : (
                      <p className="mt-2 text-emerald-800">
                        Beschikbaar (sessions-totaal: {p.sessions?.toLocaleString("nl-NL") ?? "—"})
                      </p>
                    )}
                    {p.sample && <SampleTable title="Voorbeeld (max. 5 rijen)" table={p.sample} />}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-slate-900">3. Events (bestaan + volume)</h2>
              <p className="mt-1 text-slate-600">
                Venster voor teller: 2024-01-01 t/m eind van de lange periode hierboven. Per event max.
                5 rijen in het voorbeeld.
              </p>
              <ul className="mt-3 space-y-4">
                {report.events.map((e) => (
                  <li key={e.eventName} className="rounded-lg border border-slate-200 p-4">
                    <p className="font-mono font-medium text-slate-900">{e.eventName}</p>
                    {e.error ? (
                      <p className="mt-2 text-red-700">Niet op te halen: {e.error}</p>
                    ) : e.hasData ? (
                      <p className="mt-2 text-emerald-800">
                        Aanwezig — totaal eventCount: {e.totalEventCount.toLocaleString("nl-NL")}
                      </p>
                    ) : (
                      <p className="mt-2 text-amber-800">
                        Geen data (eventCount = 0 in dit venster)
                      </p>
                    )}
                    {e.sample && <SampleTable title="Voorbeeld" table={e.sample} />}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-slate-900">
                4. Dimensies i.c.m. events (eventCount)
              </h2>
              <p className="mt-1 text-slate-600">
                Elke dimensie wordt geprobeerd samen met{" "}
                <code className="rounded bg-slate-100 px-1">eventName</code> en filter op het eerste
                event dat in §3 data heeft; zo niet, op{" "}
                <code className="rounded bg-slate-100 px-1">paywall_view</code>.
              </p>
              <ul className="mt-3 space-y-4">
                {report.dimensions.map((d) => (
                  <li key={d.apiDimension} className="rounded-lg border border-slate-200 p-4">
                    <p className="font-medium text-slate-900">
                      {d.displayName}{" "}
                      <span className="font-mono text-xs font-normal text-slate-500">
                        ({d.apiDimension})
                      </span>
                    </p>
                    {d.eventUsed && (
                      <p className="text-xs text-slate-500">Filter-event: {d.eventUsed}</p>
                    )}
                    {d.error ? (
                      <p className="mt-2 text-red-700">Niet beschikbaar in deze combinatie: {d.error}</p>
                    ) : (
                      <p className="mt-2 text-emerald-800">Combinatie ondersteund door de API.</p>
                    )}
                    {d.sample && <SampleTable title="Voorbeeld (max. 5 rijen)" table={d.sample} />}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-slate-900">5. Nieuwe gebruikers (metric)</h2>
              {report.newUsers.error ? (
                <p className="mt-2 text-red-700">{report.newUsers.error}</p>
              ) : report.newUsers.available ? (
                <p className="mt-2 text-emerald-800">Beschikbaar in deze combinatie.</p>
              ) : (
                <p className="mt-2 text-amber-800">Niet beschikbaar.</p>
              )}
              {report.newUsers.note && (
                <p className="mt-2 text-slate-600">{report.newUsers.note}</p>
              )}
              {report.newUsers.sample && (
                <div className="mt-4">
                  <SampleTable title="Voorbeeld (max. 5 rijen)" table={report.newUsers.sample} />
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
