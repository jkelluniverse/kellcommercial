import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { PageHeader, Card, Empty, StatusPill } from "../components/UI";
import { Modal, Field } from "./Properties";
import { Plus, Trash2, CheckSquare } from "lucide-react";

export default function Tasks() {
  const { isAdmin } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [props, setProps] = useState([]);
  const [showNew, setShowNew] = useState(false);

  const load = async () => {
    const [t, p] = await Promise.all([
      api.get("/tasks").then((r) => r.data),
      api.get("/properties").then((r) => r.data),
    ]);
    setTasks(t); setProps(p);
  };
  useEffect(() => { load(); }, []);

  const add = async (form) => { await api.post("/tasks", form); setShowNew(false); load(); };
  const update = async (id, body) => { await api.put(`/tasks/${id}`, body); load(); };
  const remove = async (id) => {
    if (!window.confirm("Delete task?")) return;
    await api.delete(`/tasks/${id}`); load();
  };

  const propName = (id) => props.find((p) => p.id === id)?.name || "—";
  const grouped = {
    pending: tasks.filter((t) => t.status === "pending"),
    in_progress: tasks.filter((t) => t.status === "in_progress"),
    done: tasks.filter((t) => t.status === "done"),
  };

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Tasks"
        action={isAdmin && (
          <button data-testid="add-task-btn" onClick={() => setShowNew(true)} className="btn-primary">
            <Plus size={14} /> New Task
          </button>
        )}
      />

      <div className="p-6 md:p-10 grid lg:grid-cols-3 gap-4">
        {["pending", "in_progress", "done"].map((s) => (
          <Card key={s} title={s.replace("_", " ")} testId={`tasks-col-${s}`}>
            {grouped[s].length === 0 ? <Empty message="No tasks." /> : (
              <div className="space-y-2">
                {grouped[s].map((t) => (
                  <div key={t.id} className="panel p-3" data-testid={`task-${t.id}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-bone-100">{t.title}</div>
                        {t.description && <div className="text-[11px] text-ink-500 mt-1">{t.description}</div>}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <StatusPill status={t.priority} />
                          {t.due_date && <span className="text-[10px] text-ink-500">Due {t.due_date}</span>}
                          {t.property_id && <span className="text-[10px] text-gold-500">{propName(t.property_id)}</span>}
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex flex-col gap-1">
                          {s !== "done" && (
                            <button data-testid={`task-done-${t.id}`} onClick={() => update(t.id, { status: "done" })} className="text-ink-500 hover:text-emerald-400">
                              <CheckSquare size={14} />
                            </button>
                          )}
                          <button data-testid={`task-del-${t.id}`} onClick={() => remove(t.id)} className="text-ink-500 hover:text-crimson-500">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                    {isAdmin && s === "pending" && (
                      <button onClick={() => update(t.id, { status: "in_progress" })} className="text-[10px] uppercase tracking-widest text-gold-500 hover:text-gold-400 mt-2">
                        Start →
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>

      {showNew && (
        <Modal title="New Task" onClose={() => setShowNew(false)}>
          <TaskForm properties={props} onSubmit={add} onClose={() => setShowNew(false)} />
        </Modal>
      )}
    </div>
  );
}

function TaskForm({ properties, onSubmit, onClose }) {
  const [f, setF] = useState({ title: "", description: "", property_id: "", due_date: "", priority: "normal", status: "pending" });
  return (
    <form data-testid="new-task-form" className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSubmit(f); }}>
      <Field label="Title" value={f.title} onChange={(v) => setF({ ...f, title: v })} testId="task-title" required />
      <Field label="Description" value={f.description} onChange={(v) => setF({ ...f, description: v })} testId="task-desc" />
      <div>
        <label className="label">Property</label>
        <select data-testid="task-property" className="input" value={f.property_id} onChange={(e) => setF({ ...f, property_id: e.target.value })}>
          <option value="">— None —</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Due date" value={f.due_date} onChange={(v) => setF({ ...f, due_date: v })} testId="task-due" type="date" />
        <div>
          <label className="label">Priority</label>
          <select data-testid="task-priority" className="input" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>
            <option value="urgent">Urgent</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
        <button type="submit" data-testid="task-submit" className="btn-primary">Create</button>
      </div>
    </form>
  );
}
