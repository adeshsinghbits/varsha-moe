import { memo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { EmptyState } from "./common/States";
import { regimeColor } from "../api/normalize";

const tip = { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, color: "#fff", fontSize: 12 };

// data: [{ regime, value }]
function RegimeChart({ data = [], unit = "", label = "Value", signed = false, height = 280 }) {
  if (!data.length) return <EmptyState title="No regime data" className="h-[220px]" />;
  return (
    <div style={{ height }} className="w-full" role="img" aria-label={`${label} by regime`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 16 }}>
          <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} unit={unit} />
          <YAxis type="category" dataKey="regime" stroke="#94a3b8" fontSize={11} tickLine={false} width={130} />
          <Tooltip contentStyle={tip} cursor={{ fill: "#1e293b55" }} formatter={(v) => [`${signed && v > 0 ? "+" : ""}${Number(v).toFixed(2)}${unit}`, label]} />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} isAnimationActive={false}>
            {data.map((d) => <Cell key={d.regime} fill={regimeColor(d.regime)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export default memo(RegimeChart);
