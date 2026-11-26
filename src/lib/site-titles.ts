/**
 * Apple-mediabrands voor dit dashboard (één bron van waarheid).
 *
 * GA4-property-ID's en GSC-property-URL's komen uit env — exact zoals ze in GA/GSC staan.
 * Fallback voor GSC_SITE_* is een gangbare https://www…/ URL; kan afwijken bij sc-domain:… (zet dan env).
 */

export type SiteTitleId = "icreate" | "iphoned" | "iculture" | "androidplanet" | "androidworld";

export type SiteTitleLabel = "iCreate" | "iPhoned" | "iCulture" | "Android Planet" | "Androidworld";

const TITLE_ORDER: SiteTitleId[] = ["icreate", "iphoned", "iculture", "androidplanet", "androidworld"];

interface TitleDefinition {
  id: SiteTitleId;
  label: SiteTitleLabel;
  /** Hostnamen voor URL → titel (zonder protocol) */
  hostnames: readonly string[];
  ga4PropertyEnv: string;
  gscSiteUrlEnv: string;
  /** Primaire site voor o.a. favicon */
  primaryDomain: string;
  newsSitemapUrl: string;
  /** Badge / chart kleur (Tailwind-achtige combo) */
  badgeClass: string;
}

const TITLE_DEFS: readonly TitleDefinition[] = [
  {
    id: "icreate",
    label: "iCreate",
    hostnames: ["icreatemagazine.nl", "www.icreatemagazine.nl"],
    ga4PropertyEnv: "GA4_PROPERTY_ICREATE",
    gscSiteUrlEnv: "GSC_SITE_ICREATE",
    primaryDomain: "icreatemagazine.nl",
    newsSitemapUrl: "https://www.icreatemagazine.nl/news-sitemap.xml",
    badgeClass:
      "border border-[rgba(0,30,59,0.12)] bg-[#F0F4F8] text-[#004077]",
  },
  {
    id: "iphoned",
    label: "iPhoned",
    hostnames: ["iphoned.nl", "www.iphoned.nl"],
    ga4PropertyEnv: "GA4_PROPERTY_IPHONED",
    gscSiteUrlEnv: "GSC_SITE_IPHONED",
    primaryDomain: "iphoned.nl",
    newsSitemapUrl: "https://www.iphoned.nl/google-news-sitemap.xml",
    badgeClass:
      "border border-[rgba(0,30,59,0.12)] bg-[#E8EEF4] text-[#002F58]",
  },
  {
    id: "iculture",
    label: "iCulture",
    hostnames: ["iculture.nl", "www.iculture.nl"],
    ga4PropertyEnv: "GA4_PROPERTY_ICULTURE",
    gscSiteUrlEnv: "GSC_SITE_ICULTURE",
    primaryDomain: "iculture.nl",
    newsSitemapUrl: "https://www.iculture.nl/news-sitemap.xml",
    badgeClass:
      "border border-[rgba(0,30,59,0.12)] bg-[#DCE7F0] text-[#001E3B]",
  },
  {
    id: "androidplanet",
    label: "Android Planet",
    hostnames: ["androidplanet.nl", "www.androidplanet.nl"],
    ga4PropertyEnv: "GA4_PROPERTY_ANDROIDPLANET",
    gscSiteUrlEnv: "GSC_SITE_ANDROIDPLANET",
    primaryDomain: "androidplanet.nl",
    newsSitemapUrl: "https://www.androidplanet.nl/news-sitemap.xml",
    badgeClass:
      "border border-[rgba(0,30,59,0.12)] bg-[#E6F7EC] text-[#14663A]",
  },
  {
    id: "androidworld",
    label: "Androidworld",
    hostnames: ["androidworld.nl", "www.androidworld.nl"],
    ga4PropertyEnv: "GA4_PROPERTY_ANDROIDWORLD",
    gscSiteUrlEnv: "GSC_SITE_ANDROIDWORLD",
    primaryDomain: "androidworld.nl",
    newsSitemapUrl: "https://androidworld.nl/news-sitemap.xml",
    badgeClass:
      "border border-[rgba(0,30,59,0.12)] bg-[#EEF3E2] text-[#3F5A12]",
  },
] as const;

