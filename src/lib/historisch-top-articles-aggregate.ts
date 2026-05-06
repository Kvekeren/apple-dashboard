import type {
  HistorischTopArticleMonthBundle,
  HistorischTopArticlePivotRow,
  HistorischTopArticleTechnical,
} from "@/lib/historisch-top-articles-shared";

export const TOP_ARTICLE_EVENTS = [
  "paywall_view",
  "paywall_abonneren",
  "paywall_inloggen",
  "nieuwsbrief_inschrijving_artikelen",
] as const;

export type TopArticleEvent = (typeof TOP_ARTICLE_EVENTS)[number];

const NOT_SET_THRESHOLD_VIEW = 200;
const NOT_SET_THRESHOLD_ABO = 10;

function normalizePathForMatch(raw: string): string {
  const s = raw.trim();
  if (!s) return "/";
  if (s.startsWith("http://") || s.startsWith("https://")) {
    try {
      return new URL(s).pathname || "/";
    } catch {
      return s.split("?")[0] || "/";
    }
  }
  return s.split("?")[0] || "/";
}

function isNotSetToken(s: string): boolean {
  const t = s.trim().toLowerCase();
  return t === "" || t === "(not set)" || t === "not set";
}

/**
 * Homepage, shop, account, login en overzichtsachtige routes uitsluiten (heuristiek).
 */
export function shouldExcludeNonArticlePath(pathNorm: string): boolean {
  const p = pathNorm.toLowerCase();
  if (p === "/" || p === "") return true;

  const block = [
    /^\/login(\/|$)/i,
    /^\/inloggen(\/|$)/i,
    /^\/account(\/|$)/i,
    /^\/registratie(\/|$)/i,
    /^\/aanmelden(\/|$)/i,
    /^\/mijn(\/|$)/i,
    /^\/mijn-/i,
    /^\/winkel(\/|$)/i,
    /^\/shop(\/|$)/i,
    /^\/winkelwagen(\/|$)/i,
    /^\/afrekenen(\/|$)/i,
    /^\/zoek(\/|$)/i,
    /^\/search(\/|$)/i,
    /^\/tag(\/|$)/i,
    /^\/categorie(\/|$)/i,
    /^\/categorieen(\/|$)/i,
    /^\/archief(\/|$)/i,
    /^\/nieuwsbrief(\/|$)/i,
    /^\/newsletter(\/|$)/i,
    /^\/contact(\/|$)/i,
    /^\/over-ons(\/|$)/i,
    /^\/privacy(\/|$)/i,
    /^\/cookies?(\/|$)/i,
    /^\/cookie(\/|$)/i,
    /^\/404(\/|$)/i,
    /^\/abonnement(\/|$)/i,
    /^\/digitale-abonnementen(\/|$)/i,
    /^\/klantenservice(\/|$)/i,
    /^\/sitemap(\/|$)/i,
  ];
  return block.some((re) => re.test(p));
}

function includeAfterNotSetCheck(
  pathNorm: string,
  title: string,
  pv: number,
  pabo: number
): boolean {
  if (!isNotSetToken(pathNorm) && !isNotSetToken(title)) return true;
  if (!shouldExcludeNonArticlePath(pathNorm) && pv >= NOT_SET_THRESHOLD_VIEW) return true;
  if (!shouldExcludeNonArticlePath(pathNorm) && pabo >= NOT_SET_THRESHOLD_ABO) return true;
  return false;
}

export function aggregateAndPivotTopArticles(
  flatRows: Array<{
    pagePath: string;
    pageTitle: string;
    eventName: string;
    eventCount: number;
  }>
): Map<
  string,
  {
    pagePath: string;
    pageTitle: string;
    paywall_view: number;
    paywall_abonneren: number;
    paywall_inloggen: number;
    nieuwsbrief_inschrijving_artikelen: number;
  }
> {
  const byKey = new Map<
    string,
    {
      pagePath: string;
      pageTitle: string;
      paywall_view: number;
      paywall_abonneren: number;
      paywall_inloggen: number;
      nieuwsbrief_inschrijving_artikelen: number;
      titleScore: number;
    }
  >();

  for (const row of flatRows) {
    const pathNorm = normalizePathForMatch(row.pagePath);
    const title = row.pageTitle || "";
    const key = `${pathNorm}\t${title}`;
    const ev = row.eventName as TopArticleEvent;
    if (!TOP_ARTICLE_EVENTS.includes(ev as TopArticleEvent)) continue;
    let b = byKey.get(key);
    if (!b) {
      b = {
        pagePath: pathNorm,
        pageTitle: title,
        paywall_view: 0,
        paywall_abonneren: 0,
        paywall_inloggen: 0,
        nieuwsbrief_inschrijving_artikelen: 0,
        titleScore: 0,
      };
      byKey.set(key, b);
    }
    if (ev === "paywall_view") b.paywall_view += row.eventCount;
    else if (ev === "paywall_abonneren") b.paywall_abonneren += row.eventCount;
    else if (ev === "paywall_inloggen") b.paywall_inloggen += row.eventCount;
    else if (ev === "nieuwsbrief_inschrijving_artikelen") {
      b.nieuwsbrief_inschrijving_artikelen += row.eventCount;
    }
  }

  const merged = new Map<
    string,
    {
      pagePath: string;
      pageTitle: string;
      paywall_view: number;
      paywall_abonneren: number;
      paywall_inloggen: number;
      nieuwsbrief_inschrijving_artikelen: number;
    }
  >();

  for (const b of byKey.values()) {
    const k = b.pagePath;
    const ex = merged.get(k);
    if (!ex) {
      merged.set(k, {
        pagePath: b.pagePath,
        pageTitle: b.pageTitle,
        paywall_view: b.paywall_view,
        paywall_abonneren: b.paywall_abonneren,
        paywall_inloggen: b.paywall_inloggen,
        nieuwsbrief_inschrijving_artikelen: b.nieuwsbrief_inschrijving_artikelen,
      });
    } else {
      ex.paywall_view += b.paywall_view;
      ex.paywall_abonneren += b.paywall_abonneren;
      ex.paywall_inloggen += b.paywall_inloggen;
      ex.nieuwsbrief_inschrijving_artikelen += b.nieuwsbrief_inschrijving_artikelen;
      if (b.paywall_view > ex.paywall_view || b.pageTitle.length > ex.pageTitle.length) {
        ex.pageTitle = b.pageTitle;
      }
    }
  }

  return merged;
}

