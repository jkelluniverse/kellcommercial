import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { PageHeader, Card, StatusPill } from "../components/UI";
import { RefreshCw, DollarSign, Building2, ListChecks, AlertTriangle } from "lucide-react";

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [health, setHealth] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [props, setProps] = useState([]);
  const [snap, setSnap] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  const load = async () => {
    const [s, h, t, p, snap] = await Promise.all([
      api.get("/rent-status/summary").then((r) => r.data).catch(() => null),
      api.get("/health").then((r) => r.data).catch(() => null),
      api.get("/tasks").then((r) => r.data).catch(() => []),
      api.get("/properties").then((r) => r.data).catch(() => []),
      api.get("/rentec/snapshot").then((r) => r.data).catch(() => null),
    ]);
    setSummary(s); setHealth(h); setTasks(t); setProps(p); setSnap(snap);
  };

  useEffect(() => { load(); }, []);

  const sync = async () => {
    setSyncing(true); setSyncMsg("");
    try {
      const { data } = await api.post("/rentec/sync");
      setSyncMsg(`Synced ${data.counts?.properties || 0} properties · ${data.counts?.leases || 0} leases · ${data.counts?.payments || 0} payments`);
      await load();
    } catch (e) {
      setSyncMsg(e?.response?.data?.detail || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const pendingTasks = tasks.filter((t) => t.status !== "done");
  const urgentTasks = pendingTasks.filter((t) => t.priority === "urgent");

  return (
    <div>
      <PageHeader
        eyebrow="Operations · Dashboard"
        title="Portfolio Overview"
        action={
          <button data-testid="dashboard-sync-btn" onClick={sync} disabled={syncing} className="btn-gold disabled:opacity-50">
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing…" : "Sync Rentec"}
          </button>
        }
      >
        Live snapshot of payments, properties, and tasks across the Kell Commercial portfolio.
      </PageHeader>

      <div className="p-6 md:p-10 space-y-8">
        {syncMsg && (
          <div data-testid="sync-message" className="panel p-3 text-sm text-bone-200 border-gold-500">
            {syncMsg}
          </div>
        )}

        {/* Stat row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4" data-testid="dashboard-stats">
          <Stat icon={Building2} label="Properties" value={(snap?.counts?.properties ?? props.length) || 0} sub={snap?.counts?.properties ? `${snap.counts.units || 0} units · from Rentec` : "In portfolio"} />
          <Stat
            icon={DollarSign}
            label="Collected MTD"
            value={summary ? `$${(summary.total_collected || 0).toLocaleString()}` : "—"}
            sub={summary ? `${summary.collection_rate || 0}% of expected` : "Run sync"}
          />
          <Stat icon={ListChecks} label="Open Tasks" value={pendingTasks.length} sub={`${urgentTasks.length} urgent`} />
          <Stat
            icon={AlertTriangle}
            label="Integrations"
            value={health ? [health.rentec_configured, health.drive_configured, health.email_configured].filter(Boolean).length : 0}
            sub="of 3 configured"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card title="Rent Collection — Current Month" className="lg:col-span-2">
            {!summary && <div className="text-bone-300 text-sm">Loading…</div>}
            {summary && (
              <div className="space-y-4">
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-3xl font-display text-bone-100">
                      ${(summary.total_collected || 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-ink-500 mt-1">
                      of ${(summary.total_expected || 0).toLocaleString()} expected
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-display text-gold-500">{summary.collection_rate || 0}%</div>
                    <div className="text-xs text-ink-500 mt-1">collection rate</div>
                  </div>
                </div>
                <div className="h-2 bg-ink-900 rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-crimson-700 to-gold-500"
                    style={{ width: `${Math.min(100, summary.collection_rate || 0)}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <KV label="Active leases" v={summary.lease_count} />
                  <KV label="Balance due" v={`$${(summary.total_balance_due || 0).toLocaleString()}`} />
                  <KV label="Last synced" v={summary.synced_at ? new Date(summary.synced_at).toLocaleString() : "never"} />
                </div>
                {!summary.configured && (
                  <div className="text-xs text-yellow-400 mt-1">
                    Rentec API not configured — set RENTEC_API_KEY in backend/.env to enable live data.
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card title="Recent Tasks" testId="dashboard-tasks">
            {pendingTasks.length === 0 && <div className="text-sm text-bone-300">No open tasks.</div>}
            <ul className="space-y-2">
              {pendingTasks.slice(0, 5).map((t) => (
                <li key={t.id} className="flex items-center justify-between py-1 border-b border-ink-600 last:border-0">
                  <div>
                    <div className="text-sm text-bone-100">{t.title}</div>
                    {t.due_date && <div className="text-[11px] text-ink-500">Due {t.due_date}</div>}
                  </div>
                  <StatusPill status={t.priority} />
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub }) {
  return (
    <div className="panel p-5 flex items-center justify-between hover:border-gold-500 transition-colors">
      <div>
        <div className="brand-sub">{label}</div>
        <div className="text-3xl font-display text-bone-100 mt-1">{value}</div>
        <div className="text-[11px] text-ink-500 mt-1">{sub}</div>
      </div>
      <Icon size={28} className="text-crimson-700 opacity-50" />
    </div>
  );
}

function KV({ label, v }) {
  return (
    <div className="bg-ink-900 border border-ink-600 rounded-sm p-2">
      <div className="text-[10px] tracking-[0.25em] uppercase text-ink-500">{label}</div>
      <div className="text-bone-100 text-sm mt-0.5">{String(v ?? "—")}</div>
    </div>
  );
}
