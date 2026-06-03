import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { PageHeader, Card } from "../components/UI";
import { RefreshCw, DollarSign, Building2, ListChecks, AlertTriangle, CheckCircle2 } from "lucide-react";

const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [props, setProps] = useState([]);
  const [accounts, setAccounts] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  const load = async () => {
    const [s, t, p, acc] = await Promise.all([
      api.get("/rent-status/summary").then((r) => r.data).catch(() => null),
      api.get("/tasks").then((r) => r.data).catch(() => []),
      api.get("/properties").then((r) => r.data).catch(() => []),
      api.get("/rent-status/accounts").then((r) => r.data).catch(() => null),
    ]);
    setSummary(s); setTasks(t); setProps(p); setAccounts(acc);
  };

  useEffect(() => { load(); }, []);

  const sync = async () => {
    setSyncing(true); setSyncMsg("");
    try {
      const { data } = await api.post("/rentec/sync");
      setSyncMsg(`Synced ${data.counts?.properties || 0} properties · ${data.counts?.tenants || 0} tenants · ${data.counts?.leases || 0} leases`);
      await load();
    } catch (e) {
      setSyncMsg(e?.response?.data?.detail || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const pendingTasks = tasks.filter((t) => t.status !== "done");
  const urgentTasks = pendingTasks.filter((t) => t.priority === "urgent");
  const pastDue = accounts?.past_due || [];
  const pastDueTotal = summary?.past_due_total ?? pastDue.reduce((s, a) => s + (a.past_due || 0), 0);

  return (
    <div>
      <PageHeader
        eyebrow="Kell Commercial · Portfolio"
        title="Payment Status"
        action={
          <button data-testid="dashboard-sync-btn" onClick={sync} disabled={syncing} className="btn-gold disabled:opacity-50">
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Refreshing…" : "Refresh"}
          </button>
        }
      >
        Who's current, who's past due, and by how much — pulled live from Rentec Direct.
      </PageHeader>

      <div className="p-6 md:p-10 space-y-8">
        {syncMsg && (
          <div data-testid="sync-message" className="panel p-3 text-sm text-bone-200 border-gold-500">
            {syncMsg}
          </div>
        )}

        {/* Stat row — past due leads */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4" data-testid="dashboard-stats">
          <PastDueStat total={pastDueTotal} count={summary?.past_due_count ?? pastDue.length} />
          <Stat
            icon={DollarSign}
            label="Collected MTD"
            value={summary ? money(summary.total_collected) : "—"}
            sub={summary ? `${summary.collection_rate || 0}% of expected` : "Refresh to load"}
          />
          <Stat icon={ListChecks} label="Open Tasks" value={pendingTasks.length} sub={`${urgentTasks.length} urgent`} link="/tasks" />
          <Stat icon={Building2} label="Properties" value={props.length || 0} sub={`${accounts?.accounts?.length || 0} tenant accounts`} link="/properties" />
        </div>

        {/* Past-due accounts — the headline view */}
        <Card title="Past-Due Accounts" testId="dashboard-pastdue" className={pastDue.length ? "panel-hot" : ""}>
          {!accounts && <div className="text-bone-300 text-sm">Loading…</div>}
          {accounts && pastDue.length === 0 && (
            <div className="flex items-center gap-2 text-emerald-700 text-sm py-2">
              <CheckCircle2 size={18} /> Everyone is current — no past-due balances.
            </div>
          )}
          {pastDue.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-[0.2em] text-ink-500 border-b border-ink-600">
                    <th className="py-2 pr-3">Tenant</th>
                    <th className="py-2 pr-3">Property</th>
                    <th className="py-2 pr-3 text-right">Past due</th>
                  </tr>
                </thead>
                <tbody>
                  {pastDue.map((a) => (
                    <tr key={a.tenant_id || a.name} className="border-b border-ink-600 last:border-0">
                      <td className="py-2 pr-3 text-bone-100 font-medium">{a.name}</td>
                      <td className="py-2 pr-3 text-bone-300">{a.address || "—"}</td>
                      <td className="py-2 pr-3 text-right font-mono text-crimson-600 font-semibold">{money(a.past_due)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 text-right">
                <Link to="/tenants" className="text-xs text-gold-600 hover:text-crimson-600 uppercase tracking-wider">View all tenants →</Link>
              </div>
            </div>
          )}
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card title="Rent Collection — Current Month" className="lg:col-span-2">
            {!summary && <div className="text-bone-300 text-sm">Loading…</div>}
            {summary && (
              <div className="space-y-4">
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-3xl font-display text-bone-100">{money(summary.total_collected)}</div>
                    <div className="text-xs text-ink-500 mt-1">of {money(summary.total_expected)} expected</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-display text-gold-600">{summary.collection_rate || 0}%</div>
                    <div className="text-xs text-ink-500 mt-1">collection rate</div>
                  </div>
                </div>
                <div className="h-2 bg-ink-700 rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-crimson-700 to-gold-500"
                    style={{ width: `${Math.min(100, summary.collection_rate || 0)}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <KV label="Current" v={summary.current_count ?? "—"} />
                  <KV label="Past due" v={summary.past_due_count ?? "—"} />
                  <KV label="Last synced" v={summary.synced_at ? new Date(summary.synced_at).toLocaleString() : "never"} />
                </div>
                {!summary.configured && (
                  <div className="text-xs text-crimson-600 mt-1">
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
                  {t.priority === "urgent" && <AlertTriangle size={14} className="text-crimson-600" />}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PastDueStat({ total, count }) {
  const hot = (count || 0) > 0;
  return (
    <div className={`p-5 flex items-center justify-between rounded-md ${hot ? "panel-hot" : "panel"}`} data-testid="stat-pastdue">
      <div>
        <div className="brand-sub">Past Due</div>
        <div className={`text-3xl font-display mt-1 ${hot ? "text-crimson-600" : "text-bone-100"}`}>
          ${Number(total || 0).toLocaleString()}
        </div>
        <div className="text-[11px] text-ink-500 mt-1">{count || 0} account{(count || 0) === 1 ? "" : "s"}</div>
      </div>
      <AlertTriangle size={28} className={hot ? "text-crimson-600" : "text-ink-500 opacity-50"} />
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub, link }) {
  const body = (
    <div className="panel p-5 flex items-center justify-between hover:border-gold-500 transition-colors h-full">
      <div>
        <div className="brand-sub">{label}</div>
        <div className="text-3xl font-display text-bone-100 mt-1">{value}</div>
        <div className="text-[11px] text-ink-500 mt-1">{sub}</div>
      </div>
      <Icon size={28} className="text-crimson-700 opacity-50" />
    </div>
  );
  return link ? <Link to={link}>{body}</Link> : body;
}

function KV({ label, v }) {
  return (
    <div className="bg-ink-800 border border-ink-600 rounded-sm p-2">
      <div className="text-[10px] tracking-[0.25em] uppercase text-ink-500">{label}</div>
      <div className="text-bone-100 text-sm mt-0.5">{String(v ?? "—")}</div>
    </div>
  );
}
