import { google } from "googleapis";

import { agendaPathKey } from "@/lib/agenda-url";
import { getDateRange } from "@/lib/search-console";
import { getTitleById, type SiteTitleId } from "@/lib/site-titles";

/**
 * Conversie per artikel (nabouw van de BigQuery-export "Conversies per pagina"),
 * maar dan volledig uit GA4: sessies, uitklikken, affiliate-klikken, conversies en omzet.
 * Native-/CPC-omzet en goedgekeurde sales staan niet in GA4 en ontbreken dus.
 */

type BrandEvents = {
  /** Events die als "uitklik" tellen (naar externe sites). */
  outbound: string[];
  /** Klikken op affiliate-links (WeCanTrack). Leeg = kolom niet van toepassing. */
  affiliateClicks: string[];
  /** Kolomlabel voor `purchaseRevenue`. */
  revenueLabel: string;
  /** Kolomlabel voor het aantal purchases. */
  conversionsLabel: string;
  /** GA4-dimensie op het uitklik-event die "native" markeert (BigSpark: uitklikken_type). */
  nativeTypeDimension?: string;
  /** Of: aparte events die native uitklikken zijn (iCreate: clickout_native). Tellen ook als uitklik. */
  nativeEvents?: string[];
  /** GA4-commissie wijkt af van de goedgekeurde netwerkcommissie (BigQuery-export). */
  revenueIsEstimate: boolean;
};

const BIGSPARK: BrandEvents = {
  outbound: ["uitklikken"],
  affiliateClicks: ["wct_click"],
  revenueLabel: "Affiliate-commissie (GA4)",
  conversionsLabel: "Affiliate-sales (GA4)",
  nativeTypeDimension: "customEvent:uitklikken_type",
  revenueIsEstimate: true,
};

export const CONVERSIE_BRAND_EVENTS: Record<SiteTitleId, BrandEvents> = {
  iphoned: BIGSPARK,
  iculture: BIGSPARK,
  androidplanet: BIGSPARK,
  androidworld: BIGSPARK,
  icreate: {
    outbound: [
      "clickout_affiliate",
      "clickout_affiliate_tekstlink",
      "clickout_prijsvergelijker",
      "clickout_mshop",
      "clickout_outbound",
      "clickout_native",
    ],
    nativeEvents: ["clickout_native"],
    affiliateClicks: [],
    revenueLabel: "Shop-omzet",
    conversionsLabel: "Shop-aankopen",
    revenueIsEstimate: false,
  },
};

export type ConversieArtikelRow = {
  path: string;
  url: string;
  pageType: string;
  pageviews: number;
  sessions: number;
  outboundClicks: number;
  /** Uitklikken met uitklikken_type = native (komt exact overeen met de BigQuery-export). */
  nativeClicks: number;
  affiliateClicks: number;
  conversions: number;
  /** purchaseRevenue (affiliate bij BigSpark-titels, shop bij iCreate) */
  revenue: number;
  /** totalAdRevenue (display-advertenties) */
  adRevenue: number;
};

export type ConversieArtikelenPayload = {
  brand: SiteTitleId;
  meta: {
    startDate: string;
    endDate: string;
    days: number;
    revenueLabel: string;
    conversionsLabel: string;
    hasAffiliateClicks: boolean;
    hasNativeClicks: boolean;
    revenueIsEstimate: boolean;
  };
  totals: Omit<ConversieArtikelRow, "path" | "url" | "pageType">;
  /** Omzet die GA4 niet aan een pagina kan koppelen (pagePath "(not set)"). */
  unattributed: { revenue: number; adRevenue: number; conversions: number };
  rows: ConversieArtikelRow[];
};

const TYPE_BY_SEGMENT: Record<string, string> = {
  nieuws: "Nieuws",
  news: "Nieuws",
  tips: "Tips",
  tip: "Tips",
  deals: "Deal",
  deal: "Deal",
  aanbiedingen: "Deal",
  koopadvies: "Koopadvies",
  "purchase-advice": "Koopadvies",
  review: "Review",
  reviews: "Review",
  achtergrond: "Achtergrond",
  apps: "Apps",
  academy: "Academy",
  hardware: "Hardware",
  software: "Software",
  gids: "Gids",
  video: "Video",
  videos: "Video",
};

/** Paginatype op basis van het eerste URL-segment (zoals "Type pagina" in de export). */
export function pageTypeForPath(path: string): string {
  const segs = path.toLowerCase().split("/").filter(Boolean);
  if (!segs.length) return "Home";
  const first = segs[0]!;
  if (TYPE_BY_SEGMENT[first]) return TYPE_BY_SEGMENT[first]!;
  // Productpagina's zoals /apple/iphone-18-pro/prijzen/ of /samsung/galaxy-s26/prijzen/
  if (segs.includes("prijzen") || segs.includes("prijs")) return "Prijzen";
  if (segs.length === 1) return "Overzicht";
  return "Overig";
}

