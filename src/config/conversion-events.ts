import type { SiteTitleId } from "@/lib/site-titles";

/**
 * Verhoog bij wijzigingen in events/funnels/KPI's zodat API-cache vervalt.
 * (Zie cache-sleutels in /api/conversions/*.)
 */
export const CONVERSION_CONFIG_VERSION = 7;

/** Filteropties in de UI — `all` toont alle geconfigureerde conversie-events. */
export type ConversionGroupFilterId =
  | "all"
  | "engagement"
  | "affiliate"
  | "advertenties"
  | "leads"
  | "paywall"
  | "search"
  | "intern"
  | "uitgaand";

export type ConversionEventGroupId =
  | "engagement"
  | "affiliate"
  | "advertenties"
  | "leads"
  | "paywall"
  | "search"
  | "intern"
  | "uitgaand";

export interface ConversionEvent {
  name: string;
  label: string;
  group: ConversionEventGroupId;
}

export interface ConversionFunnel {
  id: string;
  label: string;
  steps: string[];
}

export type ConversionKpiType =
  | "total_conversions"
  | "conversion_rate_session"
  | "affiliate_clicks"
  | "purchases"
  | "revenue"
  | "scroll_rate"
  | "internal_click_rate"
  | "outbound_click_rate"
  | "ad_ctr"
  | "leads"
  | "paywall_clicks"
  | "single_event"
  | "pageviews_per_session"
  | "avg_session_duration";

export type ConversionEngagementMetricKey =
  | "averageEngagementTime"
  | "screenPageViewsPerSession"
  | "engagementRate"
  | "averageSessionDuration"
  | "engagedSessions";

export interface ConversionKpiDefinition {
  id: string;
  label: string;
  /** Berekend uit events of basismetrics; zie conversion-metrics.ts */
  type: ConversionKpiType;
  /** Bij type `single_event` */
  eventName?: string;
  brands?: SiteTitleId[];
}

export interface ConversionEngagementMetricDefinition {
  id: string;
  label: string;
  metric: ConversionEngagementMetricKey;
  format: "count" | "percent" | "duration" | "decimal";
}

export interface BrandConversionConfig {
  brandId: SiteTitleId;
  label: string;
  events: ConversionEvent[];
  funnels: ConversionFunnel[];
  kpis: ConversionKpiDefinition[];
  /** Sessie-/engagementmetrics in de tabel (bovenaan groep Engagement) */
  engagementMetrics?: ConversionEngagementMetricDefinition[];
}

export const CONVERSION_GROUP_LABELS: Record<ConversionGroupFilterId, string> = {
  all: "Alle conversies",
  engagement: "Engagement",
  affiliate: "Affiliate",
  advertenties: "Advertenties",
  leads: "Leads / nieuwsbrief",
  paywall: "Paywall / abonnement",
  search: "Search",
  intern: "Interne clicks",
  uitgaand: "Uitgaande clicks",
};

/** Vaste volgorde voor tabel en sortering (zonder `all`). */
export const CONVERSION_EVENT_GROUP_ORDER: ConversionEventGroupId[] = [
  "engagement",
  "affiliate",
  "advertenties",
  "leads",
  "paywall",
  "search",
  "intern",
  "uitgaand",
];

const GROUP_ORDER_INDEX = new Map(
  CONVERSION_EVENT_GROUP_ORDER.map((id, i) => [id, i])
);

export function conversionEventGroupSortIndex(
  group: ConversionEventGroupId | "other"
): number {
  if (group === "other") return CONVERSION_EVENT_GROUP_ORDER.length;
  return GROUP_ORDER_INDEX.get(group) ?? CONVERSION_EVENT_GROUP_ORDER.length;
}

export function conversionEventGroupLabel(
  group: ConversionEventGroupId | "other"
): string {
  if (group === "other") return "Overig";
  return CONVERSION_GROUP_LABELS[group];
}

