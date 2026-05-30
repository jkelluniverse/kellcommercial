import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { PageHeader, Card, Empty, StatusPill } from "../components/UI";

export default function Applications() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState([]);

  const load = async () => {
    const { data } = await api.get("/tenant-applications");
    setItems(data);
  };
  useEffect(() => { load(); }, []);

  const setStatus = async (id, status) => {
    await api.put(`/tenant-applications/${id}`, { status });
    load();
  };

  return (
    <div>
      <PageHeader eyebrow="Leasing" title="Tenant Applications">
        Applications submitted via the public form.
      </PageHeader>

      <div className="p-6 md:p-10">
        <Card title={`Applications · ${items.length}`} testId="apps-card">
          {items.length === 0 ? <Empty message="No applications yet." /> : (
            <div className="space-y-3" data-testid="apps-list">
              {items.map((a) => (
                <div key={a.id} className="panel p-4" data-testid={`app-${a.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-bone-100 font-display tracking-wide">{a.full_legal_name}</div>
                      <div className="text-[11px] text-ink-500">{a.email} · {a.phone}</div>
                      <div className="text-xs text-bone-300 mt-1">{a.property_address}</div>
                    </div>
                    <StatusPill status={a.status} />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs">
                    <KV label="Move-in" v={a.move_in_date} />
                    <KV label="Employer" v={a.employer || "—"} />
                    <KV label="Income" v={a.monthly_income || "—"} />
                    <KV label="Occupants" v={a.occupants || "—"} />
                  </div>
                  {a.notes && <div className="text-xs text-ink-500 mt-2">{a.notes}</div>}
                  {isAdmin && a.status === "new" && (
                    <div className="flex gap-2 mt-3">
                      <button data-testid={`app-review-${a.id}`} onClick={() => setStatus(a.id, "reviewing")} className="btn-ghost text-xs">Mark reviewing</button>
                      <button data-testid={`app-approve-${a.id}`} onClick={() => setStatus(a.id, "approved")} className="btn-gold text-xs">Approve</button>
                      <button data-testid={`app-decline-${a.id}`} onClick={() => setStatus(a.id, "declined")} className="btn-primary text-xs">Decline</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="mt-6 text-[11px] text-ink-500">
          Public submission URL: <code className="text-gold-500">/public/apply</code>.
        </div>
      </div>
    </div>
  );
}

function KV({ label, v }) {
  return (
    <div className="bg-ink-900 border border-ink-600 p-2 rounded-sm">
      <div className="text-[10px] uppercase tracking-[0.25em] text-gold-500">{label}</div>
      <div className="text-bone-100 text-sm">{v}</div>
    </div>
  );
}
