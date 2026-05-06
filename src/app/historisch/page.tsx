"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { HistorischGa4AvailabilityReport } from "@/lib/ga4-historisch-availability";
import type { HistorischFunnelMonthlyReport } from "@/lib/historisch-funnel-shared";
import type { HistorischTrafficMonthlyReport } from "@/lib/historisch-traffic-shared";
import type {
  HistorischTopArticleMonthBundle,
  HistorischTopArticlePivotRow,
  HistorischTopArticleTechnical,
  HistorischTopArticlesReport,
} from "@/lib/historisch-top-articles-shared";
import { historischFunnelReportToCsv } from "@/lib/historisch-funnel-csv";
import { historischTrafficReportToCsv } from "@/lib/historisch-traffic-csv";
import { buildHistorischCombinedMonthly } from "@/lib/historisch-combined-shared";
import { historischCombinedReportToCsv } from "@/lib/historisch-combined-csv";
import { topArticleMonthBundleToCsv } from "@/lib/historisch-top-articles-csv";
import type {
  HistorischTopArticlesOriginReport,
  OriginMonthBundle,
  OriginMonthTechnical,
} from "@/lib/historisch-top-articles-origin-shared";
import { originMonthBundleToCsv } from "@/lib/historisch-top-articles-origin-csv";
import type { HistorischNieuwsbriefArtikelReport } from "@/lib/historisch-nieuwsbrief-artikel-shared";
import {
  nbArtikelTableAToCsv,
  nbArtikelTableBToCsv,
  nbArtikelTableCToCsv,
} from "@/lib/historisch-nieuwsbrief-artikel-csv";
import { buildHistorischDashboardSummary } from "@/lib/historisch-dashboard-summary";
import { formatPer1k, formatPct, formatRatio } from "@/lib/historisch-page-format";
import { HistorischMeetingCharts } from "@/components/historisch/historisch-meeting-charts";
import {
  HistorischDashboardNewsletterCharts,
  HistorischDashboardOverviewCharts,
  HistorischDashboardPeakChannelChart,
  type PeakMonthKey,
} from "@/components/historisch/historisch-dashboard-meeting-charts";
import {
  BelangrijksteConclusiesBlok,
  DuidingMaandontwikkeling,
  DuidingNieuwsbrief,
  DuidingOverzicht,
  DuidingPiekmaanden,
  VervolgstappenBlok,
} from "@/components/historisch/historisch-duiding";
import { HistorischPowerpointAssets } from "@/components/historisch/historisch-powerpoint-assets";
import {
  Stap1AvailabilitySection,
  Stap2FunnelSection,
  Stap3TrafficSection,
  Stap4CombinedSection,
} from "@/components/historisch/historisch-stap-blocks";

