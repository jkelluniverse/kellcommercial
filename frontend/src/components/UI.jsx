import React from "react";

export function PageHeader({ eyebrow, title, action, children }) {
  return (
    <div className="px-6 md:px-10 pt-8 pb-6 border-b border-ink-600 bg-gradient-to-b from-ink-900 to-ink-950">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {eyebrow && <div className="brand-sub mb-2">{eyebrow}</div>}
          <h1 className="font-display text-4xl md:text-5xl tracking-wide text-bone-100">{title}</h1>
          {children && <p className="mt-2 text-bone-300 max-w-2xl">{children}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
    </div>
  );
}

export function Card({ title, action, children, className = "", testId }) {
  return (
    <div data-testid={testId} className={`panel p-5 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-3">
          {title && <div className="font-display tracking-wider uppercase text-sm text-gold-500">{title}</div>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function Empty({ message = "Nothing here yet.", action = null }) {
  return (
    <div className="text-center text-bone-300 py-12">
      <div className="font-display tracking-wider uppercase text-sm text-ink-500 mb-2">No records</div>
      <div className="text-sm">{message}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function StatusPill({ status }) {
  const map = {
    paid: "border-emerald-700 text-emerald-400",
    late: "border-yellow-700 text-yellow-400",
    partial: "border-orange-700 text-orange-400",
    unpaid: "border-ink-500 text-bone-300",
    delinquent: "border-crimson-700 text-crimson-500",
    active: "border-emerald-700 text-emerald-400",
    pending: "border-ink-500 text-bone-300",
    in_progress: "border-yellow-700 text-yellow-400",
    done: "border-emerald-700 text-emerald-400",
    urgent: "border-crimson-700 text-crimson-500",
    normal: "border-ink-500 text-bone-300",
    low: "border-ink-500 text-ink-500",
    new: "border-gold-500 text-gold-400",
    reviewing: "border-yellow-700 text-yellow-400",
    approved: "border-emerald-700 text-emerald-400",
    declined: "border-crimson-700 text-crimson-500",
  };
  const cls = map[status] || "border-ink-500 text-bone-300";
  return <span className={`pill ${cls}`}>{(status || "").replace(/_/g, " ")}</span>;
}
