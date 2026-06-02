import {
  conversionEventGroupSortIndex,
  eventsForGroupFilter,
  getBrandConversionConfig,
  type ConversionEngagementMetricKey,
  type ConversionGroupFilterId,
} from "@/config/conversion-events";
import { conversionMetricRowName } from "@/lib/conversion-format";
import type { SiteTitleId } from "@/lib/site-titles";
import {
  AFFILIATE_EVENT_NAMES,
  conversionEventGroupForName,
  getEventCount,
  getEventRevenue,
  INTERNAL_CLICK_NAMES,
  LEAD_EVENT_NAMES,
  OUTBOUND_CLICK_NAMES,
  PAYWALL_CLICK_NAMES,
  SCROLL_EVENT_NAMES,
  sumEventCounts,
  type GA4BaseMetrics,
  type GA4BaseMetricsDailyRow,
  type GA4EventDailyRow,
  type GA4EventRow,
  type GA4PageEventRow,
} from "@/lib/ga4-conversions";
import type {
  ConversionEventRow,
  ConversionFunnelResult,
  ConversionMetricCard,
  ConversionMetricValue,
  ConversionSummaryPayload,
  TopConversionPageRow,
} from "@/lib/conversion-types";

function toMetricValue(current: number, previous: number): ConversionMetricValue {
  const change = current - previous;
  const changePercent = previous > 0 ? Math.round((change / previous) * 100) : null;
  return { current, previous, change, changePercent };
}

function ratioPercent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return (numerator / denominator) * 100;
}

function ratioPer1000(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return (numerator / denominator) * 1000;
}

function buildDailyTrend(
  dailyRows: GA4EventDailyRow[],
  eventName: string
): number[] {
  const byDate = new Map<string, number>();
  for (const row of dailyRows) {
    if (row.eventName !== eventName) continue;
    byDate.set(row.date, (byDate.get(row.date) ?? 0) + row.eventCount);
  }
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
}

/** Scroll-events als % van dagelijkse pageviews (voor trendsparkline). */
function buildScrollRateDailyTrend(
  dailyRows: GA4EventDailyRow[],
  eventName: string,
  baseDaily: GA4BaseMetricsDailyRow[]
): number[] {
  const pageviewsByDate = new Map(baseDaily.map((r) => [r.date, r.pageviews]));
  const eventsByDate = new Map<string, number>();
  for (const row of dailyRows) {
    if (row.eventName !== eventName) continue;
    eventsByDate.set(row.date, (eventsByDate.get(row.date) ?? 0) + row.eventCount);
  }
  const dates = [...new Set([...pageviewsByDate.keys(), ...eventsByDate.keys()])].sort();
  return dates.map((date) => {
    const pv = pageviewsByDate.get(date) ?? 0;
    const count = eventsByDate.get(date) ?? 0;
    return pv > 0 ? (count / pv) * 100 : 0;
  });
}

function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function buildSparkline(
  dailyRows: GA4EventDailyRow[],
  eventNames: string[]
): number[] {
  const set = new Set(eventNames);
  const byDate = new Map<string, number>();
  for (const row of dailyRows) {
    if (!set.has(row.eventName)) continue;
    byDate.set(row.date, (byDate.get(row.date) ?? 0) + row.eventCount);
  }
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
}

function baseMetricValue(
  metrics: GA4BaseMetrics,
  key: ConversionEngagementMetricKey
): number {
  return metrics[key];
}

export function engagementMetricValue(
  metrics: GA4BaseMetrics,
  key: ConversionEngagementMetricKey
): number {
  return baseMetricValue(metrics, key);
}

function buildBaseMetricDailyTrend(
  dailyRows: GA4BaseMetricsDailyRow[],
  key: ConversionEngagementMetricKey
): number[] {
  return dailyRows
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => baseMetricValue(row, key));
}

function metricRowChange(current: number, previous: number): {
  change: number;
  changePercent: number | null;
} {
  const change = current - previous;
  const changePercent = previous > 0 ? Math.round((change / previous) * 100) : null;
  return { change, changePercent };
}

