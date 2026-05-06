import { google } from "googleapis";

const SOURCE_TO_PROPERTY: Record<string, string> = {
  "iCreate": process.env.GA4_PROPERTY_ICREATE ?? "",
  "Gardeners' World": process.env.GA4_PROPERTY_GARDENERS ?? "",
  "Historisch Nieuwsblad": process.env.GA4_PROPERTY_HN ?? "",
  "Auto Review": process.env.GA4_PROPERTY_AUTOREVIEW ?? "",
};

function getEventNames(): string[] {
  const raw =
    process.env.GA4_EVENTS ??
    "nieuwsbrief_inschrijving,nieuwsbrief_inschrijving_totaal,nieuwsbrief_conversie,newsletter_signup,generate_lead,sign_up";
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

const SOURCE_TO_NEWSLETTER_EVENT: Record<string, string> = {
  "iCreate": process.env.GA4_NEWSLETTER_EVENT_ICREATE ?? "nieuwsbrief_inschrijving",
  "Gardeners' World": process.env.GA4_NEWSLETTER_EVENT_GARDENERS ?? "nieuwsbrief_inschrijving",
  "Historisch Nieuwsblad": process.env.GA4_NEWSLETTER_EVENT_HN ?? "nieuwsbrief_inschrijving_totaal",
  "Auto Review": process.env.GA4_NEWSLETTER_EVENT_AUTOREVIEW ?? "nieuwsbrief_conversie",
};

function getNewsletterEventName(source: string): string {
  return SOURCE_TO_NEWSLETTER_EVENT[source] ?? process.env.GA4_NEWSLETTER_EVENT ?? "nieuwsbrief_inschrijving";
}

export interface GA4EventCount {
  source: string;
  eventName: string;
  count: number;
}

export async function fetchGA4Events(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<GA4EventCount[]> {
  const eventNames = getEventNames();
  if (eventNames.length === 0) return [];

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const analyticsdata = google.analyticsdata({ version: "v1beta", auth });

  const results: GA4EventCount[] = [];

  for (const [source, propertyId] of Object.entries(SOURCE_TO_PROPERTY)) {
    if (!propertyId) continue;

    try {
      const { data } = await analyticsdata.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dimensions: [{ name: "eventName" }],
          metrics: [{ name: "eventCount" }],
          dateRanges: [{ startDate, endDate }],
          dimensionFilter: {
            filter: {
              fieldName: "eventName",
              inListFilter: {
                values: eventNames,
              },
            },
          },
        },
      });

      if (data.rows) {
        for (const row of data.rows) {
          const eventName = row.dimensionValues?.[0]?.value ?? "";
          const count = parseInt(row.metricValues?.[0]?.value ?? "0", 10);
          if (eventName && count > 0) {
            results.push({ source, eventName, count });
          }
        }
      }
    } catch (err) {
      console.error(`GA4 fetch failed for ${source}:`, err);
    }
  }

  return results;
}

export interface GA4EventByPage {
  url: string;
  count: number;
  source: string;
}

export interface GA4PageviewsByPage {
  url: string;
  count: number;
  source: string;
}

export async function fetchGA4PageviewsByPage(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<GA4PageviewsByPage[]> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const analyticsdata = google.analyticsdata({ version: "v1beta", auth });

  const results: GA4PageviewsByPage[] = [];

  for (const [source, propertyId] of Object.entries(SOURCE_TO_PROPERTY)) {
    if (!propertyId) continue;

    try {
      const { data } = await analyticsdata.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dimensions: [{ name: "pageLocation" }],
          metrics: [{ name: "screenPageViews" }],
          dateRanges: [{ startDate, endDate }],
        },
      });

      if (data.rows) {
        for (const row of data.rows) {
          const url = row.dimensionValues?.[0]?.value ?? "";
          const count = parseInt(row.metricValues?.[0]?.value ?? "0", 10);
          if (url && count > 0) {
            results.push({ url, count, source });
          }
        }
      }
    } catch (err) {
      console.error(`GA4 pageviews failed for ${source}:`, err);
    }
  }

  return results;
}

export interface GA4ActiveUsers {
  source: string;
  activeUsers: number;
}

export interface GA4RealtimeTopPage {
  source: string;
  pageTitle: string;
  screenPageViews: number;
}

export async function fetchGA4RealtimeTopPages(
  accessToken: string,
  rowLimit = 3
): Promise<GA4RealtimeTopPage[]> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const analyticsdata = google.analyticsdata({ version: "v1beta", auth });

  const results: GA4RealtimeTopPage[] = [];

  for (const [source, propertyId] of Object.entries(SOURCE_TO_PROPERTY)) {
    if (!propertyId) continue;

    try {
      const { data } = await analyticsdata.properties.runRealtimeReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dimensions: [{ name: "unifiedScreenName" }],
          metrics: [{ name: "screenPageViews" }],
          orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
          limit: String(rowLimit),
        },
      });

      if (data.rows) {
        for (const row of data.rows) {
          const title = row.dimensionValues?.[0]?.value ?? "(zonder titel)";
          const views = parseInt(row.metricValues?.[0]?.value ?? "0", 10);
          if (views > 0) {
            results.push({ source, pageTitle: title, screenPageViews: views });
          }
        }
      }
    } catch (err) {
      console.error(`GA4 realtime top pages failed for ${source}:`, err);
    }
  }

  return results;
}

export async function fetchGA4ActiveUsers(accessToken: string): Promise<GA4ActiveUsers[]> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const analyticsdata = google.analyticsdata({ version: "v1beta", auth });

  const results: GA4ActiveUsers[] = [];

  for (const [source, propertyId] of Object.entries(SOURCE_TO_PROPERTY)) {
    if (!propertyId) continue;

    try {
      const { data } = await analyticsdata.properties.runRealtimeReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dimensions: [{ name: "country" }],
          metrics: [{ name: "activeUsers" }],
        },
      });

      // Sommeer activeUsers uit alle rijen (per land) voor totaal laatste 30 min
      let count = 0;
      if (data.rows) {
        for (const row of data.rows) {
          const v = row.metricValues?.[0]?.value;
          if (v != null) count += parseInt(String(v), 10);
        }
      }
      results.push({ source, activeUsers: count });
    } catch (err) {
      console.error(`GA4 realtime activeUsers failed for ${source}:`, err);
      results.push({ source, activeUsers: 0 });
    }
  }

  return results;
}

export async function fetchGA4EventsByPage(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<GA4EventByPage[]> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const analyticsdata = google.analyticsdata({ version: "v1beta", auth });

  const results: GA4EventByPage[] = [];

  for (const [source, propertyId] of Object.entries(SOURCE_TO_PROPERTY)) {
    if (!propertyId) continue;

    const eventName = getNewsletterEventName(source);

    try {
      const { data } = await analyticsdata.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dimensions: [{ name: "pageLocation" }],
          metrics: [{ name: "eventCount" }],
          dateRanges: [{ startDate, endDate }],
          dimensionFilter: {
            filter: {
              fieldName: "eventName",
              stringFilter: {
                value: eventName,
                matchType: "EXACT",
              },
            },
          },
        },
      });

      if (data.rows) {
        for (const row of data.rows) {
          const url = row.dimensionValues?.[0]?.value ?? "";
          const count = parseInt(row.metricValues?.[0]?.value ?? "0", 10);
          if (url && count > 0) {
            results.push({ url, count, source });
          }
        }
      }
    } catch (err) {
      console.error(`GA4 events-by-page failed for ${source}:`, err);
    }
  }

  return results;
}