const ICREATE_EVENTS: ConversionEvent[] = [
  { name: "25% scroll", label: "25% scroll", group: "engagement" },
  { name: "50% scroll", label: "50% scroll", group: "engagement" },
  { name: "75% scroll", label: "75% scroll", group: "engagement" },
  { name: "90% scroll", label: "90% scroll", group: "engagement" },
  { name: "read_article_end", label: "Artikel uitgelezen", group: "engagement" },
  { name: "click_lees_ook", label: "Lees ook", group: "engagement" },
  { name: "clickout_affiliate", label: "Affiliate clickout", group: "affiliate" },
  { name: "clickout_affiliate_tekstlink", label: "Affiliate tekstlink", group: "affiliate" },
  { name: "clickout_prijsvergelijker", label: "Prijsvergelijker", group: "affiliate" },
  { name: "clickout_mshop", label: "Clickout magazineshop", group: "affiliate" },
  { name: "click_productblok", label: "Productblok click", group: "affiliate" },
  { name: "click_producttegel", label: "Producttegel click", group: "affiliate" },
  { name: "purchase", label: "Purchase", group: "affiliate" },
  { name: "nieuwsbrief_inschrijving", label: "Nieuwsbrief inschrijving", group: "leads" },
  { name: "nieuwsbrief_gb-blok", label: "Nieuwsbrief GB-blok", group: "leads" },
  { name: "nieuwsbrief_download", label: "Nieuwsbrief download", group: "leads" },
  { name: "optinmonster_conversion", label: "OptinMonster conversie", group: "leads" },
  { name: "paywall_view", label: "Paywall view", group: "paywall" },
  { name: "block_view_paywall", label: "Paywall blok view", group: "paywall" },
  { name: "paywall_click_inloggen", label: "Paywall inloggen", group: "paywall" },
  { name: "paywall_click_abonneren", label: "Paywall abonneren", group: "paywall" },
  { name: "click_abonneren", label: "Abonneren click", group: "paywall" },
  { name: "add_to_cart", label: "Add to cart", group: "paywall" },
  { name: "begin_checkout", label: "Begin checkout", group: "paywall" },
  { name: "search", label: "Search", group: "search" },
];

const IPHONED_EVENTS: ConversionEvent[] = [
  { name: "wct_click", label: "WCT click", group: "affiliate" },
  { name: "wct_conversion", label: "WCT conversie", group: "affiliate" },
  { name: "purchase", label: "Purchase", group: "affiliate" },
  { name: "uitklikken", label: "Uitklikken", group: "uitgaand" },
  { name: "doorklikken", label: "Doorklikken", group: "intern" },
  { name: "click", label: "Click", group: "intern" },
  { name: "filters", label: "Filters", group: "intern" },
  { name: "ad_impression", label: "Ad impressie", group: "advertenties" },
  { name: "ad_click", label: "Ad click", group: "advertenties" },
  { name: "scroll", label: "Scroll", group: "engagement" },
  { name: "user_engagement", label: "User engagement", group: "engagement" },
  { name: "view_search_results", label: "Zoekresultaten", group: "search" },
];

const ICULTURE_EVENTS: ConversionEvent[] = [
  { name: "wct_click", label: "WCT click", group: "affiliate" },
  { name: "wct_conversion", label: "WCT conversie", group: "affiliate" },
  { name: "purchase", label: "Purchase", group: "affiliate" },
  { name: "uitklikken", label: "Uitklikken", group: "uitgaand" },
  { name: "doorklikken", label: "Doorklikken", group: "intern" },
  { name: "click", label: "Click", group: "intern" },
  { name: "form_start", label: "Formulier start", group: "leads" },
  { name: "form_submit", label: "Formulier submit", group: "leads" },
  { name: "ad_impression", label: "Ad impressie", group: "advertenties" },
  { name: "ad_click", label: "Ad click", group: "advertenties" },
  { name: "scroll", label: "Scroll", group: "engagement" },
  { name: "user_engagement", label: "User engagement", group: "engagement" },
  { name: "view_search_results", label: "Zoekresultaten", group: "search" },
];

const SHARED_KPIS: ConversionKpiDefinition[] = [
  { id: "total_conversions", label: "Totaal conversies", type: "total_conversions" },
  { id: "conversion_rate", label: "Conversieratio", type: "conversion_rate_session" },
  { id: "affiliate_clicks", label: "Affiliate-clicks", type: "affiliate_clicks" },
  { id: "purchases", label: "Purchases", type: "purchases" },
  { id: "revenue", label: "Omzet", type: "revenue" },
  { id: "scroll_rate", label: "Scrollrate", type: "scroll_rate" },
  { id: "internal_click_rate", label: "Interne clickrate", type: "internal_click_rate" },
  { id: "outbound_click_rate", label: "Uitgaande clickrate", type: "outbound_click_rate" },
  { id: "ad_ctr", label: "Ad CTR", type: "ad_ctr" },
  { id: "leads", label: "Leads / nieuwsbrief", type: "leads" },
];

