import { MdOutlineMenu } from "react-icons/md";
import { StatusBadge } from "./common/States";

function Navbar({ health, onMenu }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:h-20 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button onClick={onMenu} aria-label="Open navigation menu" className="rounded-lg p-2 text-xl text-slate-300 hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 lg:hidden"><MdOutlineMenu /></button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold sm:text-lg">VARSHA-MoE</p>
            <p className="hidden truncate text-xs text-slate-500 sm:block">Regime-aware AI post-processing of monsoon rainfall forecasts</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2" aria-live="polite">
        </div>
      </div>
    </header>
  );
}
export default Navbar;
