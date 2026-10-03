import { useEffect, useState } from "react";
import { getProvenance } from "../api/api";
import { StatusBadge } from "./common/States";

// Shows what data the models were built on, read from the backend dataset metadata.
export default function ProvenanceBadge({ extra }) {
  const [prov, setProv] = useState(undefined); // undefined = loading, null = unavailable

  useEffect(() => {
    let alive = true;
    getProvenance().then((p) => alive && setProv(p)).catch(() => alive && setProv(null));
    return () => { alive = false; };
  }, []);

  if (prov === undefined) return null;
  if (prov === null) return <StatusBadge tone="slate">Data provenance unavailable{extra ? ` · ${extra}` : ""}</StatusBadge>;

  const test = prov.matchesConfig && prov.splits?.test?.length ? `held-out ${Math.min(...prov.splits.test)}–${Math.max(...prov.splits.test)}` : null;
  return (
    <span title={prov.note ?? undefined}>
      <StatusBadge tone={prov.isReal && prov.matchesConfig ? "cyan" : "amber"}>
        {prov.label}{test ? ` · ${test}` : ""}{extra ? ` · ${extra}` : ""}
      </StatusBadge>
    </span>
  );
}
