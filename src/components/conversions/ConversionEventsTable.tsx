"use client";

import {
  CONVERSION_GROUP_LABELS,
  conversionEventGroupLabel,
  conversionEventGroupSortIndex,
  getBrandConversionConfig,
  type ConversionEventGroupId,
  type ConversionGroupFilterId,
} from "@/config/conversion-events";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatConversionValue } from "@/lib/conversion-format";
import type { ConversionEventRow } from "@/lib/conversion-types";
import type { SiteTitleId } from "@/lib/site-titles";

function TrendCell({ dailyTrend }: { dailyTrend: number[] }) {
  if (dailyTrend.length < 2) return <span className="text-muted-foreground">—</span>;
  const max = Math.max(...dailyTrend, 1);
  const w = 48;
  const h = 16;
  const points = dailyTrend
    .map((v, i) => {
      const x = (i / (dailyTrend.length - 1)) * w;
      const y = h - (v / max) * h;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} aria-hidden>
      <polyline fill="none" stroke="#004077" strokeWidth="1.5" points={points} />
    </svg>
  );
}

function ChangeBadge({ changePercent }: { changePercent: number | null }) {
  if (changePercent == null) return <span className="text-muted-foreground">—</span>;
  const positive = changePercent > 0;
  const negative = changePercent < 0;
  return (
    <span
      className={`text-sm font-semibold tabular-nums ${
        positive
          ? "text-[var(--fnl-success)]"
          : negative
            ? "text-[var(--fnl-danger)]"
            : "text-muted-foreground"
      }`}
    >
      {positive ? "+" : ""}
      {changePercent}%
    </span>
  );
}

function groupEventsByEventGroup(events: ConversionEventRow[]): {
  group: ConversionEventGroupId | "other";
  events: ConversionEventRow[];
}[] {
  const sorted = [...events].sort((a, b) => {
    const groupDiff =
      conversionEventGroupSortIndex(a.eventGroup) -
      conversionEventGroupSortIndex(b.eventGroup);
    if (groupDiff !== 0) return groupDiff;
    if (a.rowKind === "metric" && b.rowKind !== "metric") return -1;
    if (a.rowKind !== "metric" && b.rowKind === "metric") return 1;
    return b.eventCount - a.eventCount;
  });

  const groups: { group: ConversionEventGroupId | "other"; events: ConversionEventRow[] }[] =
    [];
  for (const ev of sorted) {
    const last = groups[groups.length - 1];
    if (last?.group === ev.eventGroup) {
      last.events.push(ev);
    } else {
      groups.push({ group: ev.eventGroup, events: [ev] });
    }
  }
  return groups;
}

function EventRow({
  ev,
  selectedEvent,
  onSelectEvent,
  showGroupColumn,
  isFirstInGroup,
  groupRowSpan,
}: {
  ev: ConversionEventRow;
  selectedEvent: string | null;
  onSelectEvent: (eventName: string) => void;
  showGroupColumn: boolean;
  isFirstInGroup: boolean;
  groupRowSpan: number;
}) {
  const isMetric = ev.rowKind === "metric";
  const displayFormat = ev.displayFormat ?? "count";

  return (
    <TableRow
      className={`cursor-pointer ${selectedEvent === ev.eventName ? "bg-muted/50" : ""}`}
      onClick={() => {
        if (ev.clickable !== false) onSelectEvent(ev.eventName);
      }}
    >
      {showGroupColumn && isFirstInGroup && (
        <TableCell
          rowSpan={groupRowSpan}
          className="align-top border-r bg-muted/30 text-xs font-semibold text-foreground"
        >
          {conversionEventGroupLabel(ev.eventGroup)}
        </TableCell>
      )}
      <TableCell className="font-medium">{ev.eventLabel}</TableCell>
      <TableCell className="text-right tabular-nums">
        {displayFormat !== "count"
          ? formatConversionValue(ev.eventCount, displayFormat)
          : ev.eventCount.toLocaleString("nl-NL")}
      </TableCell>
      <TableCell className="text-right">
        <ChangeBadge changePercent={ev.changePercent} />
      </TableCell>
      <TableCell>
        <TrendCell dailyTrend={ev.dailyTrend} />
      </TableCell>
    </TableRow>
  );
}

export function ConversionEventsTable({
  events,
  selectedEvent,
  onSelectEvent,
  groupFilter,
}: {
  events: ConversionEventRow[];
  selectedEvent: string | null;
  onSelectEvent: (eventName: string) => void;
  groupFilter: ConversionGroupFilterId;
}) {
  if (events.length === 0) {
    return (
      <div className="fnl-card p-6 text-center text-sm text-muted-foreground">
        {groupFilter === "all"
          ? "Geen conversie-events gevonden in deze periode."
          : `Geen events in groep “${CONVERSION_GROUP_LABELS[groupFilter]}”.`}
      </div>
    );
  }

  const showGroupColumn = groupFilter === "all";
  const grouped = showGroupColumn ? groupEventsByEventGroup(events) : null;

  return (
    <div className="fnl-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            {showGroupColumn && <TableHead>Eventgroep</TableHead>}
            <TableHead>Eventnaam</TableHead>
            <TableHead className="text-right">Waarde</TableHead>
            <TableHead className="text-right">Verschil</TableHead>
            <TableHead>Trend</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {showGroupColumn && grouped
            ? grouped.map(({ events: groupEvents }) =>
                groupEvents.map((ev, idx) => (
                  <EventRow
                    key={ev.eventName}
                    ev={ev}
                    selectedEvent={selectedEvent}
                    onSelectEvent={onSelectEvent}
                    showGroupColumn
                    isFirstInGroup={idx === 0}
                    groupRowSpan={groupEvents.length}
                  />
                ))
              )
            : events.map((ev) => (
                <EventRow
                  key={ev.eventName}
                  ev={ev}
                  selectedEvent={selectedEvent}
                  onSelectEvent={onSelectEvent}
                  showGroupColumn={false}
                  isFirstInGroup={false}
                  groupRowSpan={1}
                />
              ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function eventOptionsForBrand(brandId: SiteTitleId): { name: string; label: string }[] {
  return getBrandConversionConfig(brandId).events.map((e) => ({
    name: e.name,
    label: e.label,
  }));
}

export function groupOptionsForBrand(): { id: ConversionGroupFilterId; label: string }[] {
  return (Object.keys(CONVERSION_GROUP_LABELS) as ConversionGroupFilterId[]).map((id) => ({
    id,
    label: CONVERSION_GROUP_LABELS[id],
  }));
}
