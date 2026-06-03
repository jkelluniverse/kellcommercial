import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { PageHeader, Card, Empty, StatusPill } from "../components/UI";
import { Modal, Field } from "./Properties";
import { Plus, Trash2 } from "lucide-react";

const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function Tenants() {
  const { isAdmin } = useAuth();
  const [tenants, setTenants] = useState([]);
  const [leases, setLeases] = useState([]);
  const [properties, setProperties] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [showTenant, setShowTenant] = useState(false);
  const [showLease, setShowLease] = useState(false);

  const load = async () => {
    const [t, l, p, acc] = await Promise.all([
      api.get("/tenants").then((r) => r.data),
      api.get("/leases").then((r) => r.data),
      api.get("/properties").then((r) => r.data),
      api.get("/rent-status/accounts").then((r) => r.data?.accounts || []).catch(() => []),
    ]);
    setTenants(t); setLeases(l); setProperties(p); setAccounts(acc);
  };
  useEffect(() => { load(); }, []);

  // Join Rentec payment situation onto local tenants by name (case-insensitive).
  const acctByName = {};
  accounts.forEach((a) => { if (a.name) acctByName[a.name.trim().toLowerCase()] = a; });
  const acctFor = (t) => acctByName[(t.name || "").trim().toLowerCase()];

  const addTenant = async (form) => { await api.post("/tenants", form); setShowTenant(false); load(); };
  const removeTenant = async (id) => {
    if (!window.confirm("Remove this tenant?")) return;
    await api.delete(`/tenants/${id}`); load();
  };
  const addLease = async (form) => {
    await api.post("/leases", { ...form, monthly_rent: Number(form.monthly_rent), deposit: form.deposit ? Number(form.deposit) : null });
    setShowLease(false); load();
  };
  const removeLease = async (id) => {
    if (!window.confirm("Remove this lease?")) return;
    await api.delete(`/leases/${id}`); load();
  };

  const propName = (id) => properties.find((p) => p.id === id)?.name || "—";
  const tenantName = (id) => tenants.find((t) => t.id === id)?.name || "—";

  return (
    <div>
      <PageHeader
        eyebrow="Directory"
        title="Tenants & Leases"
        action={isAdmin && (
          <div className="flex gap-2">
            <button data-testid="add-tenant-btn" onClick={() => setShowTenant(true)} className="btn-gold"><Plus size={14} /> Tenant</button>
            <button data-testid="add-lease-btn" onClick={() => setShowLease(true)} className="btn-primary"><Plus size={14} /> Lease</button>
          </div>
        )}
      />

      {/* Payment situation, straight from Rentec — the headline for each tenant */}
      {accounts.length > 0 && (
        <div className="px-6 md:px-10 pt-6">
          <Card title="Payment Situation — Live from Rentec" testId="tenants-accounts">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-[0.2em] text-ink-500 border-b border-ink-600">
                    <th className="py-2 pr-3">Tenant</th>
                    <th className="py-2 pr-3">Property</th>
                    <th className="py-2 pr-3 text-right">Balance</th>
                    <th className="py-2 pr-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.tenant_id || a.name} className="border-b border-ink-600 last:border-0">
                      <td className="py-2 pr-3 text-bone-100 font-medium">{a.name}</td>
                      <td className="py-2 pr-3 text-bone-300">{a.address || "—"}</td>
                      <td className={`py-2 pr-3 text-right font-mono ${a.past_due > 0 ? "text-crimson-600 font-semibold" : "text-bone-300"}`}>{money(a.balance)}</td>
                      <td className="py-2 pr-3 text-center"><StatusPill status={a.status === "past_due" ? "delinquent" : a.status === "credit" ? "paid" : "active"} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      <div className="p-6 md:p-10 grid lg:grid-cols-2 gap-6">
        <Card title="Tenants" testId="tenants-card">
          {tenants.length === 0 ? <Empty message="Add a tenant to get started, or run a Rentec sync above." /> : (
            <div className="space-y-2" data-testid="tenants-list">
              {tenants.map((t) => {
                const acct = acctFor(t);
                return (
                <div key={t.id} className="flex items-center justify-between py-2 border-b border-ink-600 last:border-0">
                  <div>
                    <div className="text-bone-100">{t.name}</div>
                    <div className="text-[11px] text-ink-500">
                      {t.email || ""} {t.phone ? `· ${t.phone}` : ""} {t.property_id ? `· ${propName(t.property_id)}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {acct && (
                      <span className={`text-xs font-mono ${acct.past_due > 0 ? "text-crimson-600 font-semibold" : "text-emerald-700"}`}>
                        {acct.past_due > 0 ? `${money(acct.past_due)} due` : "Current"}
                      </span>
                    )}
                    {isAdmin && (
                      <button onClick={() => removeTenant(t.id)} className="text-ink-500 hover:text-crimson-500">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Active Leases" testId="leases-card">
          {leases.length === 0 ? <Empty message="No leases recorded yet." /> : (
            <div className="space-y-2" data-testid="leases-list">
              {leases.map((l) => (
                <div key={l.id} className="panel p-3 flex items-center justify-between">
                  <div>
                    <div className="text-bone-100">{tenantName(l.tenant_id)} → {propName(l.property_id)}</div>
                    <div className="text-[11px] text-ink-500">
                      ${Number(l.monthly_rent).toLocaleString()}/mo · {l.start_date}{l.end_date ? ` → ${l.end_date}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill status={l.status} />
                    {isAdmin && (
                      <button onClick={() => removeLease(l.id)} className="text-ink-500 hover:text-crimson-500">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {showTenant && (
        <Modal title="New Tenant" onClose={() => setShowTenant(false)}>
          <TenantForm properties={properties} onSubmit={addTenant} onClose={() => setShowTenant(false)} />
        </Modal>
      )}
      {showLease && (
        <Modal title="New Lease" onClose={() => setShowLease(false)}>
          <LeaseForm tenants={tenants} properties={properties} onSubmit={addLease} onClose={() => setShowLease(false)} />
        </Modal>
      )}
    </div>
  );
}

function TenantForm({ properties, onSubmit, onClose }) {
  const [f, setF] = useState({ name: "", email: "", phone: "", property_id: "", notes: "" });
  return (
    <form data-testid="new-tenant-form" className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSubmit(f); }}>
      <Field label="Name" value={f.name} onChange={(v) => setF({ ...f, name: v })} testId="tenant-name" required />
      <Field label="Email" value={f.email} onChange={(v) => setF({ ...f, email: v })} testId="tenant-email" type="email" />
      <Field label="Phone" value={f.phone} onChange={(v) => setF({ ...f, phone: v })} testId="tenant-phone" />
      <div>
        <label className="label">Property</label>
        <select data-testid="tenant-property" className="input" value={f.property_id} onChange={(e) => setF({ ...f, property_id: e.target.value })}>
          <option value="">— None —</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
        <button type="submit" data-testid="tenant-submit" className="btn-primary">Add</button>
      </div>
    </form>
  );
}

function LeaseForm({ tenants, properties, onSubmit, onClose }) {
  const [f, setF] = useState({ tenant_id: "", property_id: "", start_date: "", end_date: "", monthly_rent: "", deposit: "", status: "active" });
  return (
    <form data-testid="new-lease-form" className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSubmit(f); }}>
      <div>
        <label className="label">Tenant *</label>
        <select required data-testid="lease-tenant" className="input" value={f.tenant_id} onChange={(e) => setF({ ...f, tenant_id: e.target.value })}>
          <option value="">— Select —</option>
          {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Property *</label>
        <select required data-testid="lease-property" className="input" value={f.property_id} onChange={(e) => setF({ ...f, property_id: e.target.value })}>
          <option value="">— Select —</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Start" value={f.start_date} onChange={(v) => setF({ ...f, start_date: v })} testId="lease-start" type="date" required />
        <Field label="End" value={f.end_date} onChange={(v) => setF({ ...f, end_date: v })} testId="lease-end" type="date" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Monthly rent" value={f.monthly_rent} onChange={(v) => setF({ ...f, monthly_rent: v })} testId="lease-rent" type="number" required />
        <Field label="Deposit" value={f.deposit} onChange={(v) => setF({ ...f, deposit: v })} testId="lease-deposit" type="number" />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
        <button type="submit" data-testid="lease-submit" className="btn-primary">Save</button>
      </div>
    </form>
  );
}
