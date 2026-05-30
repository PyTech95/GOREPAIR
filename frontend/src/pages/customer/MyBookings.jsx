import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Calendar, MapPin, LogOut, FileText, Plus } from "lucide-react";

const STATUS_LABEL = {
  new: "Awaiting dispatch",
  assigned_manager: "Confirmed",
  assigned_technician: "Technician assigned",
  in_progress: "Service in progress",
  completed: "Completed",
  cancelled: "Cancelled",
  invalid: "Cancelled",
};

export default function MyBookings() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { nav("/customer/login"); return; }
    api.get("/customer/bookings").then((r) => setItems(r.data)).catch((e) => toast.error(formatApiError(e))).finally(() => setLoading(false));
  }, [user, nav]);

  const handleLogout = () => { logout(); nav("/"); };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-neutral-50" data-testid="my-bookings-page">
      <header className="border-b border-neutral-200 bg-white sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <ArrowLeft size={18} className="text-neutral-500" />
            <div className="font-display font-bold">My bookings</div>
          </Link>
          <div className="flex items-center gap-3">
            <div className="text-sm font-semibold hidden sm:block">{user.name}</div>
            <button onClick={handleLogout} className="text-neutral-500 hover:text-[#ff5f1f]" data-testid="customer-logout"><LogOut size={16} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-4">
        {loading && <div className="text-center py-12 text-sm text-neutral-400">Loading…</div>}
        {!loading && items.length === 0 && (
          <div className="bg-white p-10 text-center border border-neutral-200">
            <div className="font-display font-bold text-xl">No bookings yet</div>
            <div className="text-sm text-neutral-500 mt-1 mb-5">Book your first repair in under 90 seconds.</div>
            <Link to="/services" className="gr-btn gr-btn-primary" data-testid="empty-book-cta"><Plus size={14} /> Book a service</Link>
          </div>
        )}
        {items.map((b) => (
          <Link key={b.id} to={`/track/${b.id}`} className="block bg-white p-5 border border-neutral-200 hover:border-[#ff5f1f] hover:shadow-md transition-all" data-testid={`booking-${b.id}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-display font-bold text-lg leading-tight">{b.service_name || b.appliance_type}</div>
                <div className="text-xs text-neutral-500 mt-1 flex items-center gap-1 flex-wrap">
                  <Calendar size={11} /> {b.slot_date} · {b.slot_window} <span className="text-neutral-300">·</span>
                  <MapPin size={11} /> {b.city}
                </div>
              </div>
              <span className={`gr-badge ${b.status} shrink-0`}>{STATUS_LABEL[b.status] || b.status}</span>
            </div>
            <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between">
              <div className="font-display font-bold text-[#ff5f1f]">₹{b.final_cost || b.estimated_cost || "—"}</div>
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                {b.status === "completed" && b.final_cost && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#16a34a] px-1.5 py-0.5 border border-green-200 bg-green-50">
                    <FileText size={10} /> Invoice
                  </span>
                )}
                View details <ArrowRight size={12} />
              </div>
            </div>
          </Link>
        ))}

        {items.length > 0 && (
          <Link to="/services" className="gr-btn gr-btn-outline w-full py-3" data-testid="book-another-btn">
            <Plus size={14} /> Book another service
          </Link>
        )}
      </main>
    </div>
  );
}
