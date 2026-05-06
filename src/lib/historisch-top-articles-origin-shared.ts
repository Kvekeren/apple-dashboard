export interface OriginChannelSummaryRow {
  maand: string;
  sessionDefaultChannelGroup: string;
  paywall_view: number;
  paywall_abonneren: number;
  /** Percentage van totaal paywall_view in deze samenvatting (top 25 samen). */
  aandeel_paywall_view_binnen_top25: number | null;
  /** Percentage van totaal paywall_abonneren in deze samenvatting. */
  aandeel_paywall_abonneren_binnen_top25: number | null;
  paywall_abonneer_ratio: number | null;
}

export interface OriginAnalysisARow {
  maand: string;
  pagePath: string;
  pageTitle: string;
  sessionDefaultChannelGroup: string;
  paywall_view: number;
  paywall_abonneren: number;
  paywall_abonneer_ratio: number | null;
}

export interface OriginAnalysisBRow {
  maand: string;
  pagePath: string;
  pageTitle: string;
  sessionSourceMedium: string;
  paywall_view: number;
  paywall_abonneren: number;
  paywall_abonneer_ratio: number | null;
}

export interface OriginMonthTechnical {
  /** Som paywall_view over de top 25-rijen uit stap 5 (paywall_abonneren-sort). */
  stap5Top25PaywallView: number;
  stap5Top25PaywallAbonneren: number;
  /** Totalen uit analyse A (kanaal × artikel × event). */
  analysisAPaywallView: number;
  analysisAPaywallAbonneren: number;
  /** Totalen uit analyse B (bron/medium × artikel × event); sanity-check t.o.v. A. */
  analysisBPaywallView: number;
  analysisBPaywallAbonneren: number;
  diffPaywallViewA: number;
  diffPaywallAbonnerenA: number;
  topArticlesWithChannelData: number;
  topArticlesWithoutChannelData: number;
}

export interface OriginMonthBundle {
  label: string;
  yearMonth: string;
  startDate: string;
  endDate: string;
  summary: OriginChannelSummaryRow[];
  analysisA: OriginAnalysisARow[];
  analysisB: OriginAnalysisBRow[];
  technical: OriginMonthTechnical;
  error?: string;
}

export interface HistorischTopArticlesOriginReport {
  generatedAt: string;
  brand: string;
  propertyEnvKey: string;
  fatalError?: string;
  january2024: OriginMonthBundle;
  june2024: OriginMonthBundle;
}
