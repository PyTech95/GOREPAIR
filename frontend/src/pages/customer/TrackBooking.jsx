import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api, formatApiError, API } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowLeft, Phone, Star, Check, X, FileDown, MapPin, Calendar, Clock } from "lucide-react";

const STAGES = [
  { key: "confirmed", label: "Confirmed", match: (s) => ["new", "assigned_manager", "assigned_technician", "in_progress", "completed"].includes(s) },
  { key: "tech_assigned", label: "Technician assigned", match: (s) => ["assigned_technician", "in_progress", "completed"].includes(s) },
  { key: "in_progress", label: "Service in progress", match: (s) => ["in_progress", "completed"].includes(s) },
  { key: "done", label: "Completed", match: (s) => s === "completed" },
];

export default function TrackBooking() {
  const { bid } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [b, setB] = useState(null);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");

  const load = async () => {
    try { const { data } = await api.get(`/customer/bookings/${bid}`); setB(data); }
    catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); const id = setInterval(load, 15000); return () => clearInterval(id); /* eslint-disable-next-line */ }, [bid]);

  if (!user) { nav("/customer/login"); return null; }
  if (!b) return <div className="p-10 text-sm text-neutral-400">Loading…</div>;

  const cancel = async () => {
    if (!window.confirm("Cancel this booking?")) return;
    try { await api.post(`/customer/bookings/${bid}/cancel`, { reason: "" }); toast.success("Cancelled"); load(); }
    catch (e) { toast.error(formatApiError(e)); }
  };

  const rate = async () => {
    try { await api.post(`/customer/bookings/${bid}/rate`, { stars, comment }); toast.success("Thanks for rating!"); load(); }
    catch (e) { toast.error(formatApiError(e)); }
  };

  const downloadInvoice = async () => {
    try {
      const token = localStorage.getItem("gr_token");
      const res = await fetch(`${API}/leads/${bid}/invoice`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Invoice not available yet");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `GoRepair_${bid.slice(0,8)}.pdf`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch (e) { toast.error(e.message); }
  };

  const cancellable = !["completed", "cancelled", "invalid"].includes(b.status);
  const canInvoice = b.status === "completed" && b.final_cost;
  const canRate = b.status === "completed" && !b.rating;

  return (
    <div className="min-h-screen bg-neutral-50" data-testid="track-page">
      <header className="border-b border-neutral-200 bg-white sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/my-bookings" className="flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900">
            <ArrowLeft size={16} /> My bookings
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-5">
        {/* Service summary */}
        <div className="bg-white p-5 border border-neutral-200">
          <div className="gr-overline">{b.appliance_type}</div>
          <h1 className="font-display font-black text-2xl tracking-tighter mt-1">{b.service_name || b.issue}</h1>
          <div className="mt-3 text-xs text-neutral-500 space-y-1">
            <div className="flex items-center gap-1"><Calendar size={11} /> {b.slot_date} · {b.slot_window}</div>
            <div className="flex items-center gap-1"><MapPin size={11} /> {b.address || b.city}</div>
          </div>
        </div>

        {/* Progress tracker */}
        {b.status !== "cancelled" && b.status !== "invalid" && (
          <div className="bg-white p-5 border border-neutral-200">
            <div className="gr-overline mb-4">Status</div>
            <ol className="space-y-3">
              {STAGES.map((s, i) => {
                const done = s.match(b.status);
                const isLast = STAGES[i + 1] ? STAGES[i + 1].match(b.status) === false && done : done;
                return (
                  <li key={s.key} className="flex items-start gap-3">
                    <div className={`mt-0.5 h-5 w-5 rounded-full grid place-items-center text-[10px] font-bold ${done ? "bg-[#ff5f1f] text-white" : "bg-neutral-200 text-neutral-400"}`}>
                      {done ? <Check size={11} /> : i + 1}
                    </div>
                    <div>
                      <div className={`text-sm font-semibold ${done ? "text-neutral-900" : "text-neutral-400"}`}>{s.label}</div>
                      {isLast && done && <div className="text-xs text-neutral-500">In progress now</div>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {b.status === "cancelled" && (
          <div className="bg-red-50 border border-red-200 p-4 text-sm text-red-700" data-testid="cancelled-banner">
            This booking has been cancelled.
          </div>
        )}

        {/* Technician card */}
        {b.technician && (
          <div className="bg-white p-5 border border-neutral-200" data-testid="tech-card">
            <div className="gr-overline mb-3">Your technician</div>
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-[#ff5f1f] grid place-items-center text-white font-bold text-xl">
                {b.technician.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold">{b.technician.name}</div>
                <div className="text-xs text-neutral-500 flex items-center gap-2">
                  <span className="inline-flex items-center gap-0.5"><Star size={11} className="fill-[#facc15] text-[#facc15]" /> {b.technician.rating}</span>
                  <span>·</span>
                  <span>{b.technician.jobs_completed} jobs</span>
                </div>
              </div>
              {b.technician.phone && (
                <a href={`tel:${b.technician.phone}`} className="gr-btn gr-btn-primary text-xs" data-testid="call-tech">
                  <Phone size={13} /> Call
                </a>
              )}
            </div>
          </div>
        )}

        {/* Price */}
        <div className="bg-white p-5 border border-neutral-200">
          <div className="gr-overline mb-2">Bill</div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-neutral-500">{b.status === "completed" ? "Final amount" : "Estimated"}</div>
              <div className="font-display font-black text-3xl text-[#ff5f1f]">₹{b.final_cost || b.estimated_cost}</div>
            </div>
            {canInvoice && (
              <button onClick={downloadInvoice} className="gr-btn gr-btn-outline" data-testid="invoice-btn">
                <FileDown size={14} /> Invoice
              </button>
            )}
          </div>
        </div>

        {/* Rating */}
        {canRate && (
          <div className="bg-white p-5 border border-neutral-200" data-testid="rate-box">
            <div className="gr-overline mb-3">Rate your experience</div>
            <div className="flex items-center gap-1 mb-3">
              {[1,2,3,4,5].map((n) => (
                <button key={n} onClick={() => setStars(n)} data-testid={`star-${n}`}>
                  <Star size={28} className={n <= stars ? "fill-[#facc15] text-[#facc15]" : "text-neutral-300"} />
                </button>
              ))}
            </div>
            <input className="gr-input mb-3" placeholder="Comment (optional)" value={comment} onChange={(e) => setComment(e.target.value)} data-testid="rate-comment" />
            <button onClick={rate} className="gr-btn gr-btn-primary w-full" data-testid="submit-rate">Submit rating</button>
          </div>
        )}

        {b.rating && (
          <div className="bg-white p-5 border border-neutral-200">
            <div className="gr-overline mb-1">Your rating</div>
            <div className="flex items-center gap-1 mb-1">
              {[1,2,3,4,5].map((n) => <Star key={n} size={18} className={n <= b.rating ? "fill-[#facc15] text-[#facc15]" : "text-neutral-300"} />)}
            </div>
            {b.rating_comment && <div className="text-sm text-neutral-600 mt-1">"{b.rating_comment}"</div>}
          </div>
        )}

        {/* Cancel */}
        {cancellable && (
          <button onClick={cancel} className="gr-btn gr-btn-ghost w-full text-red-600 hover:bg-red-50" data-testid="cancel-btn">
            <X size={14} /> Cancel booking
          </button>
        )}
      </main>
    </div>
  );
}
