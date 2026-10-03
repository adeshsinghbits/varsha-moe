import { NavLink, Link } from "react-router-dom";
import { FaCloudRain, FaHistory } from "react-icons/fa";
import { LuLayoutDashboard } from "react-icons/lu";
import { IoBarChart } from "react-icons/io5";
import { FiActivity, FiHome } from "react-icons/fi";

const navigation = [
  { name: "Dashboard", path: "/dashboard", icon: LuLayoutDashboard },
  { name: "Run Forecast", path: "/forecast", icon: FaCloudRain },
  { name: "Regime Analysis", path: "/regime", icon: FiActivity },
  { name: "Verification", path: "/verification", icon: IoBarChart },
  { name: "Historical", path: "/historical", icon: FaHistory },
];

function NavContent({ onNavigate, health }) {
  const tone = health.status === "online" ? "text-emerald-400" : health.status === "degraded" ? "text-amber-400" : "text-red-400";
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-20 items-center border-b border-slate-800 px-6">
        <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10" aria-hidden="true"><FaCloudRain className="text-xl text-cyan-400" /></div>
        <div>
          <p className="text-lg font-bold tracking-tight">VARSHA<span className="text-cyan-400">-MoE</span></p>
          <p className="text-[10px] uppercase tracking-widest text-slate-500">Regime-aware AI</p>
        </div>
      </div>

      <nav aria-label="Primary" className="flex-1 space-y-1 p-4">
        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Workspace</p>
        {navigation.map(({ name, path, icon: Icon }) => (
          <NavLink key={path} to={path} onClick={onNavigate}
            className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 ${isActive ? "bg-cyan-500/10 text-cyan-300" : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"}`}>
            <Icon aria-hidden="true" /> {name}
          </NavLink>
        ))}
        <div className="my-4 border-t border-slate-800" />
      </nav>
    </div>
  );
}

export default function Sidebar({ open, onClose, health }) {
  return (
    <>
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 border-r border-slate-800 bg-slate-950 lg:block">
        <NavContent health={health} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button className="absolute inset-0 bg-black/60" aria-label="Close menu" onClick={onClose} />
          <aside className="absolute left-0 top-0 h-full w-72 max-w-[85vw] border-r border-slate-800 bg-slate-950">
            <NavContent health={health} onNavigate={onClose} />
          </aside>
        </div>
      )}
    </>
  );
}
