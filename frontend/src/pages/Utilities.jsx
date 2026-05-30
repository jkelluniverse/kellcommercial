import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { PageHeader, Card, Empty } from "../components/UI";

export default function Utilities() {
  const [items, setItems] = useState([]);

  const load = async () => {
    const { data } = await api.get("/utility-accounts");
    setItems(data);
  };
  useEffect(() => { load(); }, []);

  return (
    <div>
      <PageHeader eyebrow="Tenant" title="Utility Accounts">
        Submitted by tenants via the public form. Track active service connections per property.
      </PageHeader>

      <div className="p-6 md:p-10">
        <Card title={`Submissions · ${items.length}`} testId="utilities-card">
          {items.length === 0 ? <Empty message="No utility account submissions yet." /> : (
            <div className="space-y-3" data-testid="utilities-list">
              {items.map((u) => (
                <div key={u.id} className="panel p-4">
                  <div className="flex justify-between gap-3">
                    <div>
                      <div className="text-bone-100">{u.account_holder}</div>
                      <div className="text-[11px] text-ink-500">{u.email} · {u.property_address}</div>
                    </div>
                    <div className="text-[10px] tracking-[0.2em] uppercase text-ink-500">
                      {new Date(u.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-3 text-xs">
                    <U label="Electric" provider={u.electric_provider} acct={u.electric_account} />
                    <U label="Gas" provider={u.gas_provider} acct={u.gas_account} />
                    <U label="Water" provider={u.water_provider} acct={u.water_account} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="mt-6 text-[11px] text-ink-500">
          Public submission URL: <code className="text-gold-500">/public/utilities</code> (configure in your hosting / DNS).
        </div>
      </div>
    </div>
  );
}

function U({ label, provider, acct }) {
  return (
    <div className="bg-ink-900 border border-ink-600 p-2 rounded-sm">
      <div className="text-[10px] uppercase tracking-[0.25em] text-gold-500">{label}</div>
      <div className="text-bone-100 text-sm">{provider || "—"}</div>
      <div className="text-ink-500 text-[11px]">Acct: {acct || "—"}</div>
    </div>
  );
}
