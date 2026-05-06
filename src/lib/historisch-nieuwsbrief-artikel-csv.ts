import type {
  HistorischNieuwsbriefArtikelReport,
  NbArtikelTableARow,
  NbArtikelTableBRow,
  NbArtikelTableCRow,
  NbArtikelTechnical,
  NbArtikelStap2ComparisonRow,
} from "@/lib/historisch-nieuwsbrief-artikel-shared";

function esc(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const HEAD_A = [
  "yearMonth",
  "nieuwsbrief_inschrijving_artikelen",
  "sessions",
  "totalUsers",
  "newUsers",
  "screenPageViews",
  "nieuwsbrief_per_session",
  "nieuwsbrief_per_totalUser",
  "nieuwsbrief_per_newUser",
  "nieuwsbrief_per_1000_pageviews",
] as const;

const HEAD_B = [
  "yearMonth",
  "deviceCategory",
  "nieuwsbrief_inschrijving_artikelen",
  "sessions",
  "totalUsers",
  "newUsers",
  "screenPageViews",
  "nieuwsbrief_per_session",
  "nieuwsbrief_per_newUser",
  "nieuwsbrief_per_1000_pageviews",
] as const;

const HEAD_C = [
  "yearMonth",
  "sessionDefaultChannelGroup",
  "nieuwsbrief_inschrijving_artikelen",
  "sessions",
  "totalUsers",
  "newUsers",
  "screenPageViews",
  "nieuwsbrief_per_session",
  "nieuwsbrief_per_newUser",
  "nieuwsbrief_per_1000_pageviews",
] as const;

function rowA(r: NbArtikelTableARow): string {
  return [
    r.yearMonth,
    r.nieuwsbrief_inschrijving_artikelen,
    r.sessions,
    r.totalUsers,
    r.newUsers,
    r.screenPageViews,
    r.nieuwsbrief_per_session,
    r.nieuwsbrief_per_totalUser,
    r.nieuwsbrief_per_newUser,
    r.nieuwsbrief_per_1000_pageviews,
  ]
    .map(esc)
    .join(",");
}

function rowB(r: NbArtikelTableBRow): string {
  return [
    r.yearMonth,
    r.deviceCategory,
    r.nieuwsbrief_inschrijving_artikelen,
    r.sessions,
    r.totalUsers,
    r.newUsers,
    r.screenPageViews,
    r.nieuwsbrief_per_session,
    r.nieuwsbrief_per_newUser,
    r.nieuwsbrief_per_1000_pageviews,
  ]
    .map(esc)
    .join(",");
}

function rowC(r: NbArtikelTableCRow): string {
  return [
    r.yearMonth,
    r.sessionDefaultChannelGroup,
    r.nieuwsbrief_inschrijving_artikelen,
    r.sessions,
    r.totalUsers,
    r.newUsers,
    r.screenPageViews,
    r.nieuwsbrief_per_session,
    r.nieuwsbrief_per_newUser,
    r.nieuwsbrief_per_1000_pageviews,
  ]
    .map(esc)
    .join(",");
}

export function nbArtikelTableAToCsv(rows: NbArtikelTableARow[]): string {
  return ["# Tabel A — maandelijks", HEAD_A.join(","), ...rows.map(rowA)].join("\n");
}

export function nbArtikelTableBToCsv(rows: NbArtikelTableBRow[]): string {
  return ["# Tabel B — device per maand", HEAD_B.join(","), ...rows.map(rowB)].join("\n");
}

export function nbArtikelTableCToCsv(rows: NbArtikelTableCRow[]): string {
  return ["# Tabel C — kanaal per maand", HEAD_C.join(","), ...rows.map(rowC)].join("\n");
}

export function nbArtikelFullReportToCsv(report: HistorischNieuwsbriefArtikelReport): string {
  return [
    `# Historisch NB — nieuwsbrief artikelblokken ${report.dateRange.startDate} t/m ${report.dateRange.endDate}`,
    "",
    nbArtikelTableAToCsv(report.tableA),
    "",
    nbArtikelTableBToCsv(report.tableB),
    "",
    nbArtikelTableCToCsv(report.tableC),
  ].join("\n");
}

export function buildStap2Comparisons(
  tableA: NbArtikelTableARow[],
  stap2ByMonth: Map<string, number>
): NbArtikelStap2ComparisonRow[] {
  return tableA.map((r) => {
    const stap2 = stap2ByMonth.get(r.yearMonth) ?? 0;
    const table = r.nieuwsbrief_inschrijving_artikelen;
    const diff = table - stap2;
    return {
      yearMonth: r.yearMonth,
      stap2Nieuwsbrief: stap2,
      tableANieuwsbrief: table,
      diff,
      match: stap2 === table,
    };
  });
}

export function buildNbArtikelTechnical(
  tableA: NbArtikelTableARow[],
  stap2ByMonth: Map<string, number>
): NbArtikelTechnical {
  const stap2Comparisons = buildStap2Comparisons(tableA, stap2ByMonth);
  const stap2AllMonthsMatch = stap2Comparisons.every((c) => c.match);
  const trafficMetricsAllZero =
    tableA.length > 0 &&
    tableA.every(
      (r) =>
        r.sessions === 0 &&
        r.totalUsers === 0 &&
        r.newUsers === 0 &&
        r.screenPageViews === 0
    );
  const trafficCoreAnyNonZero = tableA.some(
    (r) => r.sessions > 0 || r.screenPageViews > 0 || r.totalUsers > 0
  );

  return {
    eventCountAndTrafficSingleQuery: false,
    trafficMetricsAllZero,
    trafficCoreAnyNonZero,
    stap2Comparisons,
    stap2AllMonthsMatch,
    measurementNote:
      "Deze analyse telt het GA4-event `nieuwsbrief_inschrijving_artikelen`. Dat is niet per se hetzelfde als een voltooide backend-inschrijving (validatie, double opt-in, enz.), tenzij jullie tagging dat 1:1 zo hebben gedefinieerd.",
    blokAttributieWaarschuwing:
      "Zonder aparte view- en click-events (of vergelijkbare meetpunten) specifiek voor het nieuwsbriefblok in artikelen kan met deze export niet worden vastgesteld of een laag volume komt door lage zichtbaarheid, lage klik, of lage conversie op het inschrijfformulier.",
  };
}