const num = (v: string | null | undefined) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export async function buildConversieArtikelen(
  accessToken: string,
  brand: SiteTitleId,
  days: number
): Promise<ConversieArtikelenPayload> {
  const site = getTitleById(brand);
  if (!site?.ga4PropertyId) throw new Error(`Geen GA4-property voor ${brand}`);
  const cfg = CONVERSIE_BRAND_EVENTS[brand];
  const { startDate, endDate } = getDateRange(days);

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const ga = google.analyticsdata({ version: "v1beta", auth });
  const property = `properties/${site.ga4PropertyId}`;
  const dateRanges = [{ startDate, endDate }];
  const clickEvents = [...cfg.outbound, ...cfg.affiliateClicks];

  const nativeDim = cfg.nativeTypeDimension;
  const [pageReport, eventReport, nativeReport] = await Promise.all([
    ga.properties.runReport({
      property,
      requestBody: {
        dimensions: [{ name: "pagePath" }],
        metrics: [
          { name: "screenPageViews" },
          { name: "sessions" },
          { name: "ecommercePurchases" },
          { name: "purchaseRevenue" },
          { name: "totalAdRevenue" },
        ],
        dateRanges,
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: "25000",
      },
    }),
    clickEvents.length
      ? ga.properties.runReport({
          property,
          requestBody: {
            dimensions: [{ name: "pagePath" }, { name: "eventName" }],
            metrics: [{ name: "eventCount" }],
            dateRanges,
            dimensionFilter: {
              filter: { fieldName: "eventName", inListFilter: { values: clickEvents } },
            },
            limit: "25000",
          },
        })
      : Promise.resolve(null),
    nativeDim
      ? ga.properties
          .runReport({
            property,
            requestBody: {
              dimensions: [{ name: "pagePath" }],
              metrics: [{ name: "eventCount" }],
              dateRanges,
              dimensionFilter: {
                andGroup: {
                  expressions: [
                    { filter: { fieldName: "eventName", stringFilter: { matchType: "EXACT", value: "uitklikken" } } },
                    { filter: { fieldName: nativeDim, stringFilter: { matchType: "EXACT", value: "native" } } },
                  ],
                },
              },
              limit: "25000",
            },
          })
          .catch((err) => {
            // Property zonder deze custom dimensie: kolom dan weglaten.
            console.warn(`native-klikken niet beschikbaar voor ${brand}:`, String(err).slice(0, 160));
            return null;
          })
      : Promise.resolve(null),
  ]);

  const base = `https://${site.gscSiteUrl?.includes("://www.") ? "www." : ""}${site.primaryDomain}`;
  const byKey = new Map<string, ConversieArtikelRow>();
  const unattributed = { revenue: 0, adRevenue: 0, conversions: 0 };

  const rowFor = (rawPath: string): ConversieArtikelRow | null => {
    if (!rawPath || rawPath === "(not set)" || rawPath === "/(not-set)") return null;
    const key = agendaPathKey(rawPath);
    let row = byKey.get(key);
    if (!row) {
      const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
      row = {
        path,
        url: `${base}${path}`,
        pageType: pageTypeForPath(path),
        pageviews: 0,
        sessions: 0,
        outboundClicks: 0,
        nativeClicks: 0,
        affiliateClicks: 0,
        conversions: 0,
        revenue: 0,
        adRevenue: 0,
      };
      byKey.set(key, row);
    }
    return row;
  };

  for (const r of pageReport.data.rows ?? []) {
    const path = r.dimensionValues?.[0]?.value ?? "";
    const m = r.metricValues ?? [];
    const row = rowFor(path);
    if (!row) {
      unattributed.conversions += num(m[2]?.value);
      unattributed.revenue += num(m[3]?.value);
      unattributed.adRevenue += num(m[4]?.value);
      continue;
    }
    row.pageviews += num(m[0]?.value);
    row.sessions += num(m[1]?.value);
    row.conversions += num(m[2]?.value);
    row.revenue += num(m[3]?.value);
    row.adRevenue += num(m[4]?.value);
  }

  const outboundSet = new Set(cfg.outbound);
  const nativeEventSet = new Set(cfg.nativeEvents ?? []);
  for (const r of eventReport?.data.rows ?? []) {
    const path = r.dimensionValues?.[0]?.value ?? "";
    const eventName = r.dimensionValues?.[1]?.value ?? "";
    // Alleen pagina's die al in het paginarapport staan (geen losse, lege rijen).
    const key = agendaPathKey(path);
    const row = byKey.get(key);
    if (!row) continue;
    const count = num(r.metricValues?.[0]?.value);
    if (outboundSet.has(eventName)) row.outboundClicks += count;
    else row.affiliateClicks += count;
    if (nativeEventSet.has(eventName)) row.nativeClicks += count;
  }

  for (const r of nativeReport?.data.rows ?? []) {
    const row = byKey.get(agendaPathKey(r.dimensionValues?.[0]?.value ?? ""));
    if (row) row.nativeClicks += num(r.metricValues?.[0]?.value);
  }

  const rows = [...byKey.values()].filter((r) => r.pageviews > 0 || r.revenue > 0 || r.adRevenue > 0);
  const totals = rows.reduce(
    (t, r) => ({
      pageviews: t.pageviews + r.pageviews,
      sessions: t.sessions + r.sessions,
      outboundClicks: t.outboundClicks + r.outboundClicks,
      nativeClicks: t.nativeClicks + r.nativeClicks,
      affiliateClicks: t.affiliateClicks + r.affiliateClicks,
      conversions: t.conversions + r.conversions,
      revenue: t.revenue + r.revenue,
      adRevenue: t.adRevenue + r.adRevenue,
    }),
    {
      pageviews: 0,
      sessions: 0,
      outboundClicks: 0,
      nativeClicks: 0,
      affiliateClicks: 0,
      conversions: 0,
      revenue: 0,
      adRevenue: 0,
    }
  );

  return {
    brand,
    meta: {
      startDate,
      endDate,
      days,
      revenueLabel: cfg.revenueLabel,
      conversionsLabel: cfg.conversionsLabel,
      hasAffiliateClicks: cfg.affiliateClicks.length > 0,
      hasNativeClicks: nativeReport != null || nativeEventSet.size > 0,
      revenueIsEstimate: cfg.revenueIsEstimate,
    },
    totals,
    unattributed,
    rows,
  };
}
