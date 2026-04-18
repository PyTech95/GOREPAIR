import React, { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, Users as UsersIcon } from "lucide-react";

const SKILL_OPTIONS = ["AC", "Washing Machine", "Fridge", "TV", "Microwave", "Water Purifier", "Geyser"];

export default function UsersPage() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [tab, setTab] = useState(user?.role === "manager" ? "technician" : "manager");
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get("/users", { params: user?.role === "manager" ? {} : { role: tab } });
      setList(data);
    } catch (e) { toast.error(formatApiError(e)); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab]);

  return (
    <div className="space-y-6" data-testid="users-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="gr-overline">Team</div>
          <h1 className="font-display font-black text-4xl tracking-tighter mt-1">
            {user?.role === "manager" ? "Technicians" : "Users"}
          </h1>
        </div>
        <button className="gr-btn gr-btn-primary" onClick={() => setShowAdd(true)} data-testid="add-user-btn">
          <Plus size={15} /> Add {user?.role === "manager" ? "technician" : tab}
        </button>
      </div>

      {user?.role === "super_admin" && (
        <div className="flex gap-2 border-b border-neutral-200">
          {["manager", "technician"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-semibold uppercase tracking-wider border-b-2 -mb-px ${
                tab === t ? "border-[#ff5f1f] text-neutral-900" : "border-transparent text-neutral-500"
              }`}
              data-testid={`tab-${t}`}
            >
              {t}s
            </button>
          ))}
        </div>
      )}

      <div className="gr-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="gr-table">
            <thead><tr><th>Name</th><th>Email</th><th>City</th><th>Phone</th>
              {tab === "manager" ? <th>Wallet</th> : <><th>Skills</th><th>Rating</th><th>Jobs</th></>}
              <th>Status</th></tr></thead>
            <tbody>
              {list.length === 0 && <tr><td colSpan={8} className="text-center py-10 text-neutral-400"><UsersIcon className="mx-auto mb-2 text-neutral-300" /> No users</td></tr>}
              {list.map((u) => (
                <tr key={u.id} data-testid={`user-row-${u.id}`}>
                  <td className="font-semibold">{u.name}</td>
                  <td className="text-neutral-600 font-mono text-xs">{u.email}</td>
                  <td>{u.city || "—"}</td>
                  <td className="font-mono text-xs">{u.phone || "—"}</td>
                  {tab === "manager" ? (
                    <td className="font-mono font-bold text-[#ff5f1f]">{u.wallet_balance ?? 0} pts</td>
                  ) : (
                    <>
                      <td className="text-xs">{(u.skills || []).join(", ") || "—"}</td>
                      <td className="font-mono">★ {u.rating ?? "—"}</td>
                      <td className="font-mono">{u.jobs_completed ?? 0}</td>
                    </>
                  )}
                  <td>{u.active ? <span className="gr-badge completed">Active</span> : <span className="gr-badge cancelled">Off</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && <AddUserDialog
        role={user?.role === "manager" ? "technician" : tab}
        onClose={() => setShowAdd(false)}
        onCreated={() => { setShowAdd(false); load(); }}
      />}
    </div>
  );
}

function AddUserDialog({ role, onClose, onCreated }) {
  const [form, setForm] = useState({ email: "", password: "", name: "", phone: "", city: "", skills: [] });
  const [saving, setSaving] = useState(false);
  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const toggleSkill = (s) => setForm((p) => ({ ...p, skills: p.skills.includes(s) ? p.skills.filter((x) => x !== s) : [...p.skills, s] }));
  const submit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await api.post("/users", { ...form, role });
      toast.success(`${role} created`); onCreated();
    } catch (err) { toast.error(formatApiError(err)); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose} data-testid="add-user-dialog">
      <div className="bg-white w-full max-w-lg gr-sharp" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div className="font-display font-bold text-lg capitalize">New {role}</div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-900 text-sm">Close</button>
        </div>
        <form onSubmit={submit} className="p-5 grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="gr-label">Name</label><input required className="gr-input" value={form.name} onChange={f("name")} data-testid="u-name" /></div>
          <div><label className="gr-label">Email</label><input required type="email" className="gr-input" value={form.email} onChange={f("email")} data-testid="u-email" /></div>
          <div><label className="gr-label">Password</label><input required type="password" minLength={6} className="gr-input" value={form.password} onChange={f("password")} data-testid="u-password" /></div>
          <div><label className="gr-label">Phone</label><input className="gr-input" value={form.phone} onChange={f("phone")} data-testid="u-phone" /></div>
          <div><label className="gr-label">City</label><input className="gr-input" value={form.city} onChange={f("city")} data-testid="u-city" /></div>
          {role === "technician" && (
            <div className="col-span-2">
              <label className="gr-label">Skills</label>
              <div className="flex flex-wrap gap-2">
                {SKILL_OPTIONS.map((s) => (
                  <button type="button" key={s} onClick={() => toggleSkill(s)}
                    className={`gr-badge cursor-pointer ${form.skills.includes(s) ? "assigned_technician" : "new"}`}
                    data-testid={`skill-${s.replace(/ /g, "-")}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="col-span-2 flex justify-end gap-2 pt-2">
            <button type="button" className="gr-btn gr-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={saving} className="gr-btn gr-btn-primary" data-testid="u-submit">{saving ? "Saving…" : "Create"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