function buildEngagementMetricRows(
  brandId: SiteTitleId,
  baseCurrent: GA4BaseMetrics,
  basePrevious: GA4BaseMetrics,
  baseDaily: GA4BaseMetricsDailyRow[]
): ConversionEventRow[] {
  const defs = getBrandConversionConfig(brandId).engagementMetrics ?? [];
  return defs.map((def) => {
    const current = baseMetricValue(baseCurrent, def.metric);
    const previous = baseMetricValue(basePrevious, def.metric);
    const { change, changePercent } = metricRowChange(current, previous);
    return {
      eventName: conversionMetricRowName(def.id),
      eventLabel: def.label,
      eventGroup: "engagement" as const,
      rowKind: "metric",
      displayFormat: def.format,
      clickable: true,
      eventCount: current,
      totalUsers: 0,
      eventsPerUser: null,
      conversionRate: null,
      revenue: 0,
      previous: { eventCount: previous, totalUsers: 0, revenue: 0 },
      change,
      changePercent,
      dailyTrend: buildBaseMetricDailyTrend(baseDaily, def.metric),
    };
  });
}

function mergeEngagementMetricRows(
  eventRows: ConversionEventRow[],
  metricRows: ConversionEventRow[],
  groupFilter: ConversionGroupFilterId
): ConversionEventRow[] {
  if (metricRows.length === 0) return eventRows;
  if (groupFilter === "engagement") return [...metricRows, ...eventRows];
  if (groupFilter !== "all") return eventRows;

  const firstEngagementIdx = eventRows.findIndex((r) => r.eventGroup === "engagement");
  if (firstEngagementIdx === -1) return [...eventRows, ...metricRows];
  return [
    ...eventRows.slice(0, firstEngagementIdx),
    ...metricRows,
    ...eventRows.slice(firstEngagementIdx),
  ];
}

export function buildConversionEventRows(
  brandId: SiteTitleId,
  currentRows: GA4EventRow[],
  previousRows: GA4EventRow[],
  dailyRows: GA4EventDailyRow[],
  sessions: number,
  groupFilter: ConversionGroupFilterId,
  baseCurrent?: GA4BaseMetrics,
  basePrevious?: GA4BaseMetrics,
  baseDaily?: GA4BaseMetricsDailyRow[]
): ConversionEventRow[] {
  const filteredEvents = eventsForGroupFilter(brandId, groupFilter);
  const meta = getBrandConversionConfig(brandId);
  const labelByName = new Map(meta.events.map((e) => [e.name, e.label]));
  const scrollEventNames = new Set(SCROLL_EVENT_NAMES[brandId]);
  const pageviews = baseCurrent?.pageviews ?? 0;
  const prevPageviews = basePrevious?.pageviews ?? 0;

  const eventRows = filteredEvents
    .map((ev) => {
      const cur = currentRows.find((r) => r.eventName === ev.name);
      const prev = previousRows.find((r) => r.eventName === ev.name);
      const rawCount = cur?.eventCount ?? 0;
      const totalUsers = cur?.totalUsers ?? 0;
      const rawPrevCount = prev?.eventCount ?? 0;

      const isScrollRate = scrollEventNames.has(ev.name);
      const displayCount = isScrollRate
        ? (ratioPercent(rawCount, pageviews) ?? 0)
        : rawCount;
      const displayPrevCount = isScrollRate
        ? (ratioPercent(rawPrevCount, prevPageviews) ?? 0)
        : rawPrevCount;
      const change = displayCount - displayPrevCount;
      const changePercent = isScrollRate
        ? percentChange(displayCount, displayPrevCount)
        : rawPrevCount > 0
          ? Math.round(((rawCount - rawPrevCount) / rawPrevCount) * 100)
          : null;

      return {
        eventName: ev.name,
        eventLabel: labelByName.get(ev.name) ?? ev.name,
        eventGroup: ev.group,
        displayFormat: isScrollRate ? ("percent" as const) : undefined,
        eventCount: displayCount,
        totalUsers,
        eventsPerUser: totalUsers > 0 ? rawCount / totalUsers : null,
        conversionRate: ratioPercent(rawCount, sessions),
        revenue: cur?.revenue ?? 0,
        previous: {
          eventCount: displayPrevCount,
          totalUsers: prev?.totalUsers ?? 0,
          revenue: prev?.revenue ?? 0,
        },
        change,
        changePercent,
        dailyTrend:
          isScrollRate && baseDaily && baseDaily.length > 0
            ? buildScrollRateDailyTrend(dailyRows, ev.name, baseDaily)
            : buildDailyTrend(dailyRows, ev.name),
      };
    })
    .sort((a, b) => {
      const groupDiff =
        conversionEventGroupSortIndex(a.eventGroup) -
        conversionEventGroupSortIndex(b.eventGroup);
      if (groupDiff !== 0) return groupDiff;
      return b.eventCount - a.eventCount;
    });

  if (!baseCurrent || !basePrevious) return eventRows;

  const metricRows = buildEngagementMetricRows(
    brandId,
    baseCurrent,
    basePrevious,
    baseDaily ?? []
  );
  return mergeEngagementMetricRows(eventRows, metricRows, groupFilter);
}

