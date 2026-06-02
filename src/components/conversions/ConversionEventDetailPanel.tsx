"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { slugFromUrl } from "@/lib/monitoring/shared";
import type { ConversionEventDetail } from "@/lib/conversion-types";

export function ConversionEventDetailPanel({
  detail,
  loading,
  onClose,
}: {
  detail: ConversionEventDetail | null;
  loading: boolean;
  onClose: () => void;
}) {
  if (!detail && !loading) return null;

  return (
    <section className="fnl-card p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">{detail?.eventLabel ?? "Event laden…"}</h3>
          {detail ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {detail.eventName} · groep: {detail.eventGroup}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Sluiten
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Detail laden…</p>
      ) : detail ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricBox label="Events" value={detail.eventCount.toLocaleString("nl-NL")} />
            <MetricBox label="Gebruikers" value={detail.totalUsers.toLocaleString("nl-NL")} />
            <MetricBox
              label="Events/gebruiker"
              value={
                detail.eventsPerUser != null
                  ? detail.eventsPerUser.toFixed(2).replace(".", ",")
                  : "—"
              }
            />
            <MetricBox
              label="Conversieratio"
              value={
                detail.conversionRate != null
                  ? `${detail.conversionRate.toFixed(2).replace(".", ",")}%`
                  : "—"
              }
            />
          </div>

          {detail.trend.length > 1 ? (
            <div>
              <h4 className="mb-2 text-sm font-medium">Trend</h4>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={detail.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#DCE7F0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="eventCount" stroke="#004077" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h4 className="mb-2 text-sm font-medium">Top pagina&apos;s</h4>
              {detail.topPages.length === 0 ? (
                <p className="text-sm text-muted-foreground">Geen paginadata.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pagina</TableHead>
                      <TableHead className="text-right">Events</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.topPages.map((p) => (
                      <TableRow key={p.url}>
                        <TableCell className="max-w-[200px] truncate text-xs">
                          {p.pageTitle !== "(not set)" ? p.pageTitle : slugFromUrl(p.url)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {p.eventCount.toLocaleString("nl-NL")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            <div>
              <h4 className="mb-2 text-sm font-medium">Top verkeersbronnen</h4>
              {detail.topSources.length === 0 ? (
                <p className="text-sm text-muted-foreground">Geen brongegevens.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bron</TableHead>
                      <TableHead className="text-right">Events</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.topSources.map((s) => (
                      <TableRow key={s.source}>
                        <TableCell className="max-w-[200px] truncate text-xs">{s.source}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {s.eventCount.toLocaleString("nl-NL")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>

          {detail.devices.length > 0 ? (
            <div>
              <h4 className="mb-2 text-sm font-medium">Device-verdeling</h4>
              <div className="flex flex-wrap gap-3">
                {detail.devices.map((d) => (
                  <div key={d.device} className="rounded-[4px] border border-border px-3 py-2">
                    <div className="text-xs text-muted-foreground">{d.device}</div>
                    <div className="text-sm font-semibold tabular-nums">
                      {d.share.toFixed(1).replace(".", ",")}%
                    </div>
                    <div className="text-[11px] tabular-nums text-muted-foreground">
                      {d.eventCount.toLocaleString("nl-NL")} events
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[4px] border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
