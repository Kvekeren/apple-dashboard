export interface HistorischTopArticlePivotRow {
  pagePath: string;
  pageTitle: string;
  paywall_view: number;
  paywall_abonneren: number;
  paywall_inloggen: number;
  nieuwsbrief_inschrijving_artikelen: number;
  paywall_abonneer_ratio: number | null;
  paywall_login_ratio: number | null;
  nieuwsbrief_per_paywall_view: number | null;
}

export interface HistorischTopArticleTechnical {
  monthLabel: string;
  startDate: string;
  endDate: string;
  /** `YYYY-MM` voor vergelijking met stap 2. */
  yearMonthStap2: string;
  totalPaywallViewInTable: number;
  totalPaywallAbonnerenInTable: number;
  monthTotalPaywallViewFromGa: number;
  monthTotalPaywallAbonnerenFromGa: number;
  stap2PaywallView: number | null;
  stap2PaywallAbonneren: number | null;
  stap2PaywallInloggen: number | null;
  stap2Nieuwsbrief: number | null;
  pctMonthPaywallViewTop25ByAbonnement: number | null;
  pctMonthPaywallAbonnerenTop25ByAbonnement: number | null;
  pctMonthPaywallViewTop25ByView: number | null;
  pctMonthPaywallAbonnerenTop25ByView: number | null;
  uniquePagePathsWithPaywallView: number;
  uniquePagePathsWithPaywallAbonneren: number;
}

export interface HistorischTopArticleMonthBundle {
  label: string;
  startDate: string;
  endDate: string;
  yearMonthDisplay: string;
  topByAbonnement: HistorischTopArticlePivotRow[];
  topByView: HistorischTopArticlePivotRow[];
  technical: HistorischTopArticleTechnical;
  error?: string;
}

export interface HistorischTopArticlesReport {
  generatedAt: string;
  brand: string;
  propertyEnvKey: string;
  january2024: HistorischTopArticleMonthBundle;
  june2024: HistorischTopArticleMonthBundle;
  fatalError?: string;
}