export function toPivotRows(map: ReturnType<typeof aggregateAndPivotTopArticles>): HistorischTopArticlePivotRow[] {
  const out: HistorischTopArticlePivotRow[] = [];
  for (const m of map.values()) {
    const pv = m.paywall_view;
    out.push({
      pagePath: m.pagePath,
      pageTitle: m.pageTitle,
      paywall_view: pv,
      paywall_abonneren: m.paywall_abonneren,
      paywall_inloggen: m.paywall_inloggen,
      nieuwsbrief_inschrijving_artikelen: m.nieuwsbrief_inschrijving_artikelen,
      paywall_abonneer_ratio: pv > 0 ? m.paywall_abonneren / pv : null,
      paywall_login_ratio: pv > 0 ? m.paywall_inloggen / pv : null,
      nieuwsbrief_per_paywall_view:
        pv > 0 ? m.nieuwsbrief_inschrijving_artikelen / pv : null,
    });
  }
  return out;
}

export function filterArticleLikeRows(rows: HistorischTopArticlePivotRow[]): HistorischTopArticlePivotRow[] {
  return rows.filter((r) => {
    if (shouldExcludeNonArticlePath(r.pagePath)) return false;
    if (
      !includeAfterNotSetCheck(r.pagePath, r.pageTitle, r.paywall_view, r.paywall_abonneren)
    ) {
      return false;
    }
    return true;
  });
}

export function sortAndTakeTop(
  rows: HistorischTopArticlePivotRow[],
  sort: "paywall_abonneren" | "paywall_view",
  limit = 25
): HistorischTopArticlePivotRow[] {
  const sorted = [...rows].sort((a, b) => {
    const pa = sort === "paywall_abonneren" ? a.paywall_abonneren : a.paywall_view;
    const pb = sort === "paywall_abonneren" ? b.paywall_abonneren : b.paywall_view;
    return pb - pa;
  });
  return sorted.slice(0, limit);
}

export function buildTopArticleTechnical(args: {
  monthLabel: string;
  startDate: string;
  endDate: string;
  yearMonthStap2: string;
  monthTotalsFromGa: Record<TopArticleEvent, number>;
  stap2MonthTotals: Record<TopArticleEvent, number> | null;
  filteredAllRows: HistorischTopArticlePivotRow[];
  topByAbonnement: HistorischTopArticlePivotRow[];
  topByView: HistorischTopArticlePivotRow[];
}): HistorischTopArticleTechnical {
  const sum = (rows: HistorischTopArticlePivotRow[], k: keyof HistorischTopArticlePivotRow) =>
    rows.reduce((s, r) => s + (typeof r[k] === "number" ? (r[k] as number) : 0), 0);

  const tablePaywallView = sum(args.filteredAllRows, "paywall_view");
  const tablePaywallAbon = sum(args.filteredAllRows, "paywall_abonneren");

  const uniqPv = args.filteredAllRows.filter((r) => r.paywall_view > 0).length;
  const uniqAbo = args.filteredAllRows.filter((r) => r.paywall_abonneren > 0).length;

  const monthPv = args.monthTotalsFromGa.paywall_view;
  const monthAbo = args.monthTotalsFromGa.paywall_abonneren;

  const top25AboPv = sum(args.topByAbonnement, "paywall_view");
  const top25AboAbo = sum(args.topByAbonnement, "paywall_abonneren");
  const top25ViewPv = sum(args.topByView, "paywall_view");
  const top25ViewAbo = sum(args.topByView, "paywall_abonneren");

  const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : null);

  return {
    monthLabel: args.monthLabel,
    startDate: args.startDate,
    endDate: args.endDate,
    yearMonthStap2: args.yearMonthStap2,
    totalPaywallViewInTable: tablePaywallView,
    totalPaywallAbonnerenInTable: tablePaywallAbon,
    monthTotalPaywallViewFromGa: monthPv,
    monthTotalPaywallAbonnerenFromGa: monthAbo,
    stap2PaywallView: args.stap2MonthTotals?.paywall_view ?? null,
    stap2PaywallAbonneren: args.stap2MonthTotals?.paywall_abonneren ?? null,
    stap2PaywallInloggen: args.stap2MonthTotals?.paywall_inloggen ?? null,
    stap2Nieuwsbrief: args.stap2MonthTotals?.nieuwsbrief_inschrijving_artikelen ?? null,
    pctMonthPaywallViewTop25ByAbonnement: pct(top25AboPv, monthPv),
    pctMonthPaywallAbonnerenTop25ByAbonnement: pct(top25AboAbo, monthAbo),
    pctMonthPaywallViewTop25ByView: pct(top25ViewPv, monthPv),
    pctMonthPaywallAbonnerenTop25ByView: pct(top25ViewAbo, monthAbo),
    uniquePagePathsWithPaywallView: uniqPv,
    uniquePagePathsWithPaywallAbonneren: uniqAbo,
  };
}
