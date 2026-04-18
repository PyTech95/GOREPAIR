import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowLeft, Sparkles, UserCheck, Star, FileDown, ImagePlus, X as XIcon } from "lucide-react";
import { API } from "@/lib/api";

export default function LeadDetailPage() {
  const { lid } = useParams();
  const { user } = useAuth();
  const [lead, setLead] = useState(null);
  const [managers, setManagers] = useState([]);
  const [techs, setTechs] = useState([]);
  const [mgrPick, setMgrPick] = useState("");
  const [techPick, setTechPick] = useState("");
  const [suggestion, setSuggestion] = useState(null);
  const [sugLoading, setSugLoading] = useState(false);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  const [estCost, setEstCost] = useState("");
  const [finalCost, setFinalCost] = useState("");
  const [rating, setRating] = useState(5);
  const [ratingComment, setRatingComment] = useState("");

  const load = async () => {
    try {
      const { data } = await api.get(`/leads/${lid}`);
      setLead(data);
      setStatus(data.status);
      setEstCost(data.estimated_cost || "");
      setFinalCost(data.final_cost || "");
    } catch (e) { toast.error(formatApiError(e)); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [lid]);

  useEffect(() => {
    if (user?.role === "super_admin") {
      api.get("/users", { params: { role: "manager" } }).then((r) => setManagers(r.data)).catch(() => {});
    }
    if (user?.role === "manager" || user?.role === "super_admin") {
      api.get("/users", { params: { role: "technician" } }).then((r) => setTechs(r.data)).catch(() => {});
    }
  }, [user]);

  if (!lead) return <div className="text-neutral-400 text-sm">Loading…</div>;

  const assignManager = async () => {
    if (!mgrPick) return toast.error("Pick a manager");
    try { await api.post(`/leads/${lid}/assign-manager`, { manager_id: mgrPick }); toast.success("Assigned to manager"); load(); }
    catch (e) { toast.error(formatApiError(e)); }
  };
  const assignTech = async () => {
    if (!techPick) return toast.error("Pick a technician");
    try { await api.post(`/leads/${lid}/assign-technician`, { technician_id: techPick }); toast.success("Assigned to technician"); load(); }
    catch (e) { toast.error(formatApiError(e)); }
  };
  const suggestAI = async () => {
    setSugLoading(true);
    try { const { data } = await api.post(`/leads/${lid}/ai-suggest`); setSuggestion(data); }
    catch (e) { toast.error(formatApiError(e)); }
    finally { setSugLoading(false); }
  };
  const updateStatus = async () => {
    try {
      await api.post(`/leads/${lid}/status`, {
        status,
        note: note || undefined,
        estimated_cost: estCost ? parseFloat(estCost) : undefined,
        final_cost: finalCost ? parseFloat(finalCost) : undefined,
      });
      toast.success("Status updated"); setNote(""); load();
    } catch (e) { toast.error(formatApiError(e)); }
  };
  const addNote = async () => {
    if (!note) return;
    try { await api.post(`/leads/${lid}/notes`, { text: note }); toast.success("Note added"); setNote(""); load(); }
    catch (e) { toast.error(formatApiError(e)); }
  };
  const rate = async () => {
    try { await api.post(`/leads/${lid}/rating`, { stars: rating, comment: ratingComment }); toast.success("Rated"); load(); }
    catch (e) { toast.error(formatApiError(e)); }
  };

  const mgr = managers.find((m) => m.id === lead.manager_id);
  const tech = techs.find((t) => t.id === lead.technician_id);
  const canRate = user?.role !== "technician" && lead.status === "completed" && !lead.rating;
  const canInvoice = lead.status === "completed" && lead.final_cost;

  const downloadInvoice = async () => {
    try {
      const token = localStorage.getItem("gr_token");
      const res = await fetch(`${API}/leads/${lid}/invoice`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to download invoice");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `GoRepair_Invoice_${lid.slice(0, 8)}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success("Invoice downloaded");
    } catch (e) { toast.error(e.message || "Download failed"); }
  };

  const uploadImage = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const token = localStorage.getItem("gr_token");
      const res = await fetch(`${API}/leads/${lid}/attachments`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || "Upload failed"); }
      toast.success("Photo uploaded");
      load();
    } catch (e) { toast.error(e.message || "Upload failed"); }
  };

  return (
    <div className="space-y-6" data-testid="lead-detail">
      <Link to="/leads" className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900"><ArrowLeft size={14} /> Back to leads</Link>

      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="gr-overline">Lead · {lead.appliance_type}</div>
          <h1 className="font-display font-black text-4xl tracking-tighter mt-1">{lead.customer_name}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`gr-badge ${lead.status}`}>{lead.status.replace("_", " ")}</span>
            <span className={`gr-badge ${lead.priority}`}>{lead.priority} priority</span>
            <span className="gr-badge new">{lead.source}</span>
          </div>
        </div>
        {lead.cost_points > 0 && (
          <div className="gr-card gr-metric min-w-[180px]">
            <div className="gr-overline">Points spent</div>
            <div className="font-display font-black text-2xl mt-1">{lead.cost_points}</div>
          </div>
        )}
        {canInvoice && (
          <button className="gr-btn gr-btn-outline" onClick={downloadInvoice} data-testid="invoice-download-btn">
            <FileDown size={15} /> Download GST invoice
          </button>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="gr-card">
            <div className="gr-overline mb-3">Customer details</div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><div className="gr-label">Phone</div><div className="font-mono">{lead.phone}</div></div>
              <div><div className="gr-label">City</div><div>{lead.city}</div></div>
              <div className="col-span-2"><div className="gr-label">Address</div><div>{lead.address || "—"}</div></div>
              <div className="col-span-2"><div className="gr-label">Issue</div><div className="text-neutral-700">{lead.issue}</div></div>
            </div>
          </div>

          {/* AI smart assign */}
          {(user?.role === "manager" || user?.role === "super_admin") && lead.status !== "completed" && (
            <div className="gr-ai-panel" data-testid="ai-panel">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-[#002fa7]" />
                  <div>
                    <div className="gr-overline text-[#002fa7]">AI DISPATCH</div>
                    <div className="font-display font-bold">Suggest best technician</div>
                  </div>
                </div>
                <button className="gr-btn gr-btn-outline" onClick={suggestAI} disabled={sugLoading} data-testid="ai-suggest-btn">
                  {sugLoading ? "Thinking…" : "Run smart assign"}
                </button>
              </div>
              {suggestion && (
                <div className="mt-4 space-y-2">
                  {suggestion.suggestions.length === 0 && <div className="text-sm text-neutral-500">No candidates.</div>}
                  {suggestion.suggestions.map((s) => (
                    <div key={s.technician_id} className="flex items-center justify-between border border-neutral-200 px-3 py-2" data-testid={`ai-suggestion-${s.technician_id}`}>
                      <div>
                        <div className="font-semibold">{s.name} <span className="text-xs text-neutral-500 font-normal">· {s.city}</span></div>
                        <div className="text-xs text-neutral-500">{s.reason}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="font-mono text-xs text-[#002fa7] font-bold">{s.score}</div>
                        <button className="gr-btn gr-btn-primary text-xs py-1.5 px-3" onClick={() => { setTechPick(s.technician_id); }}>
                          Pick
                        </button>
                      </div>
                    </div>
                  ))}
                  {suggestion.source && (
                    <div className="text-[11px] text-neutral-400 font-mono mt-2">source: {suggestion.source}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Assign / Status */}
          {user?.role === "super_admin" && !lead.manager_id && (
            <div className="gr-card">
              <div className="gr-overline mb-3">Assign to manager</div>
              <div className="flex gap-2">
                <select className="gr-input flex-1" value={mgrPick} onChange={(e) => setMgrPick(e.target.value)} data-testid="manager-select">
                  <option value="">Select manager…</option>
                  {managers.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.city} · {m.wallet_balance}pts</option>)}
                </select>
                <button className="gr-btn gr-btn-primary" onClick={assignManager} data-testid="assign-manager-btn"><UserCheck size={14} /> Assign</button>
              </div>
              <div className="text-xs text-neutral-500 mt-2">Cost-per-lead will be debited from the manager's wallet.</div>
            </div>
          )}

          {(user?.role === "manager" || user?.role === "super_admin") && lead.manager_id && !lead.technician_id && (
            <div className="gr-card">
              <div className="gr-overline mb-3">Assign to technician</div>
              <div className="flex gap-2">
                <select className="gr-input flex-1" value={techPick} onChange={(e) => setTechPick(e.target.value)} data-testid="tech-select">
                  <option value="">Select technician…</option>
                  {techs.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.city} · ★{t.rating}</option>)}
                </select>
                <button className="gr-btn gr-btn-primary" onClick={assignTech} data-testid="assign-tech-btn"><UserCheck size={14} /> Assign</button>
              </div>
            </div>
          )}

          {lead.technician_id && (
            <div className="gr-card">
              <div className="gr-overline mb-3">Job status</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="gr-label">Status</label>
                  <select className="gr-input" value={status} onChange={(e) => setStatus(e.target.value)} data-testid="status-select">
                    <option value="assigned_technician">Assigned</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="invalid">Invalid (refund 80%)</option>
                  </select>
                </div>
                <div>
                  <label className="gr-label">Estimated cost ₹</label>
                  <input className="gr-input" type="number" value={estCost} onChange={(e) => setEstCost(e.target.value)} data-testid="est-cost-input" />
                </div>
                <div>
                  <label className="gr-label">Final cost ₹</label>
                  <input className="gr-input" type="number" value={finalCost} onChange={(e) => setFinalCost(e.target.value)} data-testid="final-cost-input" />
                </div>
              </div>
              <div className="mt-3">
                <label className="gr-label">Note (optional)</label>
                <textarea rows={2} className="gr-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened on-site…" data-testid="status-note-input" />
              </div>
              <div className="mt-3 flex justify-end">
                <button className="gr-btn gr-btn-primary" onClick={updateStatus} data-testid="update-status-btn">Save update</button>
              </div>
            </div>
          )}

          {/* Rating */}
          {canRate && (
            <div className="gr-card">
              <div className="gr-overline mb-3">Rate this job</div>
              <div className="flex items-center gap-1 mb-3">
                {[1,2,3,4,5].map((n) => (
                  <button key={n} onClick={() => setRating(n)} data-testid={`star-${n}`}>
                    <Star size={22} className={n <= rating ? "fill-[#facc15] text-[#facc15]" : "text-neutral-300"} />
                  </button>
                ))}
              </div>
              <input className="gr-input mb-3" placeholder="Comment (optional)" value={ratingComment} onChange={(e) => setRatingComment(e.target.value)} data-testid="rating-comment" />
              <button className="gr-btn gr-btn-primary" onClick={rate} data-testid="submit-rating">Submit rating</button>
            </div>
          )}

          {lead.rating && (
            <div className="gr-card"><div className="gr-overline mb-1">Customer rating</div>
              <div className="flex items-center gap-2">
                {[1,2,3,4,5].map((n) => <Star key={n} size={18} className={n <= lead.rating ? "fill-[#facc15] text-[#facc15]" : "text-neutral-300"} />)}
                <span className="font-semibold">{lead.rating}/5</span>
              </div>
              {lead.rating_comment && <div className="text-sm text-neutral-600 mt-2">"{lead.rating_comment}"</div>}
            </div>
          )}

          {/* Photos / Attachments */}
          {(user?.role === "technician" || user?.role === "manager" || user?.role === "super_admin") && (
            <div className="gr-card">
              <div className="flex items-center justify-between mb-3">
                <div className="gr-overline">Job photos</div>
                {(user?.role === "technician" || user?.role === "manager") && (
                  <label className="gr-btn gr-btn-outline cursor-pointer" data-testid="upload-photo-btn">
                    <ImagePlus size={14} /> Upload
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ""; }}
                      data-testid="photo-file-input"
                    />
                  </label>
                )}
              </div>
              {(lead.attachments || []).length === 0 ? (
                <div className="text-sm text-neutral-400">No photos yet. Field technicians can upload up to 8 MB per image.</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" data-testid="attachments-grid">
                  {(lead.attachments || []).map((a) => (
                    <a key={a.id} href={`${process.env.REACT_APP_BACKEND_URL}${a.url}`} target="_blank" rel="noreferrer"
                      className="block border border-neutral-200 overflow-hidden hover:border-[#ff5f1f] transition-colors"
                      data-testid={`attachment-${a.id}`}>
                      <img src={`${process.env.REACT_APP_BACKEND_URL}${a.url}`} alt={a.filename} className="w-full h-28 object-cover" />
                      <div className="px-2 py-1 text-[10px] font-mono text-neutral-500 truncate">{a.by_name} · {new Date(a.at).toLocaleDateString("en-IN")}</div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="gr-card">
            <div className="gr-overline mb-3">Activity & notes</div>
            {(lead.notes || []).length === 0 && <div className="text-sm text-neutral-400">No notes yet.</div>}
            <div className="space-y-3">
              {(lead.notes || []).slice().reverse().map((n) => (
                <div key={n.id} className="border-l-2 border-[#ff5f1f] pl-3 py-1">
                  <div className="text-xs text-neutral-500"><span className="font-semibold text-neutral-800">{n.by_name}</span> · {new Date(n.at).toLocaleString("en-IN")}</div>
                  <div className="text-sm mt-0.5">{n.text}</div>
                </div>
              ))}
            </div>
            {(user?.role === "manager" || user?.role === "technician") && (
              <div className="mt-4 flex gap-2">
                <input className="gr-input flex-1" placeholder="Add a note…" value={note} onChange={(e) => setNote(e.target.value)} data-testid="note-input" />
                <button className="gr-btn gr-btn-outline" onClick={addNote} data-testid="add-note-btn">Add</button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="gr-card">
            <div className="gr-overline mb-2">Pipeline</div>
            <ol className="space-y-2 text-sm">
              <Step on={true} label="Lead captured" sub={new Date(lead.created_at).toLocaleString("en-IN")} />
              <Step on={!!lead.assigned_manager_at} label={`Assigned to ${mgr?.name || "manager"}`} sub={lead.assigned_manager_at && new Date(lead.assigned_manager_at).toLocaleString("en-IN")} />
              <Step on={!!lead.assigned_technician_at} label={`Assigned to ${tech?.name || "technician"}`} sub={lead.assigned_technician_at && new Date(lead.assigned_technician_at).toLocaleString("en-IN")} />
              <Step on={lead.status === "in_progress" || lead.status === "completed"} label="In progress" />
              <Step on={lead.status === "completed"} label="Completed" sub={lead.completed_at && new Date(lead.completed_at).toLocaleString("en-IN")} />
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({ on, label, sub }) {
  return (
    <li className="flex items-start gap-3">
      <div className={`mt-1 h-2.5 w-2.5 rounded-full ${on ? "bg-[#ff5f1f]" : "bg-neutral-300"}`} />
      <div>
        <div className={`text-sm ${on ? "font-semibold text-neutral-900" : "text-neutral-400"}`}>{label}</div>
        {sub && <div className="text-[11px] text-neutral-500 font-mono">{sub}</div>}
      </div>
    </li>
  );
}
