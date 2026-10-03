import { memo } from "react";
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { EmptyState } from "./common/States";

const tip = { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, color: "#fff", fontSize: 12 };

// data: [{ label, raw, ai, observed? }] — nulls become gaps, never zeros
function RainfallChart({ data = [], height = 300, emptyMessage = "No rainfall records to plot." }) {
  if (!data.length) return <EmptyState title="Nothing to chart" message={emptyMessage} className="h-[260px]" />;
  const hasObserved = data.some((d) => d.observed != null);
  return (
    <div style={{ height }} className="w-full" role="img" aria-label="Raw NWP versus AI-corrected rainfall chart">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ left: -10, right: 8, top: 5 }}>
          <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
          <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} minTickGap={24} />
          <YAxis stroke="#64748b" fontSize={11} tickLine={false} unit=" mm" />
          <Tooltip contentStyle={tip} formatter={(v) => (v == null ? "—" : `${Number(v).toFixed(2)} mm`)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="raw" name="Raw NWP" stroke="#64748b" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="ai" name="AI corrected" stroke="#22d3ee" strokeWidth={2.5} dot={false} connectNulls={false} isAnimationActive={false} />
          {hasObserved && <Line type="monotone" dataKey="observed" name="Observed" stroke="#34d399" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls={false} isAnimationActive={false} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
export default memo(RainfallChart);
