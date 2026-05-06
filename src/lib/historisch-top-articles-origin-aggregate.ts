import type {
  OriginAnalysisARow,
  OriginAnalysisBRow,
  OriginChannelSummaryRow,
  OriginMonthTechnical,
} from "@/lib/historisch-top-articles-origin-shared";

export interface FlatChannelRow {
  pagePath: string;
  pageTitle: string;
  sessionDefaultChannelGroup: string;
  eventName: string;
  eventCount: number;
}

export interface FlatSourceMediumRow {
  pagePath: string;
  pageTitle: string;
  sessionSourceMedium: string;
  eventName: string;
  eventCount: number;
}

function triKey(a: string, b: string, c: string): string {
  return JSON.stringify([a, b, c]);
}

function pivotChannelFlat(
  flat: FlatChannelRow[],
  maand: string
): OriginAnalysisARow[] {
  const m = new Map<string, { pv: number; abo: number }>();
  for (const r of flat) {
    const k = triKey(r.pagePath, r.pageTitle, r.sessionDefaultChannelGroup);
    let b = m.get(k);
    if (!b) {
      b = { pv: 0, abo: 0 };
      m.set(k, b);
    }
    if (r.eventName === "paywall_view") b.pv += r.eventCount;
    else if (r.eventName === "paywall_abonneren") b.abo += r.eventCount;
  }
  const out: OriginAnalysisARow[] = [];
  for (const [k, b] of m) {
    const [pagePath, pageTitle, sessionDefaultChannelGroup] = JSON.parse(k) as [
      string,
      string,
      string,
    ];
    const pv = b.pv;
    out.push({
      maand,
      pagePath,
      pageTitle,
      sessionDefaultChannelGroup,
      paywall_view: pv,
      paywall_abonneren: b.abo,
      paywall_abonneer_ratio: pv > 0 ? b.abo / pv : null,
    });
  }
  return out;
}

function pivotSourceFlat(
  flat: FlatSourceMediumRow[],
  maand: string
): OriginAnalysisBRow[] {
  const m = new Map<string, { pv: number; abo: number }>();
  for (const r of flat) {
    const k = triKey(r.pagePath, r.pageTitle, r.sessionSourceMedium);
    let b = m.get(k);
    if (!b) {
      b = { pv: 0, abo: 0 };
      m.set(k, b);
    }
    if (r.eventName === "paywall_view") b.pv += r.eventCount;
    else if (r.eventName === "paywall_abonneren") b.abo += r.eventCount;
  }
  const out: OriginAnalysisBRow[] = [];
  for (const [k, b] of m) {
    const [pagePath, pageTitle, sessionSourceMedium] = JSON.parse(k) as [
      string,
      string,
      string,
    ];
    const pv = b.pv;
    out.push({
      maand,
      pagePath,
      pageTitle,
      sessionSourceMedium,
      paywall_view: pv,
      paywall_abonneren: b.abo,
      paywall_abonneer_ratio: pv > 0 ? b.abo / pv : null,
    });
  }
  return out;
}

function sortAnalysisA(rows: OriginAnalysisARow[]): OriginAnalysisARow[] {
  const byArt = new Map<string, { totalAbo: number; totalPv: number; rows: OriginAnalysisARow[] }>();
  for (const r of rows) {
    const ak = JSON.stringify([r.pagePath, r.pageTitle]);
    let g = byArt.get(ak);
    if (!g) {
      g = { totalAbo: 0, totalPv: 0, rows: [] };
      byArt.set(ak, g);
    }
    g.totalAbo += r.paywall_abonneren;
    g.totalPv += r.paywall_view;
    g.rows.push(r);
  }
  const ordered = [...byArt.values()].sort(
    (a, b) => b.totalAbo - a.totalAbo || b.totalPv - a.totalPv
  );
  const out: OriginAnalysisARow[] = [];
  for (const g of ordered) {
    g.rows.sort(
      (a, b) =>
        b.paywall_abonneren - a.paywall_abonneren || b.paywall_view - a.paywall_view
    );
    out.push(...g.rows);
  }
  return out;
}

function sortAnalysisB(rows: OriginAnalysisBRow[]): OriginAnalysisBRow[] {
  const byArt = new Map<string, { totalAbo: number; totalPv: number; rows: OriginAnalysisBRow[] }>();
  for (const r of rows) {
    const ak = JSON.stringify([r.pagePath, r.pageTitle]);
    let g = byArt.get(ak);
    if (!g) {
      g = { totalAbo: 0, totalPv: 0, rows: [] };
      byArt.set(ak, g);
    }
    g.totalAbo += r.paywall_abonneren;
    g.totalPv += r.paywall_view;
    g.rows.push(r);
  }
  const ordered = [...byArt.values()].sort(
    (a, b) => b.totalAbo - a.totalAbo || b.totalPv - a.totalPv
  );
  const out: OriginAnalysisBRow[] = [];
  for (const g of ordered) {
    g.rows.sort(
      (a, b) =>
        b.paywall_abonneren - a.paywall_abonneren || b.paywall_view - a.paywall_view
    );
    out.push(...g.rows);
  }
  return out;
}

