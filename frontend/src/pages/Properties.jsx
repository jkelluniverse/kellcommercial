import React, { useEffect, useState } from "react";
import { api, formatApiError } from "../lib/api";
import { PageHeader, Empty } from "../components/UI";
import { useAuth } from "../lib/auth";
import { Plus, Trash2, ChevronRight } from "lucide-react";

export default function Properties() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState(null);
  const [err, setErr] = useState("");

  const load = async () => {
    const { data } = await api.get("/properties");
    setItems(data);
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const create = async (form) => {
    setErr("");
    try {
      await api.post("/properties", form);
      setShowNew(false);
      load();
    } catch (e) { setErr(formatApiError(e)); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete property and its units?")) return;
    await api.delete(`/properties/${id}`);
    setSelected(null);
    load();
  };

  return (
    <div>
      <PageHeader
        eyebrow="Portfolio"
        title="Properties & Units"
        action={isAdmin && (
          <button data-testid="new-property-btn" onClick={() => setShowNew(true)} className="btn-primary">
            <Plus size={14} /> New Property
          </button>
        )}
      >
        Residential portfolio plus the Kell Commercial building (modeled as one property with child units).
      </PageHeader>

      <div className="p-6 md:p-10">
        {items.length === 0 ? (
          <Empty message="Add your first property to begin tracking." />
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="properties-grid">
            {items.map((p) => (
              <button
                key={p.id}
                data-testid={`property-card-${p.id}`}
                onClick={() => setSelected(p)}
                className="panel p-5 text-left hover:border-crimson-700 transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="brand-sub mb-1">{p.type === "commercial" ? "Commercial" : "Residential"}</div>
                    <div className="font-display text-xl text-bone-100 tracking-wide">{p.name}</div>
                    <div className="text-xs text-ink-500 mt-1">{p.address}</div>
                  </div>
                  <ChevronRight size={16} className="text-ink-500 group-hover:text-crimson-500 transition-colors" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {showNew && <NewPropertyModal onClose={() => setShowNew(false)} onSubmit={create} error={err} />}
      {selected && <PropertyDetail prop={selected} isAdmin={isAdmin} onClose={() => setSelected(null)} onDelete={() => remove(selected.id)} />}
    </div>
  );
}

function NewPropertyModal({ onClose, onSubmit, error }) {
  const [form, setForm] = useState({ name: "", address: "", type: "residential", rentec_property_id: "", notes: "" });
  return (
    <Modal onClose={onClose} title="New Property">
      <form
        data-testid="new-property-form"
        className="space-y-4"
        onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}
      >
        <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} testId="prop-name" required />
        <Field label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} testId="prop-address" required />
        <div>
          <label className="label">Type</label>
          <select data-testid="prop-type" className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
          </select>
        </div>
        <Field label="Rentec property ID (optional)" value={form.rentec_property_id} onChange={(v) => setForm({ ...form, rentec_property_id: v })} testId="prop-rentec-id" />
        <Field label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} testId="prop-notes" />
        {error && <div className="text-crimson-500 text-xs">{error}</div>}
        <div className="flex gap-2 justify-end">
          <button type="button" data-testid="prop-cancel" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="submit" data-testid="prop-submit" className="btn-primary">Create</button>
        </div>
      </form>
    </Modal>
  );
}

function PropertyDetail({ prop, onClose, onDelete, isAdmin }) {
  const [units, setUnits] = useState([]);
  const [showUnit, setShowUnit] = useState(false);

  const load = async () => {
    const { data } = await api.get(`/properties/${prop.id}/units`);
    setUnits(data);
  };
  useEffect(() => { load(); }, [prop.id]);

  const addUnit = async (form) => {
    await api.post(`/properties/${prop.id}/units`, { ...form, property_id: prop.id });
    setShowUnit(false);
    load();
  };

  return (
    <Modal onClose={onClose} title={prop.name} wide>
      <div className="space-y-4">
        <div className="text-sm text-bone-300">{prop.address}</div>
        <div className="flex items-center justify-between">
          <div className="font-display tracking-wider uppercase text-sm text-gold-500">Units</div>
          {isAdmin && (
            <button data-testid="add-unit-btn" onClick={() => setShowUnit(true)} className="btn-gold">
              <Plus size={14} /> Add Unit
            </button>
          )}
        </div>
        {units.length === 0 ? (
          <div className="text-sm text-bone-300">No units yet.</div>
        ) : (
          <div className="space-y-2" data-testid="units-list">
            {units.map((u) => (
              <div key={u.id} className="panel p-3 flex items-center justify-between">
                <div>
                  <div className="text-bone-100">{u.name}</div>
                  <div className="text-[11px] text-ink-500">
                    {u.beds ? `${u.beds} bd` : ""} {u.baths ? `· ${u.baths} ba` : ""} {u.market_rent ? `· $${u.market_rent}/mo` : ""}
                  </div>
                </div>
                {isAdmin && (
                  <button onClick={async () => { await api.delete(`/units/${u.id}`); load(); }} className="text-ink-500 hover:text-crimson-500">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {isAdmin && (
          <div className="pt-4 border-t border-ink-600 flex justify-between">
            <button data-testid="delete-property-btn" onClick={onDelete} className="btn-ghost text-crimson-500 hover:text-crimson-500 hover:border-crimson-700">
              <Trash2 size={14} /> Delete property
            </button>
            <button onClick={onClose} className="btn-gold">Close</button>
          </div>
        )}
      </div>

      {showUnit && <NewUnitModal onClose={() => setShowUnit(false)} onSubmit={addUnit} />}
    </Modal>
  );
}

function NewUnitModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({ name: "", beds: "", baths: "", market_rent: "", rentec_unit_id: "", notes: "" });
  return (
    <Modal onClose={onClose} title="New Unit">
      <form
        data-testid="new-unit-form"
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            ...form,
            beds: form.beds ? Number(form.beds) : null,
            baths: form.baths ? Number(form.baths) : null,
            market_rent: form.market_rent ? Number(form.market_rent) : null,
          });
        }}
      >
        <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} testId="unit-name" required />
        <div className="grid grid-cols-3 gap-2">
          <Field label="Beds" value={form.beds} onChange={(v) => setForm({ ...form, beds: v })} testId="unit-beds" type="number" />
          <Field label="Baths" value={form.baths} onChange={(v) => setForm({ ...form, baths: v })} testId="unit-baths" type="number" />
          <Field label="Rent" value={form.market_rent} onChange={(v) => setForm({ ...form, market_rent: v })} testId="unit-rent" type="number" />
        </div>
        <Field label="Rentec unit ID (optional)" value={form.rentec_unit_id} onChange={(v) => setForm({ ...form, rentec_unit_id: v })} testId="unit-rentec-id" />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="submit" data-testid="unit-submit" className="btn-primary">Add</button>
        </div>
      </form>
    </Modal>
  );
}

export function Modal({ children, onClose, title, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div
        className={`panel-hot p-6 w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[85vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-display tracking-wider uppercase text-lg text-bone-100 mb-5">{title}</div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, value, onChange, type = "text", testId, required = false }) {
  return (
    <div>
      <label className="label">{label}{required && <span className="text-crimson-500"> *</span>}</label>
      <input
        data-testid={testId}
        className="input"
        type={type}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    </div>
  );
}