export function buildFunnelResults(
  brandId: SiteTitleId,
  currentRows: GA4EventRow[]
): ConversionFunnelResult[] {
  const cfg = getBrandConversionConfig(brandId);
  const labelByName = new Map(cfg.events.map((e) => [e.name, e.label]));
  labelByName.set("page_view", "Page view");
  labelByName.set("ad_impression", "Ad impressie");
  labelByName.set("ad_click", "Ad click");
  labelByName.set("form_start", "Formulier start");
  labelByName.set("form_submit", "Formulier submit");

  return cfg.funnels.map((funnel) => {
    const steps = funnel.steps.map((step, idx) => {
      const count = getEventCount(currentRows, step);
      const first = getEventCount(currentRows, funnel.steps[0]!);
      const prevStep = idx > 0 ? getEventCount(currentRows, funnel.steps[idx - 1]!) : null;
      return {
        eventName: step,
        label: labelByName.get(step) ?? step,
        count,
        rateFromPrevious:
          prevStep != null && prevStep > 0 ? (count / prevStep) * 100 : null,
        rateFromFirst: first > 0 ? (count / first) * 100 : null,
      };
    });
    return { id: funnel.id, label: funnel.label, steps };
  });
}

function kpiWithRatio(
  current: number,
  previous: number,
  ratio: number | null,
  ratioPrevious: number | null,
  ratioLabel: string,
  sparkline?: number[]
): ConversionMetricValue {
  return {
    ...toMetricValue(current, previous),
    ratio,
    ratioPrevious,
    ratioLabel,
    sparkline,
  };
}

