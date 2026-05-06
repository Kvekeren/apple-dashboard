import type { HistorischGa4AvailabilityReport } from "@/lib/ga4-historisch-availability";
import type { HistorischFunnelMonthlyReport } from "@/lib/historisch-funnel-shared";
import type { HistorischTrafficMonthlyReport } from "@/lib/historisch-traffic-shared";
import type { HistorischCombinedMonthlyReport } from "@/lib/historisch-combined-shared";
import { formatRatio } from "@/lib/historisch-page-format";

export function SampleTable({
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

export function Stap1AvailabilitySection({ report }: { report: HistorischGa4AvailabilityReport }) {
  return (
    <div className="space-y-10 text-sm leading-relaxed">
      <section>
        <h2 className="text-base font-semibold text-slate-900">Stap 1 — Beschikbaarheid</h2>
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
        {report.fatalError && <p className="mt-2 text-red-700">{report.fatalError}</p>}
      </section>

      <section>
        <h2 className="text-base font-semibold text-slate-900">1. Perioden (API bereikbaar?)</h2>
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
        <h2 className="text-base font-semibold text-slate-900">2. Events (bestaan + volume)</h2>
        <p className="mt-1 text-slate-600">
          Venster voor teller: 2024-01-01 t/m eind van de lange periode hierboven. Per event max. 5 rijen
          in het voorbeeld.
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
                <p className="mt-2 text-amber-800">Geen data (eventCount = 0 in dit venster)</p>
              )}
              {e.sample && <SampleTable title="Voorbeeld" table={e.sample} />}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-base font-semibold text-slate-900">3. Dimensies i.c.m. events (eventCount)</h2>
        <p className="mt-1 text-slate-600">
          Elke dimensie wordt geprobeerd samen met{" "}
          <code className="rounded bg-slate-100 px-1">eventName</code> en filter op het eerste event dat in §2
          data heeft; zo niet, op <code className="rounded bg-slate-100 px-1">paywall_view</code>.
        </p>
        <ul className="mt-3 space-y-4">
          {report.dimensions.map((d) => (
            <li key={d.apiDimension} className="rounded-lg border border-slate-200 p-4">
              <p className="font-medium text-slate-900">
                {d.displayName}{" "}
                <span className="font-mono text-xs font-normal text-slate-500">({d.apiDimension})</span>
              </p>
              {d.eventUsed && <p className="text-xs text-slate-500">Filter-event: {d.eventUsed}</p>}
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
        <h2 className="text-base font-semibold text-slate-900">4. Nieuwe gebruikers (metric)</h2>
        {report.newUsers.error ? (
          <p className="mt-2 text-red-700">{report.newUsers.error}</p>
        ) : report.newUsers.available ? (
          <p className="mt-2 text-emerald-800">Beschikbaar in deze combinatie.</p>
        ) : (
          <p className="mt-2 text-amber-800">Niet beschikbaar.</p>
        )}
      {report.newUsers.note && <p className="mt-2 text-slate-600">{report.newUsers.note}</p>}
      {report.newUsers.sample && (
          <div className="mt-4">
            <SampleTable title="Voorbeeld (max. 5 rijen)" table={report.newUsers.sample} />
          </div>
        )}
      </section>
    </div>
  );
}

export function Stap2FunnelSection({
  funnel,
  downloadCsv,
  copyCsv,
  copyDoneFunnel,
  showHeading = true,
}: {
  funnel: HistorischFunnelMonthlyReport;
  downloadCsv: () => void;
  copyCsv: () => void;
  copyDoneFunnel: boolean;
  showHeading?: boolean;
}) {
  return (
    <div className="space-y-4 text-sm">
      {showHeading ? (
        <h2 className="text-base font-semibold text-slate-900">Stap 2 — Maandelijkse funnel-export</h2>
      ) : null}
      <p className="text-sm text-slate-600">
        Metric: <code className="rounded bg-slate-100 px-1">eventCount</code>. Dimensie:{" "}
        <code className="rounded bg-slate-100 px-1">yearMonth</code>. Filter: vier{" "}
        <code className="rounded bg-slate-100 px-1">eventName</code>
        -waarden. Datumrange: {funnel.dateRange.startDate} t/m {funnel.dateRange.endDate}. Gegenereerd:{" "}
        {funnel.generatedAt}
      </p>
      {funnel.error && <p className="text-sm text-red-700">{funnel.error}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={downloadCsv}
          disabled={!funnel.rows.length}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          Download CSV
        </button>
        <button
          type="button"
          onClick={() => void copyCsv()}
          disabled={!funnel.rows.length}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
        >
          {copyDoneFunnel ? "Gekopieerd" : "Kopieer CSV"}
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[56rem] text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="whitespace-nowrap px-2 py-2 font-medium text-slate-800 sm:px-3">yearMonth</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-medium text-slate-800 sm:px-3">
                paywall_view
              </th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-medium text-slate-800 sm:px-3">
                paywall_abonneren
              </th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-medium text-slate-800 sm:px-3">
                paywall_inloggen
              </th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-medium text-slate-800 sm:px-3">
                nieuwsbrief_inschrijving_artikelen
              </th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-medium text-slate-800 sm:px-3">
                paywall_abonneer_ratio
              </th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-medium text-slate-800 sm:px-3">
                paywall_login_ratio
              </th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-medium text-slate-800 sm:px-3">
                nieuwsbrief_per_paywall_view
              </th>
            </tr>
          </thead>
          <tbody>
            {funnel.rows.map((r) => (
              <tr key={r.yearMonth} className="border-b border-slate-100 last:border-0">
                <td className="whitespace-nowrap px-2 py-2 font-mono text-slate-800 sm:px-3">
                  {r.yearMonth}
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
      <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-800">
        <p className="font-medium text-slate-900">Technische check</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-slate-700">
          <li>
            Aantal maanden in de tabel: <span className="font-mono">{funnel.technical.tableMonthCount}</span>
          </li>
          <li>
            Startmaand: <span className="font-mono">{funnel.technical.startMonth}</span> — Eindmaand:{" "}
            <span className="font-mono">{funnel.technical.endMonth}</span>
          </li>
          <li>
            Verwacht aantal maanden in bereik:{" "}
            <span className="font-mono">{funnel.technical.expectedMonthCount}</span> — Tabel komt overeen met
            volledige opeenvolgende reeks:{" "}
            <span className="font-mono">{funnel.technical.sequenceComplete ? "ja" : "nee"}</span>
          </li>
          <li>
            Alle vier events met data (totaal &gt; 0 over de periode):{" "}
            <span className="font-mono">{funnel.technical.allFourEventsHaveData ? "ja" : "nee"}</span>
            <ul className="ml-6 mt-1 list-inside list-[circle] text-xs text-slate-600">
              {(
                [
                  ["paywall_view", funnel.technical.eventsWithData.paywall_view],
                  ["paywall_abonneren", funnel.technical.eventsWithData.paywall_abonneren],
                  ["paywall_inloggen", funnel.technical.eventsWithData.paywall_inloggen],
                  [
                    "nieuwsbrief_inschrijving_artikelen",
                    funnel.technical.eventsWithData.nieuwsbrief_inschrijving_artikelen,
                  ],
                ] as const
              ).map(([name, ok]) => (
                <li key={name}>
                  <span className="font-mono">{name}</span>: {ok ? "ja" : "nee"}
                </li>
              ))}
            </ul>
          </li>
          <li>
            Maanden ontbreken in de doorlopende reeks vanaf 2024-01 t/m eindmaand:{" "}
            <span className="font-mono">{funnel.technical.sequenceComplete ? "nee" : "ja"}</span>
          </li>
          <li>
            Maanden zonder enige ruwe GA4-rij voor deze events (in tabel als 0 ingevuld):{" "}
            {funnel.technical.missingMonths.length === 0 ? (
              <span className="font-mono">geen</span>
            ) : (
              <span className="font-mono">{funnel.technical.missingMonths.join(", ")}</span>
            )}
          </li>
        </ul>
      </div>
    </div>
  );
}

export function Stap3TrafficSection({
  traffic,
  downloadTrafficCsv,
  copyTrafficCsv,
  copyDoneTraffic,
  showHeading = true,
}: {
  traffic: HistorischTrafficMonthlyReport;
  downloadTrafficCsv: () => void;
  copyTrafficCsv: () => void;
  copyDoneTraffic: boolean;
  showHeading?: boolean;
}) {
  return (
    <div className="space-y-4 text-sm">
      {showHeading ? (
        <h2 className="text-base font-semibold text-slate-900">
          Stap 3 — Maandelijks verkeer (los van events)
        </h2>
      ) : null}
      <p className="text-sm text-slate-600">
        Dimensie: <code className="rounded bg-slate-100 px-1">yearMonth</code>. Geen{" "}
        <code className="rounded bg-slate-100 px-1">eventName</code>, geen eventfilters. Metrics (zoals door de
        API teruggegeven):{" "}
        <span className="font-mono text-xs">{traffic.technical.metricsUsed.join(", ")}</span>. Range:{" "}
        {traffic.dateRange.startDate} t/m {traffic.dateRange.endDate}. Gegenereerd: {traffic.generatedAt}
      </p>
      {traffic.apiNote && <p className="text-xs text-slate-600">{traffic.apiNote}</p>}
      {traffic.error && <p className="text-sm text-red-700">{traffic.error}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={downloadTrafficCsv}
          disabled={!traffic.rows.length}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          Download CSV
        </button>
        <button
          type="button"
          onClick={() => void copyTrafficCsv()}
          disabled={!traffic.rows.length}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
        >
          {copyDoneTraffic ? "Gekopieerd" : "Kopieer CSV"}
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[72rem] text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="whitespace-nowrap px-2 py-2 font-medium text-slate-800 sm:px-3">yearMonth</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-medium text-slate-800 sm:px-3">
                sessions
              </th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-medium text-slate-800 sm:px-3">
                totalUsers
              </th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-medium text-slate-800 sm:px-3">
                activeUsers
                {!traffic.technical.activeUsersRequested ? (
                  <span className="block text-[10px] font-normal normal-case text-slate-500">(niet in query)</span>
                ) : null}
              </th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-medium text-slate-800 sm:px-3">
                newUsers
              </th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-medium text-slate-800 sm:px-3">
                screenPageViews
              </th>
              {traffic.technical.viewsMetricAvailable ? (
                <th className="whitespace-nowrap px-2 py-2 text-right font-medium text-slate-800 sm:px-3">
                  views
                </th>
              ) : null}
              <th className="whitespace-nowrap px-2 py-2 text-right font-medium text-slate-800 sm:px-3">
                new_user_share
              </th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-medium text-slate-800 sm:px-3">
                views_per_session
              </th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-medium text-slate-800 sm:px-3">
                views_per_user
              </th>
            </tr>
          </thead>
          <tbody>
            {traffic.rows.map((r) => (
              <tr key={r.yearMonth} className="border-b border-slate-100 last:border-0">
                <td className="whitespace-nowrap px-2 py-2 font-mono text-slate-800 sm:px-3">{r.yearMonth}</td>
                <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                  {r.sessions.toLocaleString("nl-NL")}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                  {r.totalUsers.toLocaleString("nl-NL")}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                  {r.activeUsers.toLocaleString("nl-NL")}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                  {r.newUsers.toLocaleString("nl-NL")}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                  {r.screenPageViews.toLocaleString("nl-NL")}
                </td>
                {traffic.technical.viewsMetricAvailable ? (
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                    {(r.views ?? 0).toLocaleString("nl-NL")}
                  </td>
                ) : null}
                <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                  {formatRatio(r.new_user_share)}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                  {formatRatio(r.views_per_session)}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 sm:px-3">
                  {formatRatio(r.views_per_user)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-800">
        <p className="font-medium text-slate-900">Technische check</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-slate-700">
          <li>
            Aantal maanden in de tabel: <span className="font-mono">{traffic.technical.tableMonthCount}</span>
          </li>
          <li>
            Startmaand: <span className="font-mono">{traffic.technical.startMonth}</span> — Eindmaand:{" "}
            <span className="font-mono">{traffic.technical.endMonth}</span>
          </li>
          <li>
            Alle maanden in opeenvolgende reeks aanwezig:{" "}
            <span className="font-mono">{traffic.technical.sequenceComplete ? "ja" : "nee"}</span>
            {traffic.technical.missingRawYearMonths.length > 0 ? (
              <span className="ml-1 text-xs text-slate-600">
                (geen ruwe GA4-rij, wel 0-ingevuld: {traffic.technical.missingRawYearMonths.join(", ")})
              </span>
            ) : null}
          </li>
          <li>
            Kernmetrics totaal &gt; 0 over de periode — sessions:{" "}
            <span className="font-mono">{traffic.technical.coreMetricsWithData.sessions ? "ja" : "nee"}</span>
            , totalUsers:{" "}
            <span className="font-mono">{traffic.technical.coreMetricsWithData.totalUsers ? "ja" : "nee"}</span>
            , newUsers:{" "}
            <span className="font-mono">{traffic.technical.coreMetricsWithData.newUsers ? "ja" : "nee"}</span>
            , screenPageViews:{" "}
            <span className="font-mono">{traffic.technical.coreMetricsWithData.screenPageViews ? "ja" : "nee"}</span>
          </li>
          <li>
            newUsers: ten minste één maand &gt; 0:{" "}
            <span className="font-mono">{traffic.technical.newUsersAnyPositive ? "ja" : "nee"}</span> ; overal 0:{" "}
            <span className="font-mono">{traffic.technical.newUsersAllZero ? "ja" : "nee"}</span>
            {traffic.technical.newUsersExceedsTotalUsersAnyMonth ? (
              <span className="ml-1 text-xs text-amber-800">
                (Let op: ergens newUsers &gt; totalUsers — onverwacht in deze aggregatie.)
              </span>
            ) : null}
          </li>
        </ul>
      </div>
    </div>
  );
}

export function Stap4CombinedSection({
  combined,
  downloadCombinedCsv,
  copyCombinedCsv,
  copyDoneCombined,
  showHeading = true,
}: {
  combined: HistorischCombinedMonthlyReport;
  downloadCombinedCsv: () => void;
  copyCombinedCsv: () => void;
  copyDoneCombined: boolean;
  showHeading?: boolean;
}) {
  return (
    <div className="space-y-4 text-sm">
      {showHeading ? (
        <h2 className="text-base font-semibold text-slate-900">
          Stap 4 — Gecombineerde analyse (stap 2 + stap 3)
        </h2>
      ) : null}
      <p className="text-sm text-slate-600">
        Join op <code className="rounded bg-slate-100 px-1">yearMonth</code>. Indices: basis{" "}
        <span className="font-mono">{combined.indexBaseYearMonth}</span> = 100. Gegenereerd: {combined.generatedAt}
      </p>
      {combined.message && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {combined.message}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={downloadCombinedCsv}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Download CSV
        </button>
        <button
          type="button"
          onClick={() => void copyCombinedCsv()}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          {copyDoneCombined ? "Gekopieerd" : "Kopieer CSV"}
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[160rem] text-left text-[10px] leading-tight sm:min-w-[120rem] sm:text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {(
                [
                  "yearMonth",
                  "sessions",
                  "totalUsers",
                  "activeUsers",
                  "newUsers",
                  "screenPageViews",
                  "new_user_share",
                  "v/sess",
                  "v/user",
                  "pw_view",
                  "pw_abo",
                  "pw_login",
                  "nb",
                  "abo_r",
                  "login_r",
                  "nb/pw",
                  "pw_v/sess",
                  "pw_v/u",
                  "pw_v/nu",
                  "pabo/sess",
                  "pabo/nu",
                  "nb/sess",
                  "nb/nu",
                  "ix_sess",
                  "ix_users",
                  "ix_new",
                  "ix_spv",
                  "ix_pw",
                  "ix_pabo",
                  "ix_nb",
                ] as const
              ).map((h) => (
                <th
                  key={h}
                  className="max-w-[4.5rem] whitespace-normal px-1 py-1.5 text-right font-medium text-slate-800 first:text-left sm:px-2"
                  title={h}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {combined.rows.map((r) => (
              <tr key={r.yearMonth} className="border-b border-slate-100 last:border-0">
                <td className="whitespace-nowrap px-1 py-1 font-mono text-slate-800 sm:px-2">{r.yearMonth}</td>
                <td className="px-1 py-1 text-right tabular-nums text-slate-700 sm:px-2">
                  {r.sessions.toLocaleString("nl-NL")}
                </td>
                <td className="px-1 py-1 text-right tabular-nums text-slate-700 sm:px-2">
                  {r.totalUsers.toLocaleString("nl-NL")}
                </td>
                <td className="px-1 py-1 text-right tabular-nums text-slate-700 sm:px-2">
                  {r.activeUsers.toLocaleString("nl-NL")}
                </td>
                <td className="px-1 py-1 text-right tabular-nums text-slate-700 sm:px-2">
                  {r.newUsers.toLocaleString("nl-NL")}
                </td>
                <td className="px-1 py-1 text-right tabular-nums text-slate-700 sm:px-2">
                  {r.screenPageViews.toLocaleString("nl-NL")}
                </td>
                <td className="px-1 py-1 text-right tabular-nums text-slate-700 sm:px-2">
                  {formatRatio(r.new_user_share)}
                </td>
                <td className="px-1 py-1 text-right tabular-nums text-slate-700 sm:px-2">
                  {formatRatio(r.views_per_session)}
                </td>
                <td className="px-1 py-1 text-right tabular-nums text-slate-700 sm:px-2">
                  {formatRatio(r.views_per_user)}
                </td>
                <td className="px-1 py-1 text-right tabular-nums text-slate-700 sm:px-2">
                  {r.paywall_view.toLocaleString("nl-NL")}
                </td>
                <td className="px-1 py-1 text-right tabular-nums text-slate-700 sm:px-2">
                  {r.paywall_abonneren.toLocaleString("nl-NL")}
                </td>
                <td className="px-1 py-1 text-right tabular-nums text-slate-700 sm:px-2">
                  {r.paywall_inloggen.toLocaleString("nl-NL")}
                </td>
                <td className="px-1 py-1 text-right tabular-nums text-slate-700 sm:px-2">
                  {r.nieuwsbrief_inschrijving_artikelen.toLocaleString("nl-NL")}
                </td>
                <td className="px-1 py-1 text-right tabular-nums text-slate-700 sm:px-2">
                  {formatRatio(r.paywall_abonneer_ratio)}
                </td>
                <td className="px-1 py-1 text-right tabular-nums text-slate-700 sm:px-2">
                  {formatRatio(r.paywall_login_ratio)}
                </td>
                <td className="px-1 py-1 text-right tabular-nums text-slate-700 sm:px-2">
                  {formatRatio(r.nieuwsbrief_per_paywall_view)}
                </td>
                <td className="px-1 py-1 text-right tabular-nums text-slate-700 sm:px-2">
                  {formatRatio(r.paywall_views_per_session)}
                </td>
                <td className="px-1 py-1 text-right tabular-nums text-slate-700 sm:px-2">
                  {formatRatio(r.paywall_views_per_user)}
                </td>
                <td className="px-1 py-1 text-right tabular-nums text-slate-700 sm:px-2">
                  {formatRatio(r.paywall_views_per_new_user)}
                </td>
                <td className="px-1 py-1 text-right tabular-nums text-slate-700 sm:px-2">
                  {formatRatio(r.paywall_abonneren_per_session)}
                </td>
                <td className="px-1 py-1 text-right tabular-nums text-slate-700 sm:px-2">
                  {formatRatio(r.paywall_abonneren_per_new_user)}
                </td>
                <td className="px-1 py-1 text-right tabular-nums text-slate-700 sm:px-2">
                  {formatRatio(r.nieuwsbrief_per_session)}
                </td>
                <td className="px-1 py-1 text-right tabular-nums text-slate-700 sm:px-2">
                  {formatRatio(r.nieuwsbrief_per_new_user)}
                </td>
                <td className="px-1 py-1 text-right tabular-nums text-slate-700 sm:px-2">
                  {formatRatio(r.index_sessions)}
                </td>
                <td className="px-1 py-1 text-right tabular-nums text-slate-700 sm:px-2">
                  {formatRatio(r.index_totalUsers)}
                </td>
                <td className="px-1 py-1 text-right tabular-nums text-slate-700 sm:px-2">
                  {formatRatio(r.index_newUsers)}
                </td>
                <td className="px-1 py-1 text-right tabular-nums text-slate-700 sm:px-2">
                  {formatRatio(r.index_screenPageViews)}
                </td>
                <td className="px-1 py-1 text-right tabular-nums text-slate-700 sm:px-2">
                  {formatRatio(r.index_paywall_view)}
                </td>
                <td className="px-1 py-1 text-right tabular-nums text-slate-700 sm:px-2">
                  {formatRatio(r.index_paywall_abonneren)}
                </td>
                <td className="px-1 py-1 text-right tabular-nums text-slate-700 sm:px-2">
                  {formatRatio(r.index_nieuwsbrief_inschrijving_artikelen)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-slate-500 sm:text-xs">
        Kolomafkortingen in de UI; CSV gebruikt volledige veldnamen. Tooltips: hover op header.
      </p>
      <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-800">
        <p className="font-medium text-slate-900">Technische check</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-slate-700">
          <li>
            Aantal maanden in gecombineerde tabel:{" "}
            <span className="font-mono">{combined.technical.tableMonthCount}</span> (verwacht:{" "}
            <span className="font-mono">{combined.technical.expectedMonthCount}</span>)
          </li>
          <li>
            YearMonth-reeks stap 2 en stap 3 identiek:{" "}
            <span className="font-mono">{combined.technical.funnelAndTrafficYearMonthsMatch ? "ja" : "nee"}</span>{" "}
            (stap 2: <span className="font-mono">{combined.technical.funnelRowCount}</span> rijen, stap 3:{" "}
            <span className="font-mono">{combined.technical.trafficRowCount}</span> rijen)
          </li>
          <li>
            Maanden ontbrekend in stap 2 of stap 3 t.o.v. verwacht bereik:{" "}
            {combined.technical.missingMonthsVsExpected.length === 0 ? (
              <span className="font-mono">geen</span>
            ) : (
              <span className="font-mono">{combined.technical.missingMonthsVsExpected.join(", ")}</span>
            )}
          </li>
          <li>
            Maanden alleen in stap 2 (niet in stap 3):{" "}
            {combined.technical.monthsInStap2NotStap3.length === 0 ? (
              <span className="font-mono">geen</span>
            ) : (
              <span className="font-mono">{combined.technical.monthsInStap2NotStap3.join(", ")}</span>
            )}
          </li>
          <li>
            Maanden alleen in stap 3 (niet in stap 2):{" "}
            {combined.technical.monthsInStap3NotStap2.length === 0 ? (
              <span className="font-mono">geen</span>
            ) : (
              <span className="font-mono">{combined.technical.monthsInStap3NotStap2.join(", ")}</span>
            )}
          </li>
          <li>
            Maanden met traffic-signaal maar geen funnel-events:{" "}
            {combined.technical.monthsWithTrafficNoFunnel.length === 0 ? (
              <span className="font-mono">geen</span>
            ) : (
              <span className="font-mono">{combined.technical.monthsWithTrafficNoFunnel.join(", ")}</span>
            )}
          </li>
          <li>
            Maanden met funnel-events maar zonder traffic-signaal:{" "}
            {combined.technical.monthsWithFunnelNoTraffic.length === 0 ? (
              <span className="font-mono">geen</span>
            ) : (
              <span className="font-mono">{combined.technical.monthsWithFunnelNoTraffic.join(", ")}</span>
            )}
          </li>
          <li>
            Ratio/index-cellen: <span className="font-mono">{combined.technical.ratioNullCellCount}</span> null van{" "}
            <span className="font-mono">{combined.technical.ratioTotalCells}</span> (afgeleide ratio’s:{" "}
            <span className="font-mono">{combined.technical.derivedRatioNullCellCount}</span> null; indexen:{" "}
            <span className="font-mono">{combined.technical.indexNullCellCount}</span> null). Alle afgeleide
            ratio’s ingevuld:{" "}
            <span className="font-mono">{combined.technical.allDerivedRatiosComputed ? "ja" : "nee"}</span> ;
            alle indexen ingevuld:{" "}
            <span className="font-mono">{combined.technical.allIndexValuesComputed ? "ja" : "nee"}</span>.
          </li>
        </ul>
      </div>
    </div>
  );
}
