import React from "react";

export function PageHeader({ eyebrow, title, action, children }) {
  return (
    <div className="px-6 md:px-10 pt-8 pb-6 border-b-2 border-crimson-600 bg-white">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {eyebrow && <div className="brand-sub mb-2">{eyebrow}</div>}
          <h1 className="font-display text-4xl md:text-5xl tracking-wide text-crimson-600">{title}</h1>
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
          {title && <div className="font-display tracking-wider uppercase text-sm text-crimson-600">{title}</div>}
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
      <div className="font-display tracking-wider uppercase text-sm text-gold-600 mb-2">No records</div>
      <div className="text-sm">{message}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function StatusPill({ status }) {
  const map = {
    paid: "border-emerald-600 text-emerald-700 bg-emerald-50",
    late: "border-yellow-600 text-yellow-800 bg-yellow-50",
    partial: "border-orange-600 text-orange-700 bg-orange-50",
    unpaid: "border-ink-600 text-bone-300",
    delinquent: "border-crimson-600 text-crimson-600 bg-red-50",
    active: "border-emerald-600 text-emerald-700 bg-emerald-50",
    pending: "border-ink-600 text-bone-300",
    in_progress: "border-yellow-600 text-yellow-800 bg-yellow-50",
    done: "border-emerald-600 text-emerald-700 bg-emerald-50",
    urgent: "border-crimson-600 text-crimson-600 bg-red-50",
    normal: "border-ink-600 text-bone-300",
    low: "border-ink-600 text-bone-300",
    new: "border-gold-500 text-gold-600 bg-yellow-50",
    reviewing: "border-yellow-600 text-yellow-800 bg-yellow-50",
    approved: "border-emerald-600 text-emerald-700 bg-emerald-50",
    declined: "border-crimson-600 text-crimson-600 bg-red-50",
  };
  const cls = map[status] || "border-ink-600 text-bone-300";
  return <span className={`pill ${cls}`}>{(status || "").replace(/_/g, " ")}</span>;
}