function TopArticlesDataTable({ rows }: { rows: HistorischTopArticlePivotRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[72rem] text-left text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-2 py-2 font-medium text-slate-800 sm:px-3">pagePath</th>
            <th className="px-2 py-2 font-medium text-slate-800 sm:px-3">pageTitle</th>
            <th className="whitespace-nowrap px-2 py-2 text-right font-medium text-slate-800 sm:px-3">
              paywall_view
            </th>
            <th className="whitespace-nowrap px-2 py-2 text-right font-medium text-slate-800 sm:px-3">
              paywall_abonneren
            </th>
            <th className="whitespace-nowrap px-2 py-2 text-right font-medium text-slate-800 sm:px-3">
              paywall_inloggen
            </th>
            <th
              className="max-w-[8rem] whitespace-normal px-2 py-2 text-right font-medium text-slate-800 sm:px-3"
              title="nieuwsbrief_inschrijving_artikelen"
            >
              nieuwsbrief…
            </th>
            <th className="whitespace-nowrap px-2 py-2 text-right font-medium text-slate-800 sm:px-3">
              abo/view
            </th>
            <th className="whitespace-nowrap px-2 py-2 text-right font-medium text-slate-800 sm:px-3">
              login/view
            </th>
            <th className="whitespace-nowrap px-2 py-2 text-right font-medium text-slate-800 sm:px-3">
              nb/view
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.pagePath}\t${r.pageTitle}`} className="border-b border-slate-100 last:border-0">
              <td className="max-w-[14rem] truncate px-2 py-2 font-mono text-[11px] text-slate-800 sm:px-3 sm:text-xs">
                {r.pagePath || "—"}
              </td>
              <td className="max-w-[18rem] truncate px-2 py-2 text-slate-700 sm:px-3" title={r.pageTitle}>
                {r.pageTitle || "—"}
              </td>
              <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                {r.paywall_view.toLocaleString("nl-NL")}
              </td>
              <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                {r.paywall_abonneren.toLocaleString("nl-NL")}
              </td>
              <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                {r.paywall_inloggen.toLocaleString("nl-NL")}
              </td>
              <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                {r.nieuwsbrief_inschrijving_artikelen.toLocaleString("nl-NL")}
              </td>
              <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                {formatRatio(r.paywall_abonneer_ratio)}
              </td>
              <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                {formatRatio(r.paywall_login_ratio)}
              </td>
              <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                {formatRatio(r.nieuwsbrief_per_paywall_view)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TopArticleTechnicalBlock({ t }: { t: HistorischTopArticleTechnical }) {
  const fmt = (n: number) => n.toLocaleString("nl-NL");
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-800">
      <p className="font-medium text-slate-900">Technische check</p>
      <ul className="mt-2 list-inside list-disc space-y-1 text-slate-700">
        <li>
          Totaal <span className="font-mono">paywall_view</span> in gefilterde artikeltabel (alle rijen):{" "}
          <span className="font-mono tabular-nums">{fmt(t.totalPaywallViewInTable)}</span>
        </li>
        <li>
          Totaal <span className="font-mono">paywall_abonneren</span> in gefilterde artikeltabel:{" "}
          <span className="font-mono tabular-nums">{fmt(t.totalPaywallAbonnerenInTable)}</span>
        </li>
        <li>
          Maandtotaal <span className="font-mono">paywall_view</span> (GA4, zelfde events + zelfde datumbereik):{" "}
          <span className="font-mono tabular-nums">{fmt(t.monthTotalPaywallViewFromGa)}</span>
        </li>
        <li>
          Maandtotaal <span className="font-mono">paywall_abonneren</span> (GA4):{" "}
          <span className="font-mono tabular-nums">{fmt(t.monthTotalPaywallAbonnerenFromGa)}</span>
        </li>
        <li>
          Stap 2 (<span className="font-mono">{t.yearMonthStap2}</span>) —{" "}
          <span className="font-mono">paywall_view</span>:{" "}
          <span className="font-mono tabular-nums">
            {t.stap2PaywallView == null ? "—" : fmt(t.stap2PaywallView)}
          </span>
          {" · "}
          <span className="font-mono">paywall_abonneren</span>:{" "}
          <span className="font-mono tabular-nums">
            {t.stap2PaywallAbonneren == null ? "—" : fmt(t.stap2PaywallAbonneren)}
          </span>
          {" · "}
          <span className="font-mono">paywall_inloggen</span>:{" "}
          <span className="font-mono tabular-nums">
            {t.stap2PaywallInloggen == null ? "—" : fmt(t.stap2PaywallInloggen)}
          </span>
          {" · "}
          <span className="font-mono">nieuwsbrief_inschrijving_artikelen</span>:{" "}
          <span className="font-mono tabular-nums">
            {t.stap2Nieuwsbrief == null ? "—" : fmt(t.stap2Nieuwsbrief)}
          </span>
        </li>
        <li>
          Verschil stap 2 − GA-maandquery (<span className="font-mono">paywall_view</span>):{" "}
          <span className="font-mono tabular-nums">
            {t.stap2PaywallView == null
              ? "—"
              : fmt(t.stap2PaywallView - t.monthTotalPaywallViewFromGa)}
          </span>
          <span className="text-xs text-slate-500"> (verwacht 0)</span>
        </li>
        <li>
          Verschil stap 2 − GA-maandquery (<span className="font-mono">paywall_abonneren</span>):{" "}
          <span className="font-mono tabular-nums">
            {t.stap2PaywallAbonneren == null
              ? "—"
              : fmt(t.stap2PaywallAbonneren - t.monthTotalPaywallAbonnerenFromGa)}
          </span>
          <span className="text-xs text-slate-500"> (verwacht 0)</span>
        </li>
        <li>
          Gefilterde artikeltabel − stap 2 (<span className="font-mono">paywall_view</span>):{" "}
          <span className="font-mono tabular-nums">
            {t.stap2PaywallView == null
              ? "—"
              : fmt(t.totalPaywallViewInTable - t.stap2PaywallView)}
          </span>
          <span className="text-xs text-slate-500">
            {" "}
            (meestal negatief: paywall-events op uitgesloten routes vallen buiten deze tabel)
          </span>
        </li>
        <li>
          Gefilterde artikeltabel − stap 2 (<span className="font-mono">paywall_abonneren</span>):{" "}
          <span className="font-mono tabular-nums">
            {t.stap2PaywallAbonneren == null
              ? "—"
              : fmt(t.totalPaywallAbonnerenInTable - t.stap2PaywallAbonneren)}
          </span>
        </li>
        <li>
          Aandeel maandtotaal <span className="font-mono">paywall_view</span> verklaard door top 25 (sort:{" "}
          <span className="font-mono">paywall_abonneren</span>):{" "}
          <span className="font-mono">{formatPct(t.pctMonthPaywallViewTop25ByAbonnement)}</span>
        </li>
        <li>
          Aandeel maandtotaal <span className="font-mono">paywall_abonneren</span> verklaard door top 25 (sort:{" "}
          <span className="font-mono">paywall_abonneren</span>):{" "}
          <span className="font-mono">{formatPct(t.pctMonthPaywallAbonnerenTop25ByAbonnement)}</span>
        </li>
        <li>
          Aandeel maandtotaal <span className="font-mono">paywall_view</span> verklaard door top 25 (sort:{" "}
          <span className="font-mono">paywall_view</span>):{" "}
          <span className="font-mono">{formatPct(t.pctMonthPaywallViewTop25ByView)}</span>
        </li>
        <li>
          Aandeel maandtotaal <span className="font-mono">paywall_abonneren</span> verklaard door top 25 (sort:{" "}
          <span className="font-mono">paywall_view</span>):{" "}
          <span className="font-mono">{formatPct(t.pctMonthPaywallAbonnerenTop25ByView)}</span>
        </li>
        <li>
          Unieke <span className="font-mono">pagePath</span> met <span className="font-mono">paywall_view</span>{" "}
          &gt; 0: <span className="font-mono tabular-nums">{fmt(t.uniquePagePathsWithPaywallView)}</span>
        </li>
        <li>
          Unieke <span className="font-mono">pagePath</span> met <span className="font-mono">
            paywall_abonneren
          </span>{" "}
          &gt; 0:{" "}
          <span className="font-mono tabular-nums">{fmt(t.uniquePagePathsWithPaywallAbonneren)}</span>
        </li>
      </ul>
    </div>
  );
}

function TopArticlesMonthSection({
  bundle,
  fileSlug,
  copyTopKey,
  setCopyTopKey,
  layout = "full",
}: {
  bundle: HistorischTopArticleMonthBundle;
  fileSlug: string;
  copyTopKey: string | null;
  setCopyTopKey: (k: string | null) => void;
  layout?: "full" | "dashboard";
}) {
  const copyKeyAbo = `${fileSlug}-abo`;
  const copyKeyView = `${fileSlug}-view`;
  const top10 = bundle.topByAbonnement.slice(0, 10);

  function download(sort: "paywall_abonneren" | "paywall_view") {
    const csv = topArticleMonthBundleToCsv(bundle, sort);
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historisch-top-artikelen-${fileSlug}-${sort}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copy(sort: "paywall_abonneren" | "paywall_view", key: string) {
    const csv = topArticleMonthBundleToCsv(bundle, sort);
    try {
      await navigator.clipboard.writeText(csv);
      setCopyTopKey(key);
      window.setTimeout(() => setCopyTopKey(null), 2000);
    } catch {
      setCopyTopKey(null);
    }
  }

  if (layout === "dashboard") {
    return (
      <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{bundle.label}</h3>
          <p className="mt-1 text-xs text-amber-900">
            Let op: sommige <span className="font-mono">pageTitle</span>-waarden lijken vertaald of afwijkend;
            gebruik <span className="font-mono">pagePath</span> als primaire identifier.
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Datumrange: <span className="font-mono">{bundle.startDate}</span> t/m{" "}
            <span className="font-mono">{bundle.endDate}</span>.
          </p>
          {bundle.error && <p className="mt-2 text-sm text-red-700">API: {bundle.error}</p>}
        </div>

        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Top 10 op paywall_abonneren (aflopend)
          </p>
          {top10.length ? <TopArticlesDataTable rows={top10} /> : <p className="text-sm text-slate-600">Geen rijen.</p>}
        </div>

        <details className="rounded-lg border border-slate-200 bg-slate-50/50">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-slate-800">
            Top 25 op paywall_abonneren — CSV
          </summary>
          <div className="space-y-3 border-t border-slate-200 p-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => download("paywall_abonneren")}
                disabled={!bundle.topByAbonnement.length}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                Download CSV
              </button>
              <button
                type="button"
                onClick={() => void copy("paywall_abonneren", copyKeyAbo)}
                disabled={!bundle.topByAbonnement.length}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                {copyTopKey === copyKeyAbo ? "Gekopieerd" : "Kopieer CSV"}
              </button>
            </div>
            {bundle.topByAbonnement.length ? (
              <TopArticlesDataTable rows={bundle.topByAbonnement} />
            ) : (
              <p className="text-sm text-slate-600">Geen rijen.</p>
            )}
          </div>
        </details>

        <details className="rounded-lg border border-slate-200 bg-slate-50/50">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-slate-800">
            Top 25 op paywall_view — CSV
          </summary>
          <div className="space-y-3 border-t border-slate-200 p-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => download("paywall_view")}
                disabled={!bundle.topByView.length}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                Download CSV
              </button>
              <button
                type="button"
                onClick={() => void copy("paywall_view", copyKeyView)}
                disabled={!bundle.topByView.length}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                {copyTopKey === copyKeyView ? "Gekopieerd" : "Kopieer CSV"}
              </button>
            </div>
            {bundle.topByView.length ? (
              <TopArticlesDataTable rows={bundle.topByView} />
            ) : (
              <p className="text-sm text-slate-600">Geen rijen.</p>
            )}
          </div>
        </details>

        <details className="rounded-lg border border-slate-200 bg-slate-50/50">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-slate-800">
            Technische check (topartikelen)
          </summary>
          <div className="border-t border-slate-200 p-3">
            <TopArticleTechnicalBlock t={bundle.technical} />
          </div>
        </details>
      </div>
    );
  }

  return (
    <div className="space-y-8 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{bundle.label}</h3>
        <p className="mt-1 text-xs text-slate-600">
          Datumrange: <span className="font-mono">{bundle.startDate}</span> t/m{" "}
          <span className="font-mono">{bundle.endDate}</span>. Dimensies:{" "}
          <span className="font-mono">pagePath</span>, <span className="font-mono">pageTitle</span>,{" "}
          <span className="font-mono">eventName</span>. Niet-artikelroutes uitgesloten; lege / (not set) weg
          tenzij hoog volume.
        </p>
        {bundle.error && (
          <p className="mt-2 text-sm text-red-700">API: {bundle.error}</p>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Top 25 op paywall_abonneren (aflopend)
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => download("paywall_abonneren")}
            disabled={!bundle.topByAbonnement.length}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Download CSV
          </button>
          <button
            type="button"
            onClick={() => void copy("paywall_abonneren", copyKeyAbo)}
            disabled={!bundle.topByAbonnement.length}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            {copyTopKey === copyKeyAbo ? "Gekopieerd" : "Kopieer CSV"}
          </button>
        </div>
        {bundle.topByAbonnement.length ? (
          <TopArticlesDataTable rows={bundle.topByAbonnement} />
        ) : (
          <p className="text-sm text-slate-600">Geen rijen.</p>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Top 25 op paywall_view (aflopend)
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => download("paywall_view")}
            disabled={!bundle.topByView.length}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Download CSV
          </button>
          <button
            type="button"
            onClick={() => void copy("paywall_view", copyKeyView)}
            disabled={!bundle.topByView.length}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            {copyTopKey === copyKeyView ? "Gekopieerd" : "Kopieer CSV"}
          </button>
        </div>
        {bundle.topByView.length ? (
          <TopArticlesDataTable rows={bundle.topByView} />
        ) : (
          <p className="text-sm text-slate-600">Geen rijen.</p>
        )}
      </div>

      <TopArticleTechnicalBlock t={bundle.technical} />
    </div>
  );
}

function OriginTechnicalBlock({ t }: { t: OriginMonthTechnical }) {
  const fmt = (n: number) => n.toLocaleString("nl-NL");
  const dBv = t.analysisBPaywallView - t.analysisAPaywallView;
  const dBa = t.analysisBPaywallAbonneren - t.analysisAPaywallAbonneren;
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-800">
      <p className="font-medium text-slate-900">Technische check (stap 6 t.o.v. stap 5)</p>
      <ul className="mt-2 list-inside list-disc space-y-1 text-slate-700">
        <li>
          Stap 5 — totaal <span className="font-mono">paywall_view</span> over top 25 (
          <span className="font-mono">paywall_abonneren</span>-sort):{" "}
          <span className="font-mono tabular-nums">{fmt(t.stap5Top25PaywallView)}</span>
        </li>
        <li>
          Stap 5 — totaal <span className="font-mono">paywall_abonneren</span> over top 25:{" "}
          <span className="font-mono tabular-nums">{fmt(t.stap5Top25PaywallAbonneren)}</span>
        </li>
        <li>
          Analyse A — totaal <span className="font-mono">paywall_view</span> (kanaal × artikel):{" "}
          <span className="font-mono tabular-nums">{fmt(t.analysisAPaywallView)}</span>
        </li>
        <li>
          Analyse A — totaal <span className="font-mono">paywall_abonneren</span>:{" "}
          <span className="font-mono tabular-nums">{fmt(t.analysisAPaywallAbonneren)}</span>
        </li>
        <li>
          Verschil (analyse A − stap 5) <span className="font-mono">paywall_view</span>:{" "}
          <span className="font-mono tabular-nums">{fmt(t.diffPaywallViewA)}</span>
        </li>
        <li>
          Verschil (analyse A − stap 5) <span className="font-mono">paywall_abonneren</span>:{" "}
          <span className="font-mono tabular-nums">{fmt(t.diffPaywallAbonnerenA)}</span>
          <span className="text-xs text-slate-500">
            {" "}
            (afwijkingen kunnen door sessie-attributie, (not set) of API-limieten)
          </span>
        </li>
        <li>
          Analyse B totalen (sanity) — <span className="font-mono">paywall_view</span>:{" "}
          <span className="font-mono tabular-nums">{fmt(t.analysisBPaywallView)}</span>,{" "}
          <span className="font-mono">paywall_abonneren</span>:{" "}
          <span className="font-mono tabular-nums">{fmt(t.analysisBPaywallAbonneren)}</span> — verschil
          t.o.v. analyse A: <span className="font-mono tabular-nums">{fmt(dBv)}</span> /{" "}
          <span className="font-mono tabular-nums">{fmt(dBa)}</span>
        </li>
        <li>
          Topartikelen met kanaaldata (minstens één event in analyse A voor dat{" "}
          <span className="font-mono">pagePath</span>):{" "}
          <span className="font-mono tabular-nums">{fmt(t.topArticlesWithChannelData)}</span>
        </li>
        <li>
          Topartikelen zonder kanaaldata:{" "}
          <span className="font-mono tabular-nums">{fmt(t.topArticlesWithoutChannelData)}</span>
        </li>
      </ul>
    </div>
  );
}

function DetailsOptional({
  dashboard,
  summary,
  children,
}: {
  dashboard: boolean;
  summary: string;
  children: ReactNode;
}) {
  if (dashboard) {
    return (
      <details className="rounded-lg border border-slate-200 bg-slate-50/50">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-slate-800">{summary}</summary>
        <div className="space-y-2 border-t border-slate-200 p-3">{children}</div>
      </details>
    );
  }
  return <div className="space-y-2">{children}</div>;
}

function OriginMonthBlock({
  bundle,
  fileSlug,
  copyOriginKey,
  setCopyOriginKey,
  layout = "full",
}: {
  bundle: OriginMonthBundle;
  fileSlug: string;
  copyOriginKey: string | null;
  setCopyOriginKey: (k: string | null) => void;
  layout?: "full" | "dashboard";
}) {
  function download() {
    const csv = originMonthBundleToCsv(bundle);
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historisch-topartikelen-herkomst-${fileSlug}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copy() {
    const csv = originMonthBundleToCsv(bundle);
    try {
      await navigator.clipboard.writeText(csv);
      setCopyOriginKey(fileSlug);
      window.setTimeout(() => setCopyOriginKey(null), 2000);
    } catch {
      setCopyOriginKey(null);
    }
  }

  return (
    <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{bundle.label}</h3>
        <p className="mt-1 text-xs text-slate-600">
          Basis: top 25 uit stap 5 op <span className="font-mono">paywall_abonneren</span>. Range:{" "}
          <span className="font-mono">{bundle.startDate}</span> — <span className="font-mono">{bundle.endDate}</span>.
          Geen conclusies, rapporttekst of grafieken.
        </p>
        {bundle.error && <p className="mt-2 text-sm text-red-700">API: {bundle.error}</p>}
        {layout === "dashboard" ? (
          <p className="mt-2 text-xs text-amber-900">
            Let op: sommige <span className="font-mono">pageTitle</span>-waarden lijken vertaald of afwijkend;
            gebruik <span className="font-mono">pagePath</span> als primaire identifier.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={download}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Download CSV
        </button>
        <button
          type="button"
          onClick={() => void copy()}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          {copyOriginKey === fileSlug ? "Gekopieerd" : "Kopieer CSV"}
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Samenvatting — kanaal (alle top 25 samen)
        </p>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[48rem] text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-2 py-2 font-medium text-slate-800 sm:px-3">maand</th>
                <th className="px-2 py-2 font-medium text-slate-800 sm:px-3">
                  sessionDefaultChannelGroup
                </th>
                <th className="px-2 py-2 text-right font-medium text-slate-800 sm:px-3">
                  paywall_view
                </th>
                <th className="px-2 py-2 text-right font-medium text-slate-800 sm:px-3">
                  paywall_abonneren
                </th>
                <th className="px-2 py-2 text-right font-medium text-slate-800 sm:px-3">% view</th>
                <th className="px-2 py-2 text-right font-medium text-slate-800 sm:px-3">% abo</th>
                <th className="px-2 py-2 text-right font-medium text-slate-800 sm:px-3">abo/view</th>
              </tr>
            </thead>
            <tbody>
              {bundle.summary.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-slate-600">
                    Geen rijen.
                  </td>
                </tr>
              ) : (
                bundle.summary.map((r) => (
                  <tr key={`${r.maand}-${r.sessionDefaultChannelGroup}`} className="border-b border-slate-100 last:border-0">
                    <td className="whitespace-nowrap px-2 py-2 font-mono text-slate-800 sm:px-3">
                      {r.maand}
                    </td>
                    <td className="px-2 py-2 text-slate-700 sm:px-3">{r.sessionDefaultChannelGroup}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                      {r.paywall_view.toLocaleString("nl-NL")}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                      {r.paywall_abonneren.toLocaleString("nl-NL")}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                      {formatPct(r.aandeel_paywall_view_binnen_top25)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                      {formatPct(r.aandeel_paywall_abonneren_binnen_top25)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                      {formatRatio(r.paywall_abonneer_ratio)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DetailsOptional
        dashboard={layout === "dashboard"}
        summary="Detailtabel kanaal per artikel (analyse A)"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Analyse A — kanaal per artikel (gesorteerd per artikel op abonnementen, dan views)
        </p>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[56rem] text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-2 py-2 font-medium text-slate-800 sm:px-3">maand</th>
                <th className="px-2 py-2 font-medium text-slate-800 sm:px-3">pagePath</th>
                <th className="px-2 py-2 font-medium text-slate-800 sm:px-3">pageTitle</th>
                <th className="px-2 py-2 font-medium text-slate-800 sm:px-3">
                  sessionDefaultChannelGroup
                </th>
                <th className="px-2 py-2 text-right font-medium text-slate-800 sm:px-3">pw_view</th>
                <th className="px-2 py-2 text-right font-medium text-slate-800 sm:px-3">pw_abo</th>
                <th className="px-2 py-2 text-right font-medium text-slate-800 sm:px-3">ratio</th>
              </tr>
            </thead>
            <tbody>
              {bundle.analysisA.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-slate-600">
                    Geen rijen.
                  </td>
                </tr>
              ) : (
                bundle.analysisA.map((r, i) => (
                  <tr key={`a-${i}-${r.pagePath}-${r.sessionDefaultChannelGroup}`} className="border-b border-slate-100 last:border-0">
                    <td className="whitespace-nowrap px-2 py-2 font-mono text-slate-800 sm:px-3">
                      {r.maand}
                    </td>
                    <td className="max-w-[12rem] truncate px-2 py-2 font-mono text-[11px] text-slate-800 sm:px-3">
                      {r.pagePath}
                    </td>
                    <td className="max-w-[14rem] truncate px-2 py-2 text-slate-700 sm:px-3" title={r.pageTitle}>
                      {r.pageTitle || "—"}
                    </td>
                    <td className="px-2 py-2 text-slate-700 sm:px-3">{r.sessionDefaultChannelGroup}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                      {r.paywall_view.toLocaleString("nl-NL")}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                      {r.paywall_abonneren.toLocaleString("nl-NL")}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                      {formatRatio(r.paywall_abonneer_ratio)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DetailsOptional>

      <DetailsOptional
        dashboard={layout === "dashboard"}
        summary="Detailtabel bron/medium per artikel (analyse B)"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Analyse B — bron/medium per artikel (sessionSourceMedium)
        </p>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[56rem] text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-2 py-2 font-medium text-slate-800 sm:px-3">maand</th>
                <th className="px-2 py-2 font-medium text-slate-800 sm:px-3">pagePath</th>
                <th className="px-2 py-2 font-medium text-slate-800 sm:px-3">pageTitle</th>
                <th className="px-2 py-2 font-medium text-slate-800 sm:px-3">sessionSourceMedium</th>
                <th className="px-2 py-2 text-right font-medium text-slate-800 sm:px-3">pw_view</th>
                <th className="px-2 py-2 text-right font-medium text-slate-800 sm:px-3">pw_abo</th>
                <th className="px-2 py-2 text-right font-medium text-slate-800 sm:px-3">ratio</th>
              </tr>
            </thead>
            <tbody>
              {bundle.analysisB.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-slate-600">
                    Geen rijen.
                  </td>
                </tr>
              ) : (
                bundle.analysisB.map((r, i) => (
                  <tr key={`b-${i}-${r.pagePath}-${r.sessionSourceMedium}`} className="border-b border-slate-100 last:border-0">
                    <td className="whitespace-nowrap px-2 py-2 font-mono text-slate-800 sm:px-3">
                      {r.maand}
                    </td>
                    <td className="max-w-[12rem] truncate px-2 py-2 font-mono text-[11px] text-slate-800 sm:px-3">
                      {r.pagePath}
                    </td>
                    <td className="max-w-[14rem] truncate px-2 py-2 text-slate-700 sm:px-3" title={r.pageTitle}>
                      {r.pageTitle || "—"}
                    </td>
                    <td className="max-w-[16rem] truncate px-2 py-2 text-slate-700 sm:px-3" title={r.sessionSourceMedium}>
                      {r.sessionSourceMedium}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                      {r.paywall_view.toLocaleString("nl-NL")}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                      {r.paywall_abonneren.toLocaleString("nl-NL")}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                      {formatRatio(r.paywall_abonneer_ratio)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DetailsOptional>

      <DetailsOptional dashboard={layout === "dashboard"} summary="Technische check (stap 6)">
        <OriginTechnicalBlock t={bundle.technical} />
      </DetailsOptional>
    </div>
  );
}

function NieuwsbriefArtikelStap7Block({
  report,
  copyNbKey,
  setCopyNbKey,
  layout = "full",
}: {
  report: HistorischNieuwsbriefArtikelReport;
  copyNbKey: string | null;
  setCopyNbKey: (k: string | null) => void;
  layout?: "full" | "dashboard";
}) {
  const endSlug = report.dateRange.endDate.replaceAll("-", "");

  function downloadCsv(csv: string, filename: string) {
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyCsv(csv: string, key: string) {
    try {
      await navigator.clipboard.writeText(csv);
      setCopyNbKey(key);
      window.setTimeout(() => setCopyNbKey(null), 2000);
    } catch {
      setCopyNbKey(null);
    }
  }

  const tech = report.technical;

  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Tabel A — Maandelijkse ontwikkeling</h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              downloadCsv(nbArtikelTableAToCsv(report.tableA), `historisch-nb-artikel-tabelA-${endSlug}.csv`)
            }
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Download CSV (A)
          </button>
          <button
            type="button"
            onClick={() => void copyCsv(nbArtikelTableAToCsv(report.tableA), "nb-a")}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            {copyNbKey === "nb-a" ? "Gekopieerd" : "Kopieer CSV (A)"}
          </button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[64rem] text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-2 py-2 font-medium text-slate-800 sm:px-3">yearMonth</th>
                <th className="px-2 py-2 text-right font-medium text-slate-800 sm:px-3">nb_art</th>
                <th className="px-2 py-2 text-right font-medium text-slate-800 sm:px-3">sessions</th>
                <th className="px-2 py-2 text-right font-medium text-slate-800 sm:px-3">totalUsers</th>
                <th className="px-2 py-2 text-right font-medium text-slate-800 sm:px-3">newUsers</th>
                <th className="px-2 py-2 text-right font-medium text-slate-800 sm:px-3">screenPageViews</th>
                <th className="px-2 py-2 text-right font-medium text-slate-800 sm:px-3">/ sessie</th>
                <th className="px-2 py-2 text-right font-medium text-slate-800 sm:px-3">/ user</th>
                <th className="px-2 py-2 text-right font-medium text-slate-800 sm:px-3">/ new</th>
                <th className="px-2 py-2 text-right font-medium text-slate-800 sm:px-3">/ 1k pv</th>
              </tr>
            </thead>
            <tbody>
              {report.tableA.map((r) => (
                <tr key={r.yearMonth} className="border-b border-slate-100 last:border-0">
                  <td className="whitespace-nowrap px-2 py-2 font-mono text-slate-800 sm:px-3">
                    {r.yearMonth}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                    {r.nieuwsbrief_inschrijving_artikelen.toLocaleString("nl-NL")}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                    {r.sessions.toLocaleString("nl-NL")}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                    {r.totalUsers.toLocaleString("nl-NL")}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                    {r.newUsers.toLocaleString("nl-NL")}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                    {r.screenPageViews.toLocaleString("nl-NL")}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                    {formatRatio(r.nieuwsbrief_per_session)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                    {formatRatio(r.nieuwsbrief_per_totalUser)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                    {formatRatio(r.nieuwsbrief_per_newUser)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                    {formatPer1k(r.nieuwsbrief_per_1000_pageviews)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <DetailsOptional dashboard={layout === "dashboard"} summary="Tabel B — Device per maand">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Tabel B — Device per maand</h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              downloadCsv(nbArtikelTableBToCsv(report.tableB), `historisch-nb-artikel-tabelB-${endSlug}.csv`)
            }
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Download CSV (B)
          </button>
          <button
            type="button"
            onClick={() => void copyCsv(nbArtikelTableBToCsv(report.tableB), "nb-b")}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            {copyNbKey === "nb-b" ? "Gekopieerd" : "Kopieer CSV (B)"}
          </button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[60rem] text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-2 py-2 font-medium text-slate-800 sm:px-3">yearMonth</th>
                <th className="px-2 py-2 font-medium text-slate-800 sm:px-3">deviceCategory</th>
                <th className="px-2 py-2 text-right font-medium text-slate-800 sm:px-3">nb_art</th>
                <th className="px-2 py-2 text-right font-medium text-slate-800 sm:px-3">sessions</th>
                <th className="px-2 py-2 text-right font-medium text-slate-800 sm:px-3">totalUsers</th>
                <th className="px-2 py-2 text-right font-medium text-slate-800 sm:px-3">newUsers</th>
                <th className="px-2 py-2 text-right font-medium text-slate-800 sm:px-3">screenPageViews</th>
                <th className="px-2 py-2 text-right font-medium text-slate-800 sm:px-3">/ sessie</th>
                <th className="px-2 py-2 text-right font-medium text-slate-800 sm:px-3">/ new</th>
                <th className="px-2 py-2 text-right font-medium text-slate-800 sm:px-3">/ 1k pv</th>
              </tr>
            </thead>
            <tbody>
              {report.tableB.map((r, i) => (
                <tr
                  key={`${r.yearMonth}-${r.deviceCategory}-${i}`}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="whitespace-nowrap px-2 py-2 font-mono text-slate-800 sm:px-3">
                    {r.yearMonth}
                  </td>
                  <td className="px-2 py-2 text-slate-700 sm:px-3">{r.deviceCategory}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                    {r.nieuwsbrief_inschrijving_artikelen.toLocaleString("nl-NL")}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                    {r.sessions.toLocaleString("nl-NL")}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                    {r.totalUsers.toLocaleString("nl-NL")}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                    {r.newUsers.toLocaleString("nl-NL")}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                    {r.screenPageViews.toLocaleString("nl-NL")}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                    {formatRatio(r.nieuwsbrief_per_session)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                    {formatRatio(r.nieuwsbrief_per_newUser)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                    {formatPer1k(r.nieuwsbrief_per_1000_pageviews)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      </DetailsOptional>

      <DetailsOptional dashboard={layout === "dashboard"} summary="Tabel C — Kanaal per maand">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Tabel C — Kanaal per maand</h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              downloadCsv(nbArtikelTableCToCsv(report.tableC), `historisch-nb-artikel-tabelC-${endSlug}.csv`)
            }
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Download CSV (C)
          </button>
          <button
            type="button"
            onClick={() => void copyCsv(nbArtikelTableCToCsv(report.tableC), "nb-c")}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            {copyNbKey === "nb-c" ? "Gekopieerd" : "Kopieer CSV (C)"}
          </button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[60rem] text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-2 py-2 font-medium text-slate-800 sm:px-3">yearMonth</th>
                <th className="px-2 py-2 font-medium text-slate-800 sm:px-3">sessionDefaultChannelGroup</th>
                <th className="px-2 py-2 text-right font-medium text-slate-800 sm:px-3">nb_art</th>
                <th className="px-2 py-2 text-right font-medium text-slate-800 sm:px-3">sessions</th>
                <th className="px-2 py-2 text-right font-medium text-slate-800 sm:px-3">totalUsers</th>
                <th className="px-2 py-2 text-right font-medium text-slate-800 sm:px-3">newUsers</th>
                <th className="px-2 py-2 text-right font-medium text-slate-800 sm:px-3">screenPageViews</th>
                <th className="px-2 py-2 text-right font-medium text-slate-800 sm:px-3">/ sessie</th>
                <th className="px-2 py-2 text-right font-medium text-slate-800 sm:px-3">/ new</th>
                <th className="px-2 py-2 text-right font-medium text-slate-800 sm:px-3">/ 1k pv</th>
              </tr>
            </thead>
            <tbody>
              {report.tableC.map((r, i) => (
                <tr
                  key={`${r.yearMonth}-${r.sessionDefaultChannelGroup}-${i}`}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="whitespace-nowrap px-2 py-2 font-mono text-slate-800 sm:px-3">
                    {r.yearMonth}
                  </td>
                  <td className="max-w-[14rem] truncate px-2 py-2 text-slate-700 sm:px-3" title={r.sessionDefaultChannelGroup}>
                    {r.sessionDefaultChannelGroup}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                    {r.nieuwsbrief_inschrijving_artikelen.toLocaleString("nl-NL")}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                    {r.sessions.toLocaleString("nl-NL")}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                    {r.totalUsers.toLocaleString("nl-NL")}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                    {r.newUsers.toLocaleString("nl-NL")}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                    {r.screenPageViews.toLocaleString("nl-NL")}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                    {formatRatio(r.nieuwsbrief_per_session)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                    {formatRatio(r.nieuwsbrief_per_newUser)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                    {formatPer1k(r.nieuwsbrief_per_1000_pageviews)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      </DetailsOptional>

      <DetailsOptional dashboard={layout === "dashboard"} summary="Technische check (nieuwsbrief)">
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-800">
        <p className="font-medium text-slate-900">Technische check</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-slate-700">
          <li>
            <span className="font-mono">eventCount</span> en trafficmetrics (sessions, users, screenPageViews):{" "}
            {tech.eventCountAndTrafficSingleQuery ? (
              <span className="text-amber-800">één query (onverwacht voor deze implementatie)</span>
            ) : (
              <span className="text-emerald-800">aparte queries per tabeltype, samengevoegd op yearMonth (+ device/kanaal)</span>
            )}
          </li>
          <li>
            Trafficmetrics overal 0 (tabel A):{" "}
            <span className="font-mono">{tech.trafficMetricsAllZero ? "ja" : "nee"}</span> — enige kernactivity (
            sessions of screenPageViews) &gt; 0 ergens:{" "}
            <span className="font-mono">{tech.trafficCoreAnyNonZero ? "ja" : "nee"}</span>
          </li>
          <li>
            Trafficmetrics bij tabel B en C zijn propertybreed per maand × device (respectievelijk kanaal),
            niet beperkt tot sessies waarin het event werd geregistreerd.{" "}
            <span className="font-mono">eventCount</span> is wel gefilterd op{" "}
            <span className="font-mono">nieuwsbrief_inschrijving_artikelen</span>.
          </li>
          <li>
            Tabel A <span className="font-mono">nieuwsbrief_inschrijving_artikelen</span> = stap 2 per maand:{" "}
            <span className="font-mono">{tech.stap2AllMonthsMatch ? "ja (alle maanden)" : "nee (zie tabel)"}</span>
          </li>
        </ul>
        {!tech.stap2AllMonthsMatch && tech.stap2Comparisons.length > 0 ? (
          <div className="mt-3 overflow-x-auto rounded border border-slate-200 bg-white">
            <table className="w-full min-w-[36rem] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-2 py-1.5 font-medium">yearMonth</th>
                  <th className="px-2 py-1.5 text-right font-medium">stap 2</th>
                  <th className="px-2 py-1.5 text-right font-medium">tabel A</th>
                  <th className="px-2 py-1.5 text-right font-medium">verschil</th>
                  <th className="px-2 py-1.5 font-medium">match</th>
                </tr>
              </thead>
              <tbody>
                {tech.stap2Comparisons.map((c) => (
                  <tr key={c.yearMonth} className="border-b border-slate-100">
                    <td className="px-2 py-1.5 font-mono">{c.yearMonth}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{c.stap2Nieuwsbrief}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{c.tableANieuwsbrief}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{c.diff}</td>
                    <td className="px-2 py-1.5 font-mono">{c.match ? "ja" : "nee"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <p className="mt-3 text-slate-700">{tech.measurementNote}</p>
        <p className="mt-2 font-medium text-amber-950">{tech.blokAttributieWaarschuwing}</p>
      </div>
      </DetailsOptional>
    </div>
  );
}

export default function HistorischPage() {
  const [report, setReport] = useState<HistorischGa4AvailabilityReport | null>(null);
  const [funnel, setFunnel] = useState<HistorischFunnelMonthlyReport | null>(null);
  const [traffic, setTraffic] = useState<HistorischTrafficMonthlyReport | null>(null);
  const [topArticles, setTopArticles] = useState<HistorischTopArticlesReport | null>(null);
  const [topOrigin, setTopOrigin] = useState<HistorischTopArticlesOriginReport | null>(null);
  const [nbArtikel, setNbArtikel] = useState<HistorischNieuwsbriefArtikelReport | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [funnelErr, setFunnelErr] = useState<string | null>(null);
  const [trafficErr, setTrafficErr] = useState<string | null>(null);
  const [topArticlesErr, setTopArticlesErr] = useState<string | null>(null);
  const [topOriginErr, setTopOriginErr] = useState<string | null>(null);
  const [nbArtikelErr, setNbArtikelErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copyDoneFunnel, setCopyDoneFunnel] = useState(false);
  const [copyDoneTraffic, setCopyDoneTraffic] = useState(false);
  const [copyDoneCombined, setCopyDoneCombined] = useState(false);
  const [copyTopKey, setCopyTopKey] = useState<string | null>(null);
  const [copyOriginKey, setCopyOriginKey] = useState<string | null>(null);
  const [copyNbKey, setCopyNbKey] = useState<string | null>(null);
  const [peakMonth, setPeakMonth] = useState<PeakMonthKey>("jan");

  const combined = useMemo(
    () => buildHistorischCombinedMonthly(funnel, traffic),
    [funnel, traffic]
  );

  const loadAll = useCallback(async (refresh: boolean) => {
    setLoading(true);
    setErr(null);
    setFunnelErr(null);
    setTrafficErr(null);
    setTopArticlesErr(null);
    setTopOriginErr(null);
    setNbArtikelErr(null);
    setCopyDoneFunnel(false);
    setCopyDoneTraffic(false);
    setCopyDoneCombined(false);
    setCopyTopKey(null);
    setCopyOriginKey(null);
    setCopyNbKey(null);
    const q = refresh ? "?refresh=1" : "";
    try {
      const [resA, resF, resT, resTop, resOrigin, resNb] = await Promise.all([
        fetch(`/api/historisch/ga4-availability${q}`, { credentials: "include" }),
        fetch(`/api/historisch/funnel-monthly${q}`, { credentials: "include" }),
        fetch(`/api/historisch/traffic-monthly${q}`, { credentials: "include" }),
        fetch(`/api/historisch/top-articles${q}`, { credentials: "include" }),
        fetch(`/api/historisch/top-articles-origin${q}`, { credentials: "include" }),
        fetch(`/api/historisch/nieuwsbrief-artikel${q}`, { credentials: "include" }),
      ]);

      if (resA.ok) {
        setReport((await resA.json()) as HistorischGa4AvailabilityReport);
        setErr(null);
      } else {
        setReport(null);
        const j = (await resA.json().catch(() => ({}))) as { error?: string };
        setErr(j.error ?? `Beschikbaarheid: HTTP ${resA.status}`);
      }

      if (resF.ok) {
        setFunnel((await resF.json()) as HistorischFunnelMonthlyReport);
        setFunnelErr(null);
      } else {
        setFunnel(null);
        const j = (await resF.json().catch(() => ({}))) as { error?: string };
        setFunnelErr(j.error ?? `Funnel: HTTP ${resF.status}`);
      }
      if (resT.ok) {
        setTraffic((await resT.json()) as HistorischTrafficMonthlyReport);
        setTrafficErr(null);
      } else {
        setTraffic(null);
        const j = (await resT.json().catch(() => ({}))) as { error?: string };
        setTrafficErr(j.error ?? `Verkeer: HTTP ${resT.status}`);
      }

      if (resTop.ok) {
        setTopArticles((await resTop.json()) as HistorischTopArticlesReport);
        setTopArticlesErr(null);
      } else {
        setTopArticles(null);
        const j = (await resTop.json().catch(() => ({}))) as { error?: string };
        setTopArticlesErr(j.error ?? `Topartikelen: HTTP ${resTop.status}`);
      }

      if (resOrigin.ok) {
        setTopOrigin((await resOrigin.json()) as HistorischTopArticlesOriginReport);
        setTopOriginErr(null);
      } else {
        setTopOrigin(null);
        const j = (await resOrigin.json().catch(() => ({}))) as { error?: string };
        setTopOriginErr(j.error ?? `Herkomst topartikelen: HTTP ${resOrigin.status}`);
      }

      if (resNb.ok) {
        setNbArtikel((await resNb.json()) as HistorischNieuwsbriefArtikelReport);
        setNbArtikelErr(null);
      } else {
        setNbArtikel(null);
        const j = (await resNb.json().catch(() => ({}))) as { error?: string };
        setNbArtikelErr(j.error ?? `Nieuwsbrief artikelblokken: HTTP ${resNb.status}`);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Onbekende fout");
      setFunnelErr(e instanceof Error ? e.message : "Onbekende fout");
      setTrafficErr(e instanceof Error ? e.message : "Onbekende fout");
      setTopArticles(null);
      setTopArticlesErr(e instanceof Error ? e.message : "Onbekende fout");
      setTopOrigin(null);
      setTopOriginErr(e instanceof Error ? e.message : "Onbekende fout");
      setNbArtikel(null);
      setNbArtikelErr(e instanceof Error ? e.message : "Onbekende fout");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll(false);
  }, [loadAll]);

  function downloadCsv() {
    if (!funnel || funnel.rows.length === 0) return;
    const csv = historischFunnelReportToCsv(funnel);
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historisch-funnel-maandelijks-${funnel.dateRange.endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyCsv() {
    if (!funnel || funnel.rows.length === 0) return;
    const csv = historischFunnelReportToCsv(funnel);
    try {
      await navigator.clipboard.writeText(csv);
      setCopyDoneFunnel(true);
      window.setTimeout(() => setCopyDoneFunnel(false), 2000);
    } catch {
      setCopyDoneFunnel(false);
    }
  }

  function downloadTrafficCsv() {
    if (!traffic || traffic.rows.length === 0) return;
    const csv = historischTrafficReportToCsv(traffic);
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historisch-verkeer-maandelijks-${traffic.dateRange.endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyTrafficCsv() {
    if (!traffic || traffic.rows.length === 0) return;
    const csv = historischTrafficReportToCsv(traffic);
    try {
      await navigator.clipboard.writeText(csv);
      setCopyDoneTraffic(true);
      window.setTimeout(() => setCopyDoneTraffic(false), 2000);
    } catch {
      setCopyDoneTraffic(false);
    }
  }

  function downloadCombinedCsv() {
    if (!combined.rows.length) return;
    const csv = historischCombinedReportToCsv(combined);
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historisch-analyse-gecombineerd-${combined.dateRange.endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyCombinedCsv() {
    if (!combined.rows.length) return;
    const csv = historischCombinedReportToCsv(combined);
    try {
      await navigator.clipboard.writeText(csv);
      setCopyDoneCombined(true);
      window.setTimeout(() => setCopyDoneCombined(false), 2000);
    } catch {
      setCopyDoneCombined(false);
    }
  }

  const summaryCards = useMemo(
    () => buildHistorischDashboardSummary(combined.rows.length > 0 ? combined : null, nbArtikel),
    [combined, nbArtikel]
  );

  const lastDataLabel =
    report?.generatedAt ??
    combined.generatedAt ??
    funnel?.generatedAt ??
    traffic?.generatedAt ??
    nbArtikel?.generatedAt ??
    topArticles?.generatedAt ??
    topOrigin?.generatedAt ??
    null;

  function goSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200 px-6 py-8">
        <div className="mx-auto max-w-6xl space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
                Historisch Nieuwsblad — analyse online/digitale instroom
              </h1>
              <p className="mt-2 max-w-3xl text-base text-slate-600">
                Paywall, topartikelen en nieuwsbriefinschrijvingen vanaf januari 2024
              </p>
            </div>
            <div className="shrink-0 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
              <p>
                <span className="font-medium text-slate-800">Databron:</span> GA4 Data API
              </p>
              {lastDataLabel ? (
                <p className="mt-1 text-xs text-slate-600">
                  Laatst gegenereerd / opgehaald (indicatie):{" "}
                  <span className="font-mono text-slate-800">{lastDataLabel}</span>
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-500">Nog geen tijdstempel beschikbaar.</p>
              )}
              <button
                type="button"
                onClick={() => void loadAll(true)}
                className="mt-3 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                disabled={loading}
              >
                Opnieuw ophalen
              </button>
            </div>
          </div>
          <p className="text-sm text-slate-600">
            Dit scherm combineert feiten uit de dataset met voorzichtige duiding (“lijkt”, “wijst erop”) voor
            tijdens een meeting. Onderliggende cijfers, export en technische controles staan verderop. Cache:
            typisch maximaal een week — gebruik “Opnieuw ophalen” voor stap 1 t/m 8.
          </p>
          <div className="flex flex-wrap gap-3 print:hidden">
            <Link href="/historisch/presentatie" className="text-sm font-medium text-slate-700 underline-offset-4 hover:underline">
              Presentatie
            </Link>
            <Link href="/" className="text-sm font-medium text-slate-700 underline-offset-4 hover:underline">
              Home
            </Link>
            <Link
              href="/api/auth/google"
              className="text-sm font-medium text-slate-700 underline-offset-4 hover:underline"
            >
              Google-login
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        {loading && <p className="text-sm text-slate-600">Bezig met ophalen…</p>}
        {err && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Stap 1: {err}
          </div>
        )}
        {funnelErr && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Stap 2: {funnelErr}
          </div>
        )}
        {trafficErr && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Stap 3: {trafficErr}
          </div>
        )}
        {topArticlesErr && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Stap 5: {topArticlesErr}
          </div>
        )}
        {topOriginErr && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Stap 6: {topOriginErr}
          </div>
        )}
        {nbArtikelErr && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Stap 7: {nbArtikelErr}
          </div>
        )}

        {!loading && (
          <>
            <div className="mb-14 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((c) => (
                <div
                  key={c.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{c.title}</p>
                  <p className="mt-2 text-xs leading-snug text-slate-600">{c.kicker}</p>
                  <p className="mt-4 text-sm leading-relaxed text-slate-800">{c.sentence}</p>
                </div>
              ))}
            </div>

            <BelangrijksteConclusiesBlok />

            <nav className="sticky top-0 z-30 -mx-6 mb-14 border-b border-slate-200 bg-white/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/80 print:hidden">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["overzicht", "Overzicht"],
                    ["maandontwikkeling", "Maandontwikkeling"],
                    ["piekmaanden", "Piekmaanden"],
                    ["nieuwsbrief", "Nieuwsbrief"],
                    ["vervolgstappen", "Vervolgstappen"],
                    ["data-exports", "Data & exports"],
                    ["powerpoint-assets", "PowerPoint-assets"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => goSection(id)}
                    className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </nav>

            <section id="overzicht" className="mb-20 scroll-mt-32 space-y-6">
              <h2 className="text-xl font-semibold text-slate-900">Overzicht</h2>
              <DuidingOverzicht />
              <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
                Belangrijkste maandgrafieken voor paywall, ratio, indexen en nieuwsbrief per 1.000
                paginaweergaven. PNG-download per grafiek.
              </p>
              <HistorischDashboardOverviewCharts
                combined={combined.rows.length > 0 ? combined : null}
                nbArtikel={nbArtikel}
              />
            </section>

            <section id="maandontwikkeling" className="mb-20 scroll-mt-32 space-y-5">
              <h2 className="text-xl font-semibold text-slate-900">Maandontwikkeling</h2>
              <DuidingMaandontwikkeling />
              <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
                Deze tabellen combineren verkeer, paywall-events en nieuwsbrief-events per maand.
              </p>
              {combined.rows.length > 0 ? (
                <details className="rounded-2xl border border-slate-200 bg-white shadow-sm open:bg-white">
                  <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
                    Toon maandtabel (stap 4 — gecombineerde analyse)
                  </summary>
                  <div className="border-t border-slate-200 p-5">
                    <Stap4CombinedSection
                      combined={combined}
                      downloadCombinedCsv={downloadCombinedCsv}
                      copyCombinedCsv={() => void copyCombinedCsv()}
                      copyDoneCombined={copyDoneCombined}
                      showHeading={false}
                    />
                  </div>
                </details>
              ) : null}
              {funnel ? (
                <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
                    Funnel-export (stap 2)
                  </summary>
                  <div className="border-t border-slate-200 p-5">
                    <Stap2FunnelSection
                      funnel={funnel}
                      downloadCsv={downloadCsv}
                      copyCsv={() => void copyCsv()}
                      copyDoneFunnel={copyDoneFunnel}
                      showHeading={false}
                    />
                  </div>
                </details>
              ) : null}
              {traffic ? (
                <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
                    Traffic-export (stap 3)
                  </summary>
                  <div className="border-t border-slate-200 p-5">
                    <Stap3TrafficSection
                      traffic={traffic}
                      downloadTrafficCsv={downloadTrafficCsv}
                      copyTrafficCsv={() => void copyTrafficCsv()}
                      copyDoneTraffic={copyDoneTraffic}
                      showHeading={false}
                    />
                  </div>
                </details>
              ) : null}
            </section>

            <section id="piekmaanden" className="mb-20 scroll-mt-32 space-y-6">
              <h2 className="text-xl font-semibold text-slate-900">Piekmaanden</h2>
              <p className="text-sm text-amber-950">
                Let op: sommige <span className="font-mono">pageTitle</span>-waarden lijken vertaald of
                afwijkend; gebruik <span className="font-mono">pagePath</span> als primaire identifier.
              </p>
              <DuidingPiekmaanden />
              <div className="flex flex-wrap gap-2 print:hidden">
                <button
                  type="button"
                  onClick={() => setPeakMonth("jan")}
                  className={`rounded-full px-4 py-2 text-sm font-medium ${
                    peakMonth === "jan"
                      ? "bg-slate-900 text-white"
                      : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  Januari 2024
                </button>
                <button
                  type="button"
                  onClick={() => setPeakMonth("jun")}
                  className={`rounded-full px-4 py-2 text-sm font-medium ${
                    peakMonth === "jun"
                      ? "bg-slate-900 text-white"
                      : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  Juni 2024
                </button>
              </div>
              {topArticles && !topArticles.fatalError && topOrigin && !topOrigin.fatalError ? (
                <div className="space-y-8">
                  {peakMonth === "jan" ? (
                    <>
                      <TopArticlesMonthSection
                        layout="dashboard"
                        bundle={topArticles.january2024}
                        fileSlug="2024-01"
                        copyTopKey={copyTopKey}
                        setCopyTopKey={setCopyTopKey}
                      />
                      <OriginMonthBlock
                        layout="dashboard"
                        bundle={topOrigin.january2024}
                        fileSlug="2024-01"
                        copyOriginKey={copyOriginKey}
                        setCopyOriginKey={setCopyOriginKey}
                      />
                      <HistorischDashboardPeakChannelChart topOrigin={topOrigin} month="jan" />
                    </>
                  ) : (
                    <>
                      <TopArticlesMonthSection
                        layout="dashboard"
                        bundle={topArticles.june2024}
                        fileSlug="2024-06"
                        copyTopKey={copyTopKey}
                        setCopyTopKey={setCopyTopKey}
                      />
                      <OriginMonthBlock
                        layout="dashboard"
                        bundle={topOrigin.june2024}
                        fileSlug="2024-06"
                        copyOriginKey={copyOriginKey}
                        setCopyOriginKey={setCopyOriginKey}
                      />
                      <HistorischDashboardPeakChannelChart topOrigin={topOrigin} month="jun" />
                    </>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-600">
                  Data voor piekmaanden vereist stap 5 en 6 zonder fout.
                </p>
              )}
            </section>

            <section id="nieuwsbrief" className="mb-20 scroll-mt-32 space-y-6">
              <h2 className="text-xl font-semibold text-slate-900">Nieuwsbrief</h2>
              <DuidingNieuwsbrief />
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                Let op: zonder aparte view- en click-events voor het nieuwsbriefblok is niet vast te stellen
                of het probleem zichtbaarheid, klikbereidheid of formulierconversie is.
              </p>
              <HistorischDashboardNewsletterCharts
                combined={combined.rows.length > 0 ? combined : null}
                nbArtikel={nbArtikel}
              />
              {nbArtikel && !nbArtikel.fatalError && !nbArtikel.error ? (
                <NieuwsbriefArtikelStap7Block
                  layout="dashboard"
                  report={nbArtikel}
                  copyNbKey={copyNbKey}
                  setCopyNbKey={setCopyNbKey}
                />
              ) : null}
            </section>

            <VervolgstappenBlok />

            <section id="data-exports" className="mb-24 scroll-mt-32 space-y-4">
              <h2 className="text-xl font-semibold text-slate-900">Data & exports</h2>
              <p className="max-w-3xl text-sm text-slate-600">
                Volledige technische stappen, controles en exports. Standaard ingeklapt zodat de
                meeting-weergave overzichtelijk blijft.
              </p>
              {report ? (
                <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-slate-900">
                    Stap 1 — Beschikbaarheidscheck
                  </summary>
                  <div className="border-t border-slate-200 p-5">
                    <Stap1AvailabilitySection report={report} />
                  </div>
                </details>
              ) : null}
              {funnel ? (
                <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-slate-900">
                    Stap 2 — Funnel-export
                  </summary>
                  <div className="border-t border-slate-200 p-5">
                    <Stap2FunnelSection
                      funnel={funnel}
                      downloadCsv={downloadCsv}
                      copyCsv={() => void copyCsv()}
                      copyDoneFunnel={copyDoneFunnel}
                    />
                  </div>
                </details>
              ) : null}
              {traffic ? (
                <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-slate-900">
                    Stap 3 — Traffic-export
                  </summary>
                  <div className="border-t border-slate-200 p-5">
                    <Stap3TrafficSection
                      traffic={traffic}
                      downloadTrafficCsv={downloadTrafficCsv}
                      copyTrafficCsv={() => void copyTrafficCsv()}
                      copyDoneTraffic={copyDoneTraffic}
                    />
                  </div>
                </details>
              ) : null}
              {combined.rows.length > 0 ? (
                <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-slate-900">
                    Stap 4 — Gecombineerde analyse
                  </summary>
                  <div className="border-t border-slate-200 p-5">
                    <Stap4CombinedSection
                      combined={combined}
                      downloadCombinedCsv={downloadCombinedCsv}
                      copyCombinedCsv={() => void copyCombinedCsv()}
                      copyDoneCombined={copyDoneCombined}
                    />
                  </div>
                </details>
              ) : null}
              {!loading && topArticles ? (
                <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-slate-900">
                    Stap 5 — Topartikelen
                  </summary>
                  <div className="border-t border-slate-200 p-5">
                    <section className="space-y-6 text-sm">
                      <h3 className="text-base font-semibold text-slate-900">
                        Topartikelen (paywall-events, jan. en jun. 2024)
                      </h3>
                      <p className="text-slate-600">
                        GA4 Data API. Gegenereerd:{" "}
                        <span className="font-mono">{topArticles.generatedAt}</span>. Property:{" "}
                        <code className="rounded bg-slate-100 px-1">{topArticles.propertyEnvKey}</code> (
                        {topArticles.brand}).
                      </p>
                      {topArticles.fatalError ? (
                        <p className="text-red-700">{topArticles.fatalError}</p>
                      ) : (
                        <div className="space-y-10">
                          <TopArticlesMonthSection
                            bundle={topArticles.january2024}
                            fileSlug="2024-01"
                            copyTopKey={copyTopKey}
                            setCopyTopKey={setCopyTopKey}
                          />
                          <TopArticlesMonthSection
                            bundle={topArticles.june2024}
                            fileSlug="2024-06"
                            copyTopKey={copyTopKey}
                            setCopyTopKey={setCopyTopKey}
                          />
                        </div>
                      )}
                    </section>
                  </div>
                </details>
              ) : null}
              {!loading && topOrigin ? (
                <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-slate-900">
                    Stap 6 — Herkomst topartikelen
                  </summary>
                  <div className="border-t border-slate-200 p-5">
                    <section className="space-y-6 text-sm">
                      <h3 className="text-base font-semibold text-slate-900">
                        Herkomst topartikelen (kanaal en bron/medium, jan. en jun. 2024)
                      </h3>
                      <p className="text-slate-600">
                        Gegenereerd: <span className="font-mono">{topOrigin.generatedAt}</span>. Property:{" "}
                        <code className="rounded bg-slate-100 px-1">{topOrigin.propertyEnvKey}</code> (
                        {topOrigin.brand}).
                      </p>
                      {topOrigin.fatalError ? (
                        <p className="text-red-700">{topOrigin.fatalError}</p>
                      ) : (
                        <div className="space-y-10">
                          <OriginMonthBlock
                            bundle={topOrigin.january2024}
                            fileSlug="2024-01"
                            copyOriginKey={copyOriginKey}
                            setCopyOriginKey={setCopyOriginKey}
                          />
                          <OriginMonthBlock
                            bundle={topOrigin.june2024}
                            fileSlug="2024-06"
                            copyOriginKey={copyOriginKey}
                            setCopyOriginKey={setCopyOriginKey}
                          />
                        </div>
                      )}
                    </section>
                  </div>
                </details>
              ) : null}
              {!loading && nbArtikel ? (
                <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-slate-900">
                    Stap 7 — Nieuwsbriefanalyse
                  </summary>
                  <div className="border-t border-slate-200 p-5">
                    <section className="space-y-6 text-sm">
                      <h3 className="text-base font-semibold text-slate-900">
                        Nieuwsbrief uit artikelblokken (
                        <span className="font-mono">nieuwsbrief_inschrijving_artikelen</span>)
                      </h3>
                      <p className="text-slate-600">
                        Periode: <span className="font-mono">{nbArtikel.dateRange.startDate}</span> t/m{" "}
                        <span className="font-mono">{nbArtikel.dateRange.endDate}</span>. Gegenereerd:{" "}
                        <span className="font-mono">{nbArtikel.generatedAt}</span>.
                      </p>
                      {nbArtikel.fatalError ? (
                        <p className="text-red-700">{nbArtikel.fatalError}</p>
                      ) : nbArtikel.error ? (
                        <p className="text-red-700">{nbArtikel.error}</p>
                      ) : (
                        <NieuwsbriefArtikelStap7Block
                          report={nbArtikel}
                          copyNbKey={copyNbKey}
                          setCopyNbKey={setCopyNbKey}
                        />
                      )}
                    </section>
                  </div>
                </details>
              ) : null}
              <details className="rounded-2xl border border-slate-200 bg-white shadow-sm print:border-0">
                <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-slate-900">
                  Stap 8 — Grafiekdownloads (compact)
                </summary>
                <div className="border-t border-slate-200 p-5">
                  <p className="mb-4 max-w-2xl text-sm text-slate-600">
                    Compacte set voor print/A4 en bulk-PNG. Zelfde dataset als de grote grafieken in het
                    overzicht.
                  </p>
                  <div className="max-w-[210mm] print:mx-auto">
                    <HistorischMeetingCharts
                      combined={combined.rows.length > 0 ? combined : null}
                      nbArtikel={nbArtikel}
                      topOrigin={topOrigin}
                    />
                  </div>
                </div>
              </details>
            </section>

            <HistorischPowerpointAssets
              combined={combined.rows.length > 0 ? combined : null}
              nbArtikel={nbArtikel}
              topOrigin={topOrigin}
              topArticles={topArticles}
            />
          </>
        )}
      </main>
    </div>
  );
}