export interface ResolvedSiteTitle extends TitleDefinition {
  ga4PropertyId: string | undefined;
  /** Exact GSC property/siteUrl (inclusief slash of sc-domain:) */
  gscSiteUrl: string | undefined;
}

const DEFAULT_GSC_BY_ID: Record<SiteTitleId, string> = {
  icreate: "https://www.icreatemagazine.nl/",
  iphoned: "https://www.iphoned.nl/",
  iculture: "https://www.iculture.nl/",
  androidplanet: "https://www.androidplanet.nl/",
  androidworld: "https://androidworld.nl/",
};

export function resolveSiteTitles(): ResolvedSiteTitle[] {
  return TITLE_DEFS.map((def) => {
    const fromEnv = process.env[def.gscSiteUrlEnv]?.trim();
    return {
      ...def,
      ga4PropertyId: process.env[def.ga4PropertyEnv]?.trim() || undefined,
      gscSiteUrl: fromEnv || DEFAULT_GSC_BY_ID[def.id],
    };
  });
}

export function getTitleById(id: SiteTitleId): ResolvedSiteTitle | undefined {
  return resolveSiteTitles().find((t) => t.id === id);
}

export function listTitleIdsInOrder(): SiteTitleId[] {
  return [...TITLE_ORDER];
}

export function listTitleLabelsInOrder(): SiteTitleLabel[] {
  return TITLE_ORDER.map((id) => TITLE_DEFS.find((d) => d.id === id)!.label);
}

/** News-/Google News-sitemaps voor `/api/fetch-news`. */
export function listNewsSitemapFeeds(): { label: SiteTitleLabel; url: string }[] {
  return TITLE_DEFS.map((d) => ({ label: d.label, url: d.newsSitemapUrl }));
}

/** hostname → weergavenaam o.a. voor GSC-URL-rows */
export function hostnameToTitleLabel(hostname: string): SiteTitleLabel | "Overig" {
  const h = hostname.toLowerCase().replace(/^www\./, "");
  for (const def of TITLE_DEFS) {
    for (const cand of def.hostnames) {
      if (cand.replace(/^www\./, "").toLowerCase() === h) return def.label;
    }
  }
  return "Overig";
}

export function titleLabelFromPageUrl(url: string): SiteTitleLabel | "Overig" {
  try {
    return hostnameToTitleLabel(new URL(url).hostname);
  } catch {
    return "Overig";
  }
}

export function titleFromPageUrl(url: string): ResolvedSiteTitle | undefined {
  const label = titleLabelFromPageUrl(url);
  if (label === "Overig") return undefined;
  return resolveSiteTitles().find((t) => t.label === label);
}

export function badgeClassForLabel(label: string): string {
  const def = TITLE_DEFS.find((d) => d.label === label);
  return (
    def?.badgeClass ??
    "border border-[rgba(0,30,59,0.12)] bg-[#F7F9FB] text-[#5C6B7C]"
  );
}

/** UI-tabs: Alle + vaste titelvolgorde (client-safe). */
export const APPLE_TITLE_TABS: readonly { id: "all" | SiteTitleId; label: string }[] = [
  { id: "all", label: "Alle titels" },
  ...TITLE_ORDER.map((id) => ({
    id,
    label: TITLE_DEFS.find((d) => d.id === id)!.label,
  })),
] as const;

export function gscSiteUrlToLabel(siteUrl: string): SiteTitleLabel | undefined {
  const normalized = siteUrl.trim();
  for (const t of resolveSiteTitles()) {
    if (t.gscSiteUrl?.trim() === normalized) return t.label;
  }
  try {
    const host = new URL(normalized.startsWith("http") ? normalized : `https://${normalized}`).hostname;
    const lbl = hostnameToTitleLabel(host);
    return lbl === "Overig" ? undefined : lbl;
  } catch {
    return undefined;
  }
}