export function buildKpiCards(
  brandId: SiteTitleId,
  currentRows: GA4EventRow[],
  previousRows: GA4EventRow[],
  dailyRows: GA4EventDailyRow[],
  baseCurrent: GA4BaseMetrics,
  basePrevious: GA4BaseMetrics
): ConversionMetricCard[] {
  const pageviews = baseCurrent.pageviews;
  const prevPageviews = basePrevious.pageviews;
  const sessions = baseCurrent.sessions;
  const prevSessions = basePrevious.sessions;
  const cfg = getBrandConversionConfig(brandId);
  const conversionEvents = cfg.events.map((e) => e.name);
  const totalConversions = sumEventCounts(currentRows, conversionEvents);
  const prevTotalConversions = sumEventCounts(previousRows, conversionEvents);

  const affiliateClicks = sumEventCounts(currentRows, AFFILIATE_EVENT_NAMES[brandId]);
  const prevAffiliateClicks = sumEventCounts(previousRows, AFFILIATE_EVENT_NAMES[brandId]);

  const purchases = getEventCount(currentRows, "purchase");
  const prevPurchases = getEventCount(previousRows, "purchase");

  const revenue = getEventRevenue(currentRows, "purchase");
  const prevRevenue = getEventRevenue(previousRows, "purchase");

  const scrollEvents = sumEventCounts(currentRows, SCROLL_EVENT_NAMES[brandId]);
  const prevScrollEvents = sumEventCounts(previousRows, SCROLL_EVENT_NAMES[brandId]);

  const internalClicks = sumEventCounts(currentRows, INTERNAL_CLICK_NAMES[brandId]);
  const prevInternalClicks = sumEventCounts(previousRows, INTERNAL_CLICK_NAMES[brandId]);

  const outboundClicks = sumEventCounts(currentRows, OUTBOUND_CLICK_NAMES[brandId]);
  const prevOutboundClicks = sumEventCounts(previousRows, OUTBOUND_CLICK_NAMES[brandId]);

  const adImpressions = getEventCount(currentRows, "ad_impression");
  const prevAdImpressions = getEventCount(previousRows, "ad_impression");
  const adClicks = getEventCount(currentRows, "ad_click");
  const prevAdClicks = getEventCount(previousRows, "ad_click");

  const leads = sumEventCounts(currentRows, LEAD_EVENT_NAMES[brandId]);
  const prevLeads = sumEventCounts(previousRows, LEAD_EVENT_NAMES[brandId]);

  const paywallClicks = sumEventCounts(currentRows, PAYWALL_CLICK_NAMES[brandId]);
  const prevPaywallClicks = sumEventCounts(previousRows, PAYWALL_CLICK_NAMES[brandId]);

  const cards: ConversionMetricCard[] = [];

  for (const kpi of cfg.kpis) {
    if (kpi.brands && !kpi.brands.includes(brandId)) continue;

    switch (kpi.type) {
      case "total_conversions":
        cards.push({
          id: kpi.id,
          label: kpi.label,
          format: "number",
          metric: kpiWithRatio(
            totalConversions,
            prevTotalConversions,
            ratioPer1000(totalConversions, pageviews),
            ratioPer1000(prevTotalConversions, prevPageviews),
            "per 1.000 pageviews",
            buildSparkline(dailyRows, conversionEvents)
          ),
        });
        break;
      case "conversion_rate_session":
        cards.push({
          id: kpi.id,
          label: kpi.label,
          format: "percent",
          metric: kpiWithRatio(
            totalConversions,
            prevTotalConversions,
            ratioPercent(totalConversions, sessions),
            ratioPercent(prevTotalConversions, prevSessions),
            "conversies / sessie"
          ),
        });
        break;
      case "affiliate_clicks":
        cards.push({
          id: kpi.id,
          label: kpi.label,
          format: "number",
          metric: kpiWithRatio(
            affiliateClicks,
            prevAffiliateClicks,
            ratioPercent(affiliateClicks, pageviews),
            ratioPercent(prevAffiliateClicks, prevPageviews),
            "affiliate-clicks / pageview",
            buildSparkline(dailyRows, AFFILIATE_EVENT_NAMES[brandId])
          ),
          unavailable: AFFILIATE_EVENT_NAMES[brandId].length === 0,
          unavailableReason: "Geen affiliate-events voor dit merk",
        });
        break;
      case "purchases":
        cards.push({
          id: kpi.id,
          label: kpi.label,
          format: "number",
          metric: kpiWithRatio(
            purchases,
            prevPurchases,
            ratioPercent(purchases, sessions),
            ratioPercent(prevPurchases, prevSessions),
            "purchases / sessie",
            buildSparkline(dailyRows, ["purchase"])
          ),
        });
        break;
      case "revenue":
        cards.push({
          id: kpi.id,
          label: kpi.label,
          format: "currency",
          metric: kpiWithRatio(
            revenue,
            prevRevenue,
            ratioPer1000(revenue, pageviews),
            ratioPer1000(prevRevenue, prevPageviews),
            "omzet per 1.000 pageviews"
          ),
          unavailable: revenue === 0 && prevRevenue === 0,
          unavailableReason: "Geen omzetdata in deze periode",
        });
        break;
      case "scroll_rate":
        cards.push({
          id: kpi.id,
          label: kpi.label,
          format: "percent",
          metric: kpiWithRatio(
            scrollEvents,
            prevScrollEvents,
            ratioPercent(scrollEvents, pageviews),
            ratioPercent(prevScrollEvents, prevPageviews),
            "scroll-events / pageview",
            buildSparkline(dailyRows, SCROLL_EVENT_NAMES[brandId])
          ),
          unavailable: SCROLL_EVENT_NAMES[brandId].length === 0,
        });
        break;
      case "internal_click_rate":
        cards.push({
          id: kpi.id,
          label: kpi.label,
          format: "percent",
          metric: kpiWithRatio(
            internalClicks,
            prevInternalClicks,
            ratioPercent(internalClicks, pageviews),
            ratioPercent(prevInternalClicks, prevPageviews),
            "interne clicks / pageview",
            buildSparkline(dailyRows, INTERNAL_CLICK_NAMES[brandId])
          ),
          unavailable: INTERNAL_CLICK_NAMES[brandId].length === 0,
          unavailableReason: "Geen interne click-events voor dit merk",
        });
        break;
      case "outbound_click_rate":
        cards.push({
          id: kpi.id,
          label: kpi.label,
          format: "percent",
          metric: kpiWithRatio(
            outboundClicks,
            prevOutboundClicks,
            ratioPercent(outboundClicks, pageviews),
            ratioPercent(prevOutboundClicks, prevPageviews),
            "uitgaande clicks / pageview",
            buildSparkline(dailyRows, OUTBOUND_CLICK_NAMES[brandId])
          ),
          unavailable: OUTBOUND_CLICK_NAMES[brandId].length === 0,
          unavailableReason: "Geen uitgaande click-events voor dit merk",
        });
        break;
      case "ad_ctr":
        cards.push({
          id: kpi.id,
          label: kpi.label,
          format: "percent",
          metric: kpiWithRatio(
            adClicks,
            prevAdClicks,
            ratioPercent(adClicks, adImpressions),
            ratioPercent(prevAdClicks, prevAdImpressions),
            "ad_click / ad_impression",
            buildSparkline(dailyRows, ["ad_click"])
          ),
          unavailable: adImpressions === 0 && prevAdImpressions === 0,
          unavailableReason: "Geen advertentie-events voor dit merk",
        });
        break;
      case "leads":
        cards.push({
          id: kpi.id,
          label: kpi.label,
          format: "number",
          metric: kpiWithRatio(
            leads,
            prevLeads,
            ratioPercent(leads, pageviews),
            ratioPercent(prevLeads, prevPageviews),
            "leads / pageview",
            buildSparkline(dailyRows, LEAD_EVENT_NAMES[brandId])
          ),
          unavailable: LEAD_EVENT_NAMES[brandId].length === 0,
          unavailableReason: "Geen lead-events voor dit merk",
        });
        break;
      case "paywall_clicks":
        cards.push({
          id: kpi.id,
          label: kpi.label,
          format: "number",
          metric: kpiWithRatio(
            paywallClicks,
            prevPaywallClicks,
            ratioPercent(paywallClicks, pageviews),
            ratioPercent(prevPaywallClicks, prevPageviews),
            "paywall-clicks / pageview",
            buildSparkline(dailyRows, PAYWALL_CLICK_NAMES[brandId])
          ),
          unavailable: PAYWALL_CLICK_NAMES[brandId].length === 0,
        });
        break;
      case "single_event": {
        const eventName = kpi.eventName;
        if (!eventName) break;
        const cur = getEventCount(currentRows, eventName);
        const prev = getEventCount(previousRows, eventName);
        cards.push({
          id: kpi.id,
          label: kpi.label,
          format: "number",
          metric: kpiWithRatio(
            cur,
            prev,
            ratioPercent(cur, sessions),
            ratioPercent(prev, prevSessions),
            "conversies / sessie",
            buildSparkline(dailyRows, [eventName])
          ),
        });
        break;
      }
      case "pageviews_per_session": {
        const cur = baseCurrent.screenPageViewsPerSession;
        const prev = basePrevious.screenPageViewsPerSession;
        cards.push({
          id: kpi.id,
          label: kpi.label,
          format: "decimal",
          metric: {
            ...toMetricValue(cur, prev),
            ratioLabel: "weergaven per sessie",
          },
        });
        break;
      }
      case "avg_session_duration":
        cards.push({
          id: kpi.id,
          label: kpi.label,
          format: "duration",
          metric: toMetricValue(
            baseCurrent.averageSessionDuration,
            basePrevious.averageSessionDuration
          ),
        });
        break;
    }
  }

  return cards;
}

