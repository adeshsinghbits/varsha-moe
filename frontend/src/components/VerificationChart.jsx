import { memo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { EmptyState } from "./common/States";

const tip = { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, color: "#fff", fontSize: 12 };

// data: [{ name, raw, ai }]  (null values are skipped, never drawn as 0)
function VerificationChart({ data = [], unit = "", height = 280, label = "Raw NWP vs AI corrected" }) {
  const rows = data.filter((d) => d.raw != null || d.ai != null);
  if (!rows.length) return <EmptyState title="No metrics available" className="h-[220px]" />;
  return (
    <div style={{ height }} className="w-full" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ left: -10, right: 8 }}>
          <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
          <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} interval={0} />
          <YAxis stroke="#64748b" fontSize={11} tickLine={false} unit={unit} />
          <Tooltip contentStyle={tip} cursor={{ fill: "#1e293b55" }} formatter={(v) => (v == null ? "—" : Number(v).toFixed(3))} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="raw" name="Raw NWP" fill="#64748b" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="ai" name="AI corrected" fill="#22d3ee" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export default memo(VerificationChart);
