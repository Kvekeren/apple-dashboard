export function formatRatio(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("nl-NL", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  });
}

export function formatPct(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("nl-NL", { maximumFractionDigits: 2 }) + "%";
}

export function formatPer1k(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("nl-NL", { maximumFractionDigits: 4 });
}
