import { FiAlertTriangle, FiInbox, FiLoader } from "react-icons/fi";

export function LoadingState({ message = "Loading…", className = "" }) {
  return (
    <div role="status" aria-live="polite" className={`flex items-center justify-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-8 text-sm text-slate-400 ${className}`}>
      <FiLoader className="animate-spin text-cyan-400" aria-hidden="true" />
      {message}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", message, onRetry, className = "" }) {
  return (
    <div role="alert" className={`rounded-xl border border-red-500/25 bg-red-500/10 p-5 ${className}`}>
      <div className="flex items-start gap-3">
        <FiAlertTriangle className="mt-0.5 shrink-0 text-red-400" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-red-200">{title}</p>
          {message && <p className="mt-1 break-words text-xs text-red-300/80">{message}</p>}
        </div>
        {onRetry && (
          <button onClick={onRetry} className="shrink-0 rounded-lg border border-red-400/30 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ title, message, className = "" }) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-950/40 p-8 text-center ${className}`}>
      <FiInbox className="mb-3 text-xl text-slate-600" aria-hidden="true" />
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {message && <p className="mt-1 max-w-md text-xs text-slate-500">{message}</p>}
    </div>
  );
}

export function StatusBadge({ tone = "slate", children }) {
  const tones = {
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    red: "border-red-500/30 bg-red-500/10 text-red-300",
    cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
    slate: "border-slate-700 bg-slate-800/60 text-slate-300",
  };
  return <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${tones[tone]}`}>{children}</span>;
}

export function Panel({ title, subtitle, action, children, className = "" }) {
  return (
    <section className={`rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h2 className="font-semibold text-slate-100">{title}</h2>}
            {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
