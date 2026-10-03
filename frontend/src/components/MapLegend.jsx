// IMD daily categories
export const RAIN_BINS = [
  { min: 204.5, color: "#7f1d1d", label: "≥ 204.5 mm extremely heavy" },
  { min: 115.6, color: "#dc2626", label: "115.6–204.4 very heavy" },
  { min: 64.5, color: "#f59e0b", label: "64.5–115.5 heavy" },
  { min: 15.6, color: "#22c55e", label: "15.6–64.4 moderate" },
  { min: 0, color: "#38bdf8", label: "< 15.6 mm" },
];

export const rainColor = (mm) => (RAIN_BINS.find((b) => mm !== null && mm >= b.min) ?? RAIN_BINS[RAIN_BINS.length - 1]).color;
export const rainRadius = (mm) => (mm === null ? 5 : Math.min(22, 5 + Math.sqrt(Math.max(mm, 0)) * 1.6));

export default function MapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-400" aria-label="Map legend">
      <span className="font-semibold uppercase tracking-wider text-slate-500">AI-corrected rainfall</span>
      {[...RAIN_BINS].reverse().map((b) => (
        <span key={b.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.color }} aria-hidden="true" />
          {b.label}
        </span>
      ))}
      <span className="text-slate-600">Marker size scales with rainfall</span>
    </div>
  );
}
