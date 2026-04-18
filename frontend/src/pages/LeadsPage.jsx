import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, Search, Filter } from "lucide-react";

const APPLIANCES = ["AC", "Washing Machine", "Fridge", "TV", "Microwave", "Water Purifier", "Geyser", "Other"];
const SOURCES = ["website", "facebook", "google", "whatsapp", "manual", "referral", "justdial"];

export default function LeadsPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter !== "all") params.status = statusFilter;
      if (sourceFilter !== "all") params.source = sourceFilter;
      const { data } = await api.get("/leads", { params });
      setLeads(data);
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [statusFilter, sourceFilter]);

  const filtered = leads.filter((l) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return [l.customer_name, l.phone, l.city, l.appliance_type, l.issue].some((v) => (v || "").toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6" data-testid="leads-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="gr-overline">Pipeline</div>
          <h1 className="font-display font-black text-4xl tracking-tighter mt-1">Leads</h1>
          <p className="text-neutral-500 text-sm mt-1">{filtered.length} of {leads.length} leads</p>
        </div>
        {user?.role === "super_admin" && (
          <button className="gr-btn gr-btn-primary" onClick={() => setShowCreate(true)} data-testid="create-lead-btn">
            <Plus size={15} /> New lead
          </button>
        )}
      </div>

      <div className="gr-card">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              className="gr-input pl-9"
              placeholder="Search customer, phone, city…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              data-testid="leads-search"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-neutral-400" />
            <select className="gr-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} data-testid="filter-status">
              <option value="all">All statuses</option>
              <option value="new">New</option>
              <option value="assigned_manager">Assigned → Manager</option>
              <option value="assigned_technician">Assigned → Technician</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="invalid">Invalid</option>
            </select>
            <select className="gr-input" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} data-testid="filter-source">
              <option value="all">All sources</option>
              {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="gr-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="gr-table">
            <thead>
              <tr>
                <th>Customer</th><th>Phone</th><th>Appliance</th><th>City</th>
                <th>Priority</th><th>Source</th><th>Status</th><th>Created</th><th></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9} className="text-center py-8 text-neutral-400">Loading…</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={9} className="text-center py-10 text-neutral-400">No leads found</td></tr>
              )}
              {filtered.map((l) => (
                <tr key={l.id} data-testid={`lead-row-${l.id}`}>
                  <td className="font-semibold">{l.customer_name}</td>
                  <td className="font-mono text-xs">{l.phone}</td>
                  <td>{l.appliance_type}</td>
                  <td className="text-neutral-600">{l.city}</td>
                  <td><span className={`gr-badge ${l.priority}`}>{l.priority}</span></td>
                  <td><span className="gr-badge new">{l.source}</span></td>
                  <td><span className={`gr-badge ${l.status}`}>{l.status.replace("_", " ")}</span></td>
                  <td className="text-neutral-500 text-xs">{new Date(l.created_at).toLocaleDateString("en-IN")}</td>
                  <td>
                    <Link to={`/leads/${l.id}`} className="text-[#ff5f1f] font-semibold text-xs hover:underline" data-testid={`open-lead-${l.id}`}>
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && <CreateLeadDialog onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}

function CreateLeadDialog({ onClose, onCreated }) {
  const [form, setForm] = useState({
    customer_name: "", phone: "", address: "", city: "",
    appliance_type: "AC", issue: "", priority: "medium", source: "manual",
  });
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await api.post("/leads", form);
      toast.success("Lead created");
      onCreated();
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setSaving(false); }
  };
  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose} data-testid="create-lead-dialog">
      <div className="bg-white w-full max-w-lg gr-sharp" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div className="font-display font-bold text-lg">New lead</div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-900 text-sm">Close</button>
        </div>
        <form onSubmit={submit} className="p-5 grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="gr-label">Customer name</label>
            <input required className="gr-input" value={form.customer_name} onChange={f("customer_name")} data-testid="form-name" /></div>
          <div><label className="gr-label">Phone</label>
            <input required className="gr-input" value={form.phone} onChange={f("phone")} data-testid="form-phone" /></div>
          <div><label className="gr-label">City</label>
            <input required className="gr-input" value={form.city} onChange={f("city")} data-testid="form-city" /></div>
          <div className="col-span-2"><label className="gr-label">Address</label>
            <input className="gr-input" value={form.address} onChange={f("address")} data-testid="form-address" /></div>
          <div><label className="gr-label">Appliance</label>
            <select className="gr-input" value={form.appliance_type} onChange={f("appliance_type")} data-testid="form-appliance">
              {APPLIANCES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select></div>
          <div><label className="gr-label">Priority</label>
            <select className="gr-input" value={form.priority} onChange={f("priority")} data-testid="form-priority">
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
            </select></div>
          <div className="col-span-2"><label className="gr-label">Source</label>
            <select className="gr-input" value={form.source} onChange={f("source")} data-testid="form-source">
              {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select></div>
          <div className="col-span-2"><label className="gr-label">Issue</label>
            <textarea required rows={3} className="gr-input" value={form.issue} onChange={f("issue")} data-testid="form-issue" /></div>
          <div className="col-span-2 flex justify-end gap-2 pt-2">
            <button type="button" className="gr-btn gr-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={saving} className="gr-btn gr-btn-primary" data-testid="form-submit">
              {saving ? "Saving…" : "Create lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
