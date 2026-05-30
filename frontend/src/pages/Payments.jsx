import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { PageHeader, Card, Empty, StatusPill } from "../components/UI";
import { Modal, Field } from "./Properties";
import { Plus, RefreshCw } from "lucide-react";

export default function Payments() {
  const { isAdmin } = useAuth();
  const [payments, setPayments] = useState([]);
  const [snap, setSnap] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [leases, setLeases] = useState([]);

  const load = async () => {
    const [p, s, l] = await Promise.all([
      api.get("/payments").then((r) => r.data),
      api.get("/rentec/snapshot").then((r) => r.data).catch(() => null),
      api.get("/leases").then((r) => r.data).catch(() => []),
    ]);
    setPayments(p); setSnap(s); setLeases(l);
  };
  useEffect(() => { load(); }, []);

  const sync = async () => {
    setSyncing(true);
    try { await api.post("/rentec/sync"); await load(); } finally { setSyncing(false); }
  };

  const addPayment = async (form) => {
    await api.post("/payments", {
      ...form,
      amount: Number(form.amount),
      source: "manual",
    });
    setShowNew(false); load();
  };

  // Combine local + Rentec payments
  const rentecPayments = (snap?.payments || []).slice(0, 50).map((rp, i) => ({
    id: `rentec-${i}`,
    rentec_payment_id: rp.id || null,
    tenant_name: rp.receivedFromTenant || rp.tenant || null,
    amount: Number(rp.amountReceived || rp.amount || 0),
    date: rp.date || rp.paymentDate || "",
    method: rp.paymentMethod || rp.method || null,
    status: "paid",
    source: "rentec",
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Cash flow"
        title="Payments"
        action={
          <div className="flex gap-2">
            <button data-testid="payments-sync-btn" onClick={sync} disabled={syncing} className="btn-gold">
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing…" : "Sync"}
            </button>
            {isAdmin && (
              <button data-testid="add-payment-btn" onClick={() => setShowNew(true)} className="btn-primary">
                <Plus size={14} /> Log Payment
              </button>
            )}
          </div>
        }
      >
        Live payments from Rentec Direct plus any manual entries.
      </PageHeader>

      <div className="p-6 md:p-10 space-y-6">
        <Card title="Rentec snapshot">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KV label="Properties" v={snap?.counts?.properties || 0} />
            <KV label="Units" v={snap?.counts?.units || 0} />
            <KV label="Leases" v={snap?.counts?.leases || 0} />
            <KV label="Tenants" v={snap?.counts?.tenants || 0} />
            <KV label="Payments" v={snap?.counts?.payments || 0} />
          </div>
          {!snap?.configured && (
            <div className="text-xs text-yellow-400 mt-3">
              Rentec API key not set. Edit <code className="text-gold-500">backend/.env</code> → <code className="text-gold-500">RENTEC_API_KEY</code>.
            </div>
          )}
          {snap?.synced_at && <div className="text-[11px] text-ink-500 mt-2">Last sync: {new Date(snap.synced_at).toLocaleString()}</div>}
        </Card>

        <Card title="Payment history" testId="payments-table">
          {payments.length + rentecPayments.length === 0 ? (
            <Empty message="No payments yet. Run a Rentec sync or log a manual payment." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-[0.2em] text-gold-500 border-b border-ink-600">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Tenant</th>
                    <th className="py-2 pr-3">Property</th>
                    <th className="py-2 pr-3">Amount</th>
                    <th className="py-2 pr-3">Method</th>
                    <th className="py-2 pr-3">Source</th>
                    <th className="py-2 pr-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...payments, ...rentecPayments]
                    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
                    .map((p) => (
                      <tr key={p.id} className="border-b border-ink-600 last:border-0">
                        <td className="py-2 pr-3 text-bone-100">{p.date || "—"}</td>
                        <td className="py-2 pr-3">{p.tenant_name || "—"}</td>
                        <td className="py-2 pr-3 text-ink-500">{p.property_address || "—"}</td>
                        <td className="py-2 pr-3 font-mono">${Number(p.amount || 0).toLocaleString()}</td>
                        <td className="py-2 pr-3 text-ink-500">{p.method || "—"}</td>
                        <td className="py-2 pr-3"><StatusPill status={p.source === "rentec" ? "active" : "pending"} /></td>
                        <td className="py-2 pr-3"><StatusPill status={p.status} /></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {showNew && (
        <Modal title="Log Payment" onClose={() => setShowNew(false)}>
          <PaymentForm leases={leases} onSubmit={addPayment} onClose={() => setShowNew(false)} />
        </Modal>
      )}
    </div>
  );
}

function PaymentForm({ leases, onSubmit, onClose }) {
  const [f, setF] = useState({ lease_id: "", tenant_name: "", property_address: "", amount: "", date: "", method: "", status: "paid" });
  return (
    <form data-testid="new-payment-form" className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSubmit(f); }}>
      <Field label="Tenant name" value={f.tenant_name} onChange={(v) => setF({ ...f, tenant_name: v })} testId="payment-tenant" required />
      <Field label="Property address" value={f.property_address} onChange={(v) => setF({ ...f, property_address: v })} testId="payment-property" />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Amount" value={f.amount} onChange={(v) => setF({ ...f, amount: v })} testId="payment-amount" type="number" required />
        <Field label="Date" value={f.date} onChange={(v) => setF({ ...f, date: v })} testId="payment-date" type="date" required />
      </div>
      <Field label="Method" value={f.method} onChange={(v) => setF({ ...f, method: v })} testId="payment-method" />
      <div>
        <label className="label">Status</label>
        <select data-testid="payment-status" className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
          <option value="late">Late</option>
          <option value="unpaid">Unpaid</option>
        </select>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
        <button type="submit" data-testid="payment-submit" className="btn-primary">Log payment</button>
      </div>
    </form>
  );
}

function KV({ label, v }) {
  return (
    <div className="bg-ink-900 border border-ink-600 rounded-sm p-2">
      <div className="text-[10px] tracking-[0.25em] uppercase text-ink-500">{label}</div>
      <div className="text-bone-100 text-lg mt-0.5 font-display">{String(v)}</div>
    </div>
  );
}