export function buildTopConversionPages(
  brandId: SiteTitleId,
  pageEventRows: GA4PageEventRow[],
  prevPageEventRows: GA4PageEventRow[],
  pageviewRows: { pageLocation: string; pageTitle: string; pageviews: number }[],
  conversionEventNames: string[]
): TopConversionPageRow[] {
  const affiliateNames = new Set(AFFILIATE_EVENT_NAMES[brandId]);
  const conversionSet = new Set(conversionEventNames);
  const meta = getBrandConversionConfig(brandId);
  const labelByName = new Map(meta.events.map((e) => [e.name, e.label]));

  const pvByUrl = new Map<string, { pageTitle: string; pageviews: number }>();
  for (const p of pageviewRows) {
    pvByUrl.set(p.pageLocation, { pageTitle: p.pageTitle, pageviews: p.pageviews });
  }

  const byUrl = new Map<
    string,
    {
      pageTitle: string;
      conversions: number;
      affiliateClicks: number;
      revenue: number;
      topEvent: string;
      topEventCount: number;
    }
  >();

  for (const row of pageEventRows) {
    if (!conversionSet.has(row.eventName) && row.eventName !== "purchase") continue;
    const url = row.pageLocation;
    const existing = byUrl.get(url) ?? {
      pageTitle: row.pageTitle,
      conversions: 0,
      affiliateClicks: 0,
      revenue: 0,
      topEvent: row.eventName,
      topEventCount: 0,
    };
    existing.conversions += row.eventCount;
    if (affiliateNames.has(row.eventName)) existing.affiliateClicks += row.eventCount;
    if (row.eventName === "purchase") existing.revenue += row.revenue;
    if (row.eventCount > existing.topEventCount) {
      existing.topEvent = row.eventName;
      existing.topEventCount = row.eventCount;
    }
    byUrl.set(url, existing);
  }

  const prevByUrl = new Map<string, number>();
  for (const row of prevPageEventRows) {
    if (!conversionSet.has(row.eventName) && row.eventName !== "purchase") continue;
    prevByUrl.set(row.pageLocation, (prevByUrl.get(row.pageLocation) ?? 0) + row.eventCount);
  }

  return [...byUrl.entries()]
    .map(([url, data]) => {
      const pv = pvByUrl.get(url)?.pageviews ?? 0;
      const prevConv = prevByUrl.get(url) ?? 0;
      const changePercent =
        prevConv > 0
          ? Math.round(((data.conversions - prevConv) / prevConv) * 100)
          : null;
      return {
        url,
        pageTitle: data.pageTitle || pvByUrl.get(url)?.pageTitle || url,
        pageviews: pv,
        conversions: data.conversions,
        conversionRate: ratioPercent(data.conversions, pv),
        affiliateClicks: data.affiliateClicks,
        revenue: data.revenue,
        topEvent: data.topEvent,
        topEventLabel: labelByName.get(data.topEvent) ?? data.topEvent,
        previousConversions: prevConv,
        changePercent,
      };
    })
    .sort((a, b) => b.conversions - a.conversions)
    .slice(0, 25);
}