export const BRAND_CONVERSION_CONFIGS: BrandConversionConfig[] = [
  {
    brandId: "icreate",
    label: "iCreate",
    events: ICREATE_EVENTS,
    funnels: [
      {
        id: "leesfunnel",
        label: "Leesfunnel",
        steps: ["25% scroll", "50% scroll", "75% scroll", "90% scroll", "read_article_end"],
      },
      {
        id: "affiliate_shop",
        label: "Affiliate / shop",
        steps: [
          "page_view",
          "clickout_affiliate",
          "clickout_affiliate_tekstlink",
          "clickout_prijsvergelijker",
          "clickout_mshop",
          "purchase",
        ],
      },
      {
        id: "paywall",
        label: "Paywall / abonnement",
        steps: [
          "paywall_view",
          "block_view_paywall",
          "paywall_click_inloggen",
          "paywall_click_abonneren",
          "click_abonneren",
          "add_to_cart",
          "begin_checkout",
          "purchase",
        ],
      },
    ],
    kpis: [
      { id: "affiliate_clicks", label: "Affiliate-clicks", type: "affiliate_clicks" },
      {
        id: "mshop_clickout",
        label: "Clickout magazineshop",
        type: "single_event",
        eventName: "clickout_mshop",
      },
      {
        id: "newsletter_signup",
        label: "Nieuwsbrief inschrijving",
        type: "single_event",
        eventName: "nieuwsbrief_inschrijving",
      },
      { id: "pageviews_per_session", label: "Weergaven per sessie", type: "pageviews_per_session" },
      { id: "avg_session_duration", label: "Gemiddelde sessieduur", type: "avg_session_duration" },
    ],
    engagementMetrics: [
      {
        id: "average_engagement_time",
        label: "Gemiddelde tijd op pagina",
        metric: "averageEngagementTime",
        format: "duration",
      },
      {
        id: "pageviews_per_session",
        label: "Pageviews per sessie",
        metric: "screenPageViewsPerSession",
        format: "decimal",
      },
      {
        id: "engagement_rate",
        label: "Engagement rate",
        metric: "engagementRate",
        format: "percent",
      },
      {
        id: "avg_session_duration",
        label: "Gemiddelde sessieduur",
        metric: "averageSessionDuration",
        format: "duration",
      },
      {
        id: "engaged_sessions",
        label: "Betrokken sessies",
        metric: "engagedSessions",
        format: "count",
      },
    ],
  },
  {
    brandId: "iphoned",
    label: "iPhoned",
    events: IPHONED_EVENTS,
    funnels: [
      {
        id: "affiliate",
        label: "Affiliate",
        steps: ["page_view", "uitklikken", "wct_click", "wct_conversion", "purchase"],
      },
      {
        id: "advertenties",
        label: "Advertenties",
        steps: ["ad_impression", "ad_click"],
      },
      {
        id: "engagement",
        label: "Engagement / clicks",
        steps: ["page_view", "scroll", "doorklikken", "uitklikken"],
      },
    ],
    kpis: SHARED_KPIS,
  },
  {
    brandId: "iculture",
    label: "iCulture",
    events: ICULTURE_EVENTS,
    funnels: [
      {
        id: "affiliate",
        label: "Affiliate",
        steps: ["page_view", "uitklikken", "wct_click", "wct_conversion", "purchase"],
      },
      {
        id: "formulier",
        label: "Formulier",
        steps: ["form_start", "form_submit"],
      },
      {
        id: "advertenties",
        label: "Advertenties",
        steps: ["ad_impression", "ad_click"],
      },
    ],
    kpis: SHARED_KPIS,
  },
];

export function getEngagementMetricDef(
  brandId: SiteTitleId,
  metricId: string
): ConversionEngagementMetricDefinition | undefined {
  return getBrandConversionConfig(brandId).engagementMetrics?.find((m) => m.id === metricId);
}

export function getBrandConversionConfig(brandId: SiteTitleId): BrandConversionConfig {
  const cfg = BRAND_CONVERSION_CONFIGS.find((b) => b.brandId === brandId);
  if (!cfg) throw new Error(`Onbekend merk: ${brandId}`);
  return cfg;
}

export function eventNamesForBrand(brandId: SiteTitleId): string[] {
  const cfg = getBrandConversionConfig(brandId);
  const names = new Set(cfg.events.map((e) => e.name));
  for (const funnel of cfg.funnels) {
    for (const step of funnel.steps) names.add(step);
  }
  names.add("page_view");
  return [...names];
}

export function eventsForGroupFilter(
  brandId: SiteTitleId,
  groupFilter: ConversionGroupFilterId
): ConversionEvent[] {
  const cfg = getBrandConversionConfig(brandId);
  if (groupFilter === "all") return cfg.events;
  return cfg.events.filter((e) => e.group === groupFilter);
}

export function eventMetaForBrand(brandId: SiteTitleId): Map<string, ConversionEvent> {
  const cfg = getBrandConversionConfig(brandId);
  const map = new Map<string, ConversionEvent>();
  for (const e of cfg.events) map.set(e.name, e);
  return map;
}
