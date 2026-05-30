import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { PageHeader, Card, Empty } from "../components/UI";
import { Modal, Field } from "./Properties";
import { Plus, Trash2 } from "lucide-react";

export default function Expenses() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [props, setProps] = useState([]);
  const [showNew, setShowNew] = useState(false);

  const load = async () => {
    const [e, p] = await Promise.all([
      api.get("/expenses").then((r) => r.data),
      api.get("/properties").then((r) => r.data),
    ]);
    setItems(e); setProps(p);
  };
  useEffect(() => { load(); }, []);

  const add = async (form) => {
    await api.post("/expenses", { ...form, amount: Number(form.amount), tax_year: form.tax_year ? Number(form.tax_year) : null });
    setShowNew(false); load();
  };
  const remove = async (id) => {
    if (!window.confirm("Delete expense?")) return;
    await api.delete(`/expenses/${id}`); load();
  };

  const propName = (id) => props.find((p) => p.id === id)?.name || "—";
  const total = items.reduce((a, e) => a + Number(e.amount || 0), 0);

  return (
    <div>
      <PageHeader
        eyebrow="Bookkeeping"
        title="Expenses"
        action={isAdmin && (
          <button data-testid="add-expense-btn" onClick={() => setShowNew(true)} className="btn-primary">
            <Plus size={14} /> New Expense
          </button>
        )}
      >
        Total recorded: <strong className="text-gold-500">${total.toLocaleString()}</strong>
      </PageHeader>

      <div className="p-6 md:p-10">
        <Card title="All expenses" testId="expenses-table">
          {items.length === 0 ? <Empty message="No expenses yet." /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-[0.2em] text-gold-500 border-b border-ink-600">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Description</th>
                    <th className="py-2 pr-3">Category</th>
                    <th className="py-2 pr-3">Property</th>
                    <th className="py-2 pr-3">Amount</th>
                    <th className="py-2 pr-3">Method</th>
                    {isAdmin && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {items.map((e) => (
                    <tr key={e.id} className="border-b border-ink-600 last:border-0" data-testid={`expense-row-${e.id}`}>
                      <td className="py-2 pr-3 text-bone-100">{e.expense_date}</td>
                      <td className="py-2 pr-3">{e.description}</td>
                      <td className="py-2 pr-3 text-ink-500">{e.category}</td>
                      <td className="py-2 pr-3 text-ink-500">{e.property_id ? propName(e.property_id) : "—"}</td>
                      <td className="py-2 pr-3 font-mono text-crimson-500">${Number(e.amount).toLocaleString()}</td>
                      <td className="py-2 pr-3 text-ink-500">{e.payment_method || "—"}</td>
                      {isAdmin && (
                        <td>
                          <button onClick={() => remove(e.id)} className="text-ink-500 hover:text-crimson-500">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {showNew && (
        <Modal title="New Expense" onClose={() => setShowNew(false)}>
          <ExpenseForm properties={props} onSubmit={add} onClose={() => setShowNew(false)} />
        </Modal>
      )}
    </div>
  );
}

function ExpenseForm({ properties, onSubmit, onClose }) {
  const [f, setF] = useState({ description: "", category: "Maintenance", amount: "", expense_date: "", property_id: "", payment_method: "", payee: "", tax_year: new Date().getFullYear(), notes: "" });
  return (
    <form data-testid="new-expense-form" className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSubmit(f); }}>
      <Field label="Description" value={f.description} onChange={(v) => setF({ ...f, description: v })} testId="expense-desc" required />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Category</label>
          <select data-testid="expense-category" className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            {["Maintenance", "Repairs", "Utilities", "Insurance", "Taxes", "Mortgage", "Supplies", "Professional", "Other"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <Field label="Amount" value={f.amount} onChange={(v) => setF({ ...f, amount: v })} testId="expense-amount" type="number" required />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Date" value={f.expense_date} onChange={(v) => setF({ ...f, expense_date: v })} testId="expense-date" type="date" required />
        <div>
          <label className="label">Property</label>
          <select data-testid="expense-property" className="input" value={f.property_id} onChange={(e) => setF({ ...f, property_id: e.target.value })}>
            <option value="">— None —</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Payment method" value={f.payment_method} onChange={(v) => setF({ ...f, payment_method: v })} testId="expense-method" />
        <Field label="Payee" value={f.payee} onChange={(v) => setF({ ...f, payee: v })} testId="expense-payee" />
      </div>
      <Field label="Notes" value={f.notes} onChange={(v) => setF({ ...f, notes: v })} testId="expense-notes" />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
        <button type="submit" data-testid="expense-submit" className="btn-primary">Save</button>
      </div>
    </form>
  );
}
