export interface NbArtikelTableARow {
  yearMonth: string;
  nieuwsbrief_inschrijving_artikelen: number;
  sessions: number;
  totalUsers: number;
  newUsers: number;
  screenPageViews: number;
  nieuwsbrief_per_session: number | null;
  nieuwsbrief_per_totalUser: number | null;
  nieuwsbrief_per_newUser: number | null;
  nieuwsbrief_per_1000_pageviews: number | null;
}

export interface NbArtikelTableBRow {
  yearMonth: string;
  deviceCategory: string;
  nieuwsbrief_inschrijving_artikelen: number;
  sessions: number;
  totalUsers: number;
  newUsers: number;
  screenPageViews: number;
  nieuwsbrief_per_session: number | null;
  nieuwsbrief_per_newUser: number | null;
  nieuwsbrief_per_1000_pageviews: number | null;
}

export interface NbArtikelTableCRow {
  yearMonth: string;
  sessionDefaultChannelGroup: string;
  nieuwsbrief_inschrijving_artikelen: number;
  sessions: number;
  totalUsers: number;
  newUsers: number;
  screenPageViews: number;
  nieuwsbrief_per_session: number | null;
  nieuwsbrief_per_newUser: number | null;
  nieuwsbrief_per_1000_pageviews: number | null;
}

export interface NbArtikelStap2ComparisonRow {
  yearMonth: string;
  stap2Nieuwsbrief: number;
  tableANieuwsbrief: number;
  diff: number;
  match: boolean;
}

export interface NbArtikelTechnical {
  /** `false` = eventCount en traffic apart opgehaald (aanbevolen i.v.m. interpretatie GA4). */
  eventCountAndTrafficSingleQuery: boolean;
  trafficMetricsAllZero: boolean;
  trafficCoreAnyNonZero: boolean;
  stap2Comparisons: NbArtikelStap2ComparisonRow[];
  stap2AllMonthsMatch: boolean;
  /** Vaste toelichting: wat meet dit event wel/niet. */
  measurementNote: string;
  /** Waarschuwing m.b.t. zichtbaarheid/klik/conversie zonder extra events. */
  blokAttributieWaarschuwing: string;
}

export interface HistorischNieuwsbriefArtikelReport {
  generatedAt: string;
  brand: string;
  propertyEnvKey: string;
  dateRange: { startDate: string; endDate: string };
  tableA: NbArtikelTableARow[];
  tableB: NbArtikelTableBRow[];
  tableC: NbArtikelTableCRow[];
  technical: NbArtikelTechnical;
  fatalError?: string;
  error?: string;
}