export function assembleConversionSummary(
  brandId: SiteTitleId,
  brandLabel: string,
  hasGa4Property: boolean,
  compareMode: "previous" | "yoy",
  groupFilter: ConversionGroupFilterId,
  periods: ConversionSummaryPayload["meta"]["periods"],
  currentRows: GA4EventRow[],
  previousRows: GA4EventRow[],
  dailyRows: GA4EventDailyRow[],
  baseCurrent: GA4BaseMetrics,
  basePrevious: GA4BaseMetrics,
  baseDaily: GA4BaseMetricsDailyRow[],
  pageEventRows: GA4PageEventRow[],
  prevPageEventRows: GA4PageEventRow[],
  pageviewRows: { pageLocation: string; pageTitle: string; pageviews: number }[]
): ConversionSummaryPayload {
  const conversionEventNames = getBrandConversionConfig(brandId).events.map((e) => e.name);

  return {
    meta: {
      brandId,
      brandLabel,
      hasGa4Property,
      compareMode,
      groupFilter,
      periods,
    },
    baseMetrics: {
      pageviews: toMetricValue(baseCurrent.pageviews, basePrevious.pageviews),
      sessions: toMetricValue(baseCurrent.sessions, basePrevious.sessions),
    },
    kpis: buildKpiCards(brandId, currentRows, previousRows, dailyRows, baseCurrent, basePrevious),
    events: buildConversionEventRows(
      brandId,
      currentRows,
      previousRows,
      dailyRows,
      baseCurrent.sessions,
      groupFilter,
      baseCurrent,
      basePrevious,
      baseDaily
    ),
    funnels: buildFunnelResults(brandId, currentRows),
    topPages: buildTopConversionPages(
      brandId,
      pageEventRows,
      prevPageEventRows,
      pageviewRows,
      conversionEventNames
    ),
  };
}

export { conversionEventGroupForName };