function buildSummary(
  analysisA: OriginAnalysisARow[],
  maand: string
): OriginChannelSummaryRow[] {
  const byCh = new Map<string, { pv: number; abo: number }>();
  for (const r of analysisA) {
    const k = r.sessionDefaultChannelGroup;
    let b = byCh.get(k);
    if (!b) {
      b = { pv: 0, abo: 0 };
      byCh.set(k, b);
    }
    b.pv += r.paywall_view;
    b.abo += r.paywall_abonneren;
  }
  const totalPv = [...byCh.values()].reduce((s, b) => s + b.pv, 0);
  const totalAbo = [...byCh.values()].reduce((s, b) => s + b.abo, 0);
  const rows: OriginChannelSummaryRow[] = [];
  for (const [sessionDefaultChannelGroup, b] of byCh) {
    const pv = b.pv;
    rows.push({
      maand,
      sessionDefaultChannelGroup,
      paywall_view: pv,
      paywall_abonneren: b.abo,
      aandeel_paywall_view_binnen_top25:
        totalPv > 0 ? (pv / totalPv) * 100 : null,
      aandeel_paywall_abonneren_binnen_top25:
        totalAbo > 0 ? (b.abo / totalAbo) * 100 : null,
      paywall_abonneer_ratio: pv > 0 ? b.abo / pv : null,
    });
  }
  rows.sort((a, b) => b.paywall_abonneren - a.paywall_abonneren);
  return rows;
}

function sumTotalsA(rows: OriginAnalysisARow[]): {
  pv: number;
  abo: number;
} {
  return rows.reduce(
    (s, r) => ({
      pv: s.pv + r.paywall_view,
      abo: s.abo + r.paywall_abonneren,
    }),
    { pv: 0, abo: 0 }
  );
}

function sumTotalsB(rows: OriginAnalysisBRow[]): {
  pv: number;
  abo: number;
} {
  return rows.reduce(
    (s, r) => ({
      pv: s.pv + r.paywall_view,
      abo: s.abo + r.paywall_abonneren,
    }),
    { pv: 0, abo: 0 }
  );
}

function countArticlesWithData(
  topPaths: string[],
  analysisA: OriginAnalysisARow[]
): { withData: number; withoutData: number } {
  const byPath = new Map<string, number>();
  for (const p of topPaths) {
    byPath.set(p, 0);
  }
  for (const r of analysisA) {
    if (!byPath.has(r.pagePath)) continue;
    byPath.set(
      r.pagePath,
      (byPath.get(r.pagePath) ?? 0) + r.paywall_view + r.paywall_abonneren
    );
  }
  let withData = 0;
  for (const p of topPaths) {
    if ((byPath.get(p) ?? 0) > 0) withData++;
  }
  return { withData, withoutData: topPaths.length - withData };
}

export function buildOriginMonthFromGaRows(args: {
  label: string;
  yearMonth: string;
  startDate: string;
  endDate: string;
  topPaths: string[];
  stap5Top25PaywallView: number;
  stap5Top25PaywallAbonneren: number;
  flatA: FlatChannelRow[];
  flatB: FlatSourceMediumRow[];
}): {
  summary: OriginChannelSummaryRow[];
  analysisA: OriginAnalysisARow[];
  analysisB: OriginAnalysisBRow[];
  technical: OriginMonthTechnical;
} {
  const pivA = pivotChannelFlat(args.flatA, args.yearMonth);
  const pivB = pivotSourceFlat(args.flatB, args.yearMonth);
  const analysisA = sortAnalysisA(pivA);
  const analysisB = sortAnalysisB(pivB);
  const summary = buildSummary(analysisA, args.yearMonth);
  const tA = sumTotalsA(analysisA);
  const tB = sumTotalsB(analysisB);
  const { withData, withoutData } = countArticlesWithData(args.topPaths, analysisA);

  const technical: OriginMonthTechnical = {
    stap5Top25PaywallView: args.stap5Top25PaywallView,
    stap5Top25PaywallAbonneren: args.stap5Top25PaywallAbonneren,
    analysisAPaywallView: tA.pv,
    analysisAPaywallAbonneren: tA.abo,
    analysisBPaywallView: tB.pv,
    analysisBPaywallAbonneren: tB.abo,
    diffPaywallViewA: tA.pv - args.stap5Top25PaywallView,
    diffPaywallAbonnerenA: tA.abo - args.stap5Top25PaywallAbonneren,
    topArticlesWithChannelData: withData,
    topArticlesWithoutChannelData: withoutData,
  };

  return { summary, analysisA, analysisB, technical };
}
