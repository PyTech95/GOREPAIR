import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, Search, Filter, Upload, FileText, Users as UsersIcon, CheckSquare, Square, X, Coins, Lock } from "lucide-react";

const APPLIANCES = ["AC", "Washing Machine", "Fridge", "TV", "Microwave", "Water Purifier", "Geyser", "Other"];
const SOURCES = ["website", "facebook", "google", "whatsapp", "manual", "referral", "justdial"];

export default function LeadsPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [cities, setCities] = useState([]);
  const [settings, setSettings] = useState(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [showBulkAssign, setShowBulkAssign] = useState(false);

  const isAdmin = user?.role === "super_admin";

  const load = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter !== "all") params.status = statusFilter;
      if (sourceFilter !== "all") params.source = sourceFilter;
      if (cityFilter !== "all") params.city = cityFilter;
      const { data } = await api.get("/leads", { params });
      setLeads(data);
      setSelected(new Set());
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    api.get("/leads/cities").then((r) => setCities(r.data)).catch(() => {});
    api.get("/settings").then((r) => setSettings(r.data)).catch(() => {});
  }, []);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [statusFilter, sourceFilter, cityFilter]);

  const filtered = leads.filter((l) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return [l.customer_name, l.phone, l.city, l.appliance_type, l.issue].some((v) => (v || "").toLowerCase().includes(q));
  });

  // Only unassigned leads can be bulk-assigned to a manager
  const selectableIds = filtered.filter((l) => !l.manager_id).map((l) => l.id);
  const unassignedCount = leads.filter((l) => !l.manager_id).length;
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(selectableIds));
  };
  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());
  const showOnlyUnassigned = () => setStatusFilter("new");

  return (
    <div className="space-y-6" data-testid="leads-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="gr-overline">Pipeline</div>
          <h1 className="font-display font-black text-4xl tracking-tighter mt-1">Leads</h1>
          <p className="text-neutral-500 text-sm mt-1">
            {filtered.length} of {leads.length} leads
            {isAdmin && (
              <>
                {" · "}
                <button
                  onClick={showOnlyUnassigned}
                  className="text-[#ff5f1f] font-semibold hover:underline"
                  data-testid="show-unassigned-link"
                >
                  {unassignedCount} unassigned
                </button>
              </>
            )}
          </p>
        </div>
        {(user?.role === "super_admin" || user?.role === "manager") && (
          <div className="flex gap-2 items-center">
            {isAdmin && settings && (
              <Link
                to="/console/settings"
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 border border-neutral-200 hover:border-[#ff5f1f] transition-colors gr-sharp"
                title="Configure default cost per lead"
                data-testid="cost-per-lead-pill"
              >
                <Coins size={13} className="text-[#ff5f1f]" />
                <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-500">Cost/lead</span>
                <span className="font-bold text-sm">{settings.cost_per_lead}</span>
                <span className="text-[10px] text-neutral-400">pts</span>
              </Link>
            )}
            {user?.role === "super_admin" && (
              <button className="gr-btn gr-btn-outline" onClick={() => setShowImport(true)} data-testid="import-csv-btn">
                <Upload size={15} /> Import CSV
              </button>
            )}
            <button className="gr-btn gr-btn-primary" onClick={() => setShowCreate(true)} data-testid="create-lead-btn">
              <Plus size={15} /> {user?.role === "manager" ? "New job" : "New lead"}
            </button>
          </div>
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
            <select className="gr-input" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} data-testid="filter-city">
              <option value="all">All cities</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      {isAdmin && !loading && filtered.length > 0 && selectableIds.length === 0 && (
        <div className="gr-card flex items-center gap-3 border-l-4 border-l-[#facc15] bg-yellow-50/40" data-testid="no-unassigned-banner">
          <Lock size={16} className="text-yellow-700" />
          <div className="flex-1 text-sm">
            <span className="font-semibold">All leads in view are already assigned.</span>{" "}
            <span className="text-neutral-600">Use the status filter to see new (unassigned) leads, or </span>
            <button onClick={showOnlyUnassigned} className="text-[#ff5f1f] font-semibold hover:underline">switch to unassigned only</button>.
          </div>
        </div>
      )}

      <div className="gr-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="gr-table">
            <thead>
              <tr>
                {isAdmin && (
                  <th style={{ width: 36 }}>
                    <button onClick={toggleAll} className="text-neutral-500 hover:text-[#ff5f1f]" data-testid="select-all-leads" aria-label="Select all unassigned">
                      {allSelected ? <CheckSquare size={16} className="text-[#ff5f1f]" /> : <Square size={16} />}
                    </button>
                  </th>
                )}
                <th>Customer</th><th>Phone</th><th>Appliance</th><th>City</th>
                <th>Priority</th><th>Source</th><th>Status</th><th>Created</th><th></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={isAdmin ? 10 : 9} className="text-center py-8 text-neutral-400">Loading…</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={isAdmin ? 10 : 9} className="text-center py-10 text-neutral-400">No leads found</td></tr>
              )}
              {filtered.map((l) => {
                const canSelect = isAdmin && !l.manager_id;
                const isSel = selected.has(l.id);
                return (
                  <tr
                    key={l.id}
                    data-testid={`lead-row-${l.id}`}
                    className={isSel ? "bg-orange-50/60" : ""}
                  >
                    {isAdmin && (
                      <td>
                        {canSelect ? (
                          <button onClick={() => toggleOne(l.id)} aria-label="Select lead" data-testid={`select-${l.id}`}>
                            {isSel ? <CheckSquare size={16} className="text-[#ff5f1f]" /> : <Square size={16} className="text-neutral-400 hover:text-[#ff5f1f]" />}
                          </button>
                        ) : (
                          <span
                            className="inline-flex items-center justify-center w-4 h-4 text-neutral-300"
                            title="Already assigned — cannot bulk-reassign"
                          >
                            <Lock size={12} />
                          </span>
                        )}
                      </td>
                    )}
                    <td className="font-semibold">{l.customer_name}</td>
                    <td className="font-mono text-xs">{l.phone}</td>
                    <td>{l.appliance_type}</td>
                    <td className="text-neutral-600">{l.city}</td>
                    <td><span className={`gr-badge ${l.priority}`}>{l.priority}</span></td>
                    <td><span className="gr-badge new">{l.source}</span></td>
                    <td><span className={`gr-badge ${l.status}`}>{l.status.replace("_", " ")}</span></td>
                    <td className="text-neutral-500 text-xs">{new Date(l.created_at).toLocaleDateString("en-IN")}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        {l.status === "completed" && l.final_cost && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#16a34a] px-1.5 py-0.5 border border-green-200 bg-green-50" title="GST invoice ready">
                            <FileText size={10} /> Invoice
                          </span>
                        )}
                        <Link to={`/console/leads/${l.id}`} className="text-[#ff5f1f] font-semibold text-xs hover:underline" data-testid={`open-lead-${l.id}`}>
                          Open →
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && <CreateLeadDialog onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
      {showImport && <ImportCsvDialog onClose={() => setShowImport(false)} onDone={() => { setShowImport(false); load(); }} />}

      {isAdmin && selected.size > 0 && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-[#0a0a0a] text-white border border-[#ff5f1f] shadow-2xl gr-sharp flex items-center gap-4 px-4 py-3 gr-fade-in"
          data-testid="bulk-action-bar"
        >
          <button onClick={clearSelection} className="text-neutral-400 hover:text-white" aria-label="Clear selection">
            <X size={16} />
          </button>
          <div className="font-mono text-sm">
            <span className="text-[#ff5f1f] font-bold">{selected.size}</span>{" "}
            <span className="text-neutral-400">lead{selected.size === 1 ? "" : "s"} selected</span>
          </div>
          <button
            className="gr-btn gr-btn-primary"
            onClick={() => setShowBulkAssign(true)}
            data-testid="bulk-assign-btn"
          >
            <UsersIcon size={14} /> Assign to manager
          </button>
        </div>
      )}
      {showBulkAssign && (
        <BulkAssignDialog
          ids={Array.from(selected)}
          onClose={() => setShowBulkAssign(false)}
          onDone={() => { setShowBulkAssign(false); load(); }}
        />
      )}
    </div>
  );
}

function BulkAssignDialog({ ids, onClose, onDone }) {
  const [managers, setManagers] = useState([]);
  const [pick, setPick] = useState("");
  const [settings, setSettings] = useState(null);
  const [costPer, setCostPer] = useState(200);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/users", { params: { role: "manager" } }).then((r) => setManagers(r.data)).catch(() => {});
    api.get("/settings").then((r) => { setSettings(r.data); setCostPer(r.data.cost_per_lead ?? 200); }).catch(() => {});
  }, []);

  const totalCost = ids.length * (Number(costPer) || 0);
  const picked = managers.find((m) => m.id === pick);
  const balance = picked?.wallet_balance ?? 0;
  const insufficient = picked && balance < totalCost;
  const defaultCost = settings?.cost_per_lead ?? 200;
  const isCustom = Number(costPer) !== defaultCost;

  const submit = async () => {
    if (!pick) return toast.error("Pick a manager");
    setBusy(true);
    try {
      const payload = { lead_ids: ids, manager_id: pick };
      if (isCustom) payload.cost_per_lead = Number(costPer);
      const { data } = await api.post("/leads/bulk-assign-manager", payload);
      if (data.skipped > 0) {
        toast.warning(`${data.assigned} assigned · ${data.skipped} skipped · ${data.total_debited} pts debited`);
      } else {
        toast.success(`${data.assigned} leads assigned · ${data.total_debited} pts debited @ ${data.cost_per_lead}/lead`);
      }
      onDone();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose} data-testid="bulk-assign-dialog">
      <div className="bg-white w-full max-w-md gr-sharp" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div>
            <div className="font-display font-bold text-lg">Bulk assign</div>
            <div className="text-xs text-neutral-500 mt-0.5">{ids.length} lead{ids.length === 1 ? "" : "s"} selected</div>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-900 text-sm">Close</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="gr-label">Assign to manager</label>
            <select className="gr-input" value={pick} onChange={(e) => setPick(e.target.value)} data-testid="bulk-manager-select">
              <option value="">Select manager…</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {m.city || "—"} · {m.wallet_balance ?? 0} pts
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="gr-label flex items-center justify-between">
              <span>Cost per lead (points)</span>
              {isCustom && (
                <button
                  onClick={() => setCostPer(defaultCost)}
                  className="text-[10px] font-mono text-[#ff5f1f] hover:underline normal-case tracking-normal"
                  data-testid="reset-cost-btn"
                >
                  reset to default ({defaultCost})
                </button>
              )}
            </label>
            <div className="flex items-center gap-2">
              <Coins size={16} className="text-[#ff5f1f] shrink-0" />
              <input
                type="number"
                min="0"
                className="gr-input flex-1"
                value={costPer}
                onChange={(e) => setCostPer(e.target.value)}
                data-testid="bulk-cost-input"
              />
              <div className="flex gap-1">
                {[10, 15, 25, 100, 200].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setCostPer(v)}
                    className={`px-2 py-1 text-[11px] font-mono border ${Number(costPer) === v ? "border-[#ff5f1f] bg-orange-50 text-[#ff5f1f]" : "border-neutral-200 hover:border-neutral-400"}`}
                    data-testid={`cost-preset-${v}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-[11px] text-neutral-500 mt-1">
              {isCustom
                ? `Override active — default cost is ${defaultCost} pts. Change permanently in Settings.`
                : "Using the global default. Change in Settings, or override here for this batch only."}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="gr-card p-2">
              <div className="gr-overline text-[10px]">Leads</div>
              <div className="font-display font-black text-xl">{ids.length}</div>
            </div>
            <div className="gr-card p-2">
              <div className="gr-overline text-[10px]">Total cost</div>
              <div className="font-display font-black text-xl text-[#ff5f1f]">{totalCost}</div>
            </div>
            <div className={`gr-card p-2 ${insufficient ? "border-red-300 bg-red-50/40" : ""}`}>
              <div className="gr-overline text-[10px]">Mgr wallet</div>
              <div className={`font-display font-black text-xl ${insufficient ? "text-red-600" : ""}`}>{picked ? balance : "—"}</div>
            </div>
          </div>
          {insufficient && (
            <div className="text-xs text-red-600 font-mono">
              Manager needs {totalCost - balance} more pts. Credit their wallet first.
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button className="gr-btn gr-btn-ghost" onClick={onClose}>Cancel</button>
            <button
              className="gr-btn gr-btn-primary"
              onClick={submit}
              disabled={busy || !pick || insufficient || !(Number(costPer) >= 0)}
              data-testid="bulk-assign-confirm"
            >
              {busy ? "Assigning…" : `Assign · ${totalCost} pts`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ImportCsvDialog({ onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    if (!file) return toast.error("Pick a CSV file");
    setBusy(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const token = localStorage.getItem("gr_token");
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/leads/bulk-import`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Import failed");
      setResult(data);
      toast.success(`Imported ${data.created} leads (${data.skipped} skipped)`);
    } catch (err) { toast.error(err.message || "Import failed"); }
    finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose} data-testid="import-csv-dialog">
      <div className="bg-white w-full max-w-lg gr-sharp" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div className="font-display font-bold text-lg">Bulk import leads (CSV)</div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-900 text-sm">Close</button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="text-xs text-neutral-500 leading-relaxed">
            Expected columns (header optional):<br />
            <code className="font-mono bg-neutral-100 px-2 py-0.5 inline-block mt-1">customer_name, phone, city, address, appliance_type, issue, priority, source</code>
          </div>
          <label className="block border-2 border-dashed border-neutral-300 hover:border-[#ff5f1f] transition-colors p-8 text-center cursor-pointer" data-testid="csv-dropzone">
            <Upload size={22} className="mx-auto mb-2 text-neutral-400" />
            <div className="text-sm font-semibold">{file ? file.name : "Click to pick a .csv file"}</div>
            {file && <div className="text-[11px] text-neutral-500 mt-1">{Math.round(file.size / 1024)} KB</div>}
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => setFile(e.target.files?.[0])} data-testid="csv-file-input" />
          </label>
          {result && (
            <div className="gr-card p-3 text-sm bg-neutral-50">
              <div><b className="text-green-600">{result.created}</b> created, <b className="text-red-600">{result.skipped}</b> skipped</div>
              {result.errors?.length > 0 && (
                <details className="mt-1"><summary className="text-xs text-neutral-500 cursor-pointer">Errors</summary>
                  <ul className="text-[11px] font-mono text-neutral-500 mt-1 list-disc ml-4">{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
                </details>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="gr-btn gr-btn-ghost" onClick={onClose}>{result ? "Close" : "Cancel"}</button>
            {!result && (
              <button type="submit" disabled={busy} className="gr-btn gr-btn-primary" data-testid="csv-upload-btn">
                {busy ? "Uploading…" : "Upload"}
              </button>
            )}
            {result && (
              <button type="button" className="gr-btn gr-btn-primary" onClick={onDone}>Done</button>
            )}
          </div>
        </form>
      </div>
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
