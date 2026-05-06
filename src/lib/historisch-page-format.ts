export function formatRatio(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("nl-NL", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  });
}

/** Verhouding 0–1 (bijv. paywall_abonneer_ratio) als percentage, nl-NL, standaard 2 decimalen. */
export function formatRatioAsPct(v: number | null, fractionDigits = 2): string {
  if (v == null) return "—";
  return (
    (v * 100).toLocaleString("nl-NL", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }) + "%"
  );
}

export function formatPct(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("nl-NL", { maximumFractionDigits: 2 }) + "%";
}

export function formatPer1k(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("nl-NL", { maximumFractionDigits: 4 });
}
