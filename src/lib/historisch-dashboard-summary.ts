import type { HistorischCombinedMonthlyReport } from "@/lib/historisch-combined-shared";
import type { HistorischNieuwsbriefArtikelReport } from "@/lib/historisch-nieuwsbrief-artikel-shared";

export type HistorischSummaryCardModel = {
  title: string;
  kicker: string;
  sentence: string;
};

function yearFromYm(ym: string): number {
  return parseInt(ym.slice(0, 4), 10);
}

function mean(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function compareSeriesPhrase(
  labelShort: string,
  vals2024: number[],
  valsLater: number[]
): { kicker: string; sentence: string } {
  const m24 = mean(vals2024);
  const mL = mean(valsLater);
  if (m24 == null || mL == null || (!vals2024.length && !valsLater.length)) {
    return { kicker: "—", sentence: "Er zijn onvoldoende maandwaarden om 2024 met latere jaren te vergelijken." };
  }
  const pct = m24 > 0 ? ((mL - m24) / m24) * 100 : null;
  const kicker =
    vals2024.length && valsLater.length
      ? `Gemiddelde per maand (2024): ${m24.toLocaleString("nl-NL", { maximumFractionDigits: 0 })} · (2025+): ${mL.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}`
      : `Gemiddelde per maand: ${m24.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}`;

  if (pct == null || !Number.isFinite(pct)) {
    return { kicker, sentence: `${labelShort} varieert per maand; een eenvoudige jaargemiddelde vergelijking is hier niet af te leiden.` };
  }
  if (Math.abs(pct) < 3) {
    return {
      kicker,
      sentence: `In het maandgemiddelde liggen de waarden in 2025 en later dicht bij die van 2024 voor ${labelShort}.`,
    };
  }
  if (pct < 0) {
    return {
      kicker,
      sentence: `In het maandgemiddelde zijn de waarden voor ${labelShort} in 2025 en later lager dan in 2024 (richting, niet oorzaak).`,
    };
  }
  return {
    kicker,
    sentence: `In het maandgemiddelde zijn de waarden voor ${labelShort} in 2025 en later hoger dan in 2024 (richting, niet oorzaak).`,
  };
}

function relativeChangeSentence(
  pctViews: number | null,
  pctAbo: number | null
): string {
  if (pctViews == null || pctAbo == null || !Number.isFinite(pctViews) || !Number.isFinite(pctAbo)) {
    return "Ontwikkeling van beide reeksen verschilt per maand; geen eenvoudige korte samenvatting mogelijk.";
  }
  const diff = pctAbo - pctViews;
  if (Math.abs(diff) < 2) {
    return "Paywallweergaven en abonneerkliks bewegen in de jaargemiddelden ongeveer in dezelfde richting.";
  }
  if (diff > 0) {
    return "In het jaargemiddelde lijkt de daling (of stijging) van abonneerkliks minder extreem dan die van paywallweergaven; exact gedrag verschilt per maand.";
  }
  return "In het jaargemiddelde bewegen abonneerkliks sterker dan paywallweergaven — exact gedrag verschilt per maand.";
}

export function buildHistorischDashboardSummary(
  combined: HistorischCombinedMonthlyReport | null,
  nbArtikel: HistorischNieuwsbriefArtikelReport | null
): HistorischSummaryCardModel[] {
  const rows = combined?.rows ?? [];
  const r2024 = rows.filter((r) => yearFromYm(r.yearMonth) === 2024);
  const rLater = rows.filter((r) => yearFromYm(r.yearMonth) >= 2025);

  const pwView24 = r2024.map((r) => r.paywall_view);
  const pwViewLater = rLater.map((r) => r.paywall_view);
  const pwAbo24 = r2024.map((r) => r.paywall_abonneren);
  const pwAboLater = rLater.map((r) => r.paywall_abonneren);
  const ratio24 = r2024.map((r) => r.paywall_abonneer_ratio).filter((x): x is number => x != null);
  const ratioLater = rLater.map((r) => r.paywall_abonneer_ratio).filter((x): x is number => x != null);

  const c1 = compareSeriesPhrase("paywallweergaven", pwView24, pwViewLater);
  const mV24 = mean(pwView24);
  const mVL = mean(pwViewLater);
  const mA24 = mean(pwAbo24);
  const mAL = mean(pwAboLater);
  const pctV = mV24 != null && mV24 > 0 && mVL != null ? ((mVL - mV24) / mV24) * 100 : null;
  const pctA = mA24 != null && mA24 > 0 && mAL != null ? ((mAL - mA24) / mA24) * 100 : null;

  const c2: HistorischSummaryCardModel = {
    title: "Abonneerkliks",
    kicker:
      pwAbo24.length && pwAboLater.length
        ? `Gemiddelde per maand paywall_abonneren (2024): ${mA24?.toLocaleString("nl-NL", { maximumFractionDigits: 0 })} · (2025+): ${mAL?.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}`
        : "Ontwikkeling volgt de maandreeks in de grafiek.",
    sentence: relativeChangeSentence(pctV, pctA),
  };

  const rMean24 = mean(ratio24);
  const rMeanL = mean(ratioLater);
  let c3sentence =
    ratio24.length && ratioLater.length
      ? "De paywall-abonneerratio verschilt per maand; zie de maandgrafiek voor het verloop."
      : "Onvoldoende ingevulde ratio’s om 2024 en latere jaren kort te vergelijken.";
  if (rMean24 != null && rMeanL != null && ratio24.length && ratioLater.length) {
    const rel = rMean24 !== 0 ? Math.abs((rMeanL - rMean24) / rMean24) : 0;
    if (rel < 0.03) {
      c3sentence =
        "De abonneerratio (abonneerkliks t.o.v. paywallweergaven) zit in het maandgemiddelde dicht bij 2024-niveau in latere jaren.";
    } else if (rMeanL > rMean24) {
      c3sentence =
        "In het maandgemiddelde ligt de abonneerratio uit de paywall vaker hoger in 2025 en later dan in 2024 (patroon in deze maandreeks).";
    } else {
      c3sentence =
        "In het maandgemiddelde ligt de abonneerratio uit de paywall vaker lager in 2025 en later dan in 2024 (patroon in deze maandreeks).";
    }
  }
  const c3fixed: HistorischSummaryCardModel = {
    title: "Paywallratio",
    kicker:
      rMean24 != null && rMeanL != null && ratio24.length && ratioLater.length
        ? `Gemiddelde paywall_abonneer_ratio per maand: 2024 ${rMean24.toLocaleString("nl-NL", { minimumFractionDigits: 4, maximumFractionDigits: 4 })} · 2025+ ${rMeanL.toLocaleString("nl-NL", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`
        : "Ratio per maand in de grafiek.",
    sentence: c3sentence,
  };

  const tableA =
    nbArtikel && !nbArtikel.fatalError && Array.isArray(nbArtikel.tableA) ? nbArtikel.tableA : [];
  const nb24 = tableA.filter((r) => yearFromYm(r.yearMonth) === 2024);
  const nbLater = tableA.filter((r) => yearFromYm(r.yearMonth) >= 2025);
  const nbVals24 = nb24.map((r) => r.nieuwsbrief_per_1000_pageviews).filter((x): x is number => x != null);
  const nbValsL = nbLater.map((r) => r.nieuwsbrief_per_1000_pageviews).filter((x): x is number => x != null);
  const c4 = compareSeriesPhrase("nieuwsbrief-events per 1.000 paginaweergaven", nbVals24, nbValsL);
  const c4fixed: HistorischSummaryCardModel = {
    title: "Nieuwsbrief artikelblok",
    kicker: c4.kicker,
    sentence:
      nbVals24.length && nbValsL.length
        ? c4.sentence
        : "Geen volledige maandreeks voor de nieuwsbriefmaatstaaf beschikbaar om kort te vergelijken.",
  };

  return [
    { title: "Paywall views", kicker: c1.kicker, sentence: c1.sentence },
    c2,
    c3fixed,
    c4fixed,
  ];
}
