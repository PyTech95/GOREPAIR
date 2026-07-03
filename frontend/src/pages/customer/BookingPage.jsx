import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowLeft, MapPin, Calendar, Clock, Check, IndianRupee } from "lucide-react";
import { istDateISO, fmtSlotWindow } from "@/lib/date";

const SLOTS = ["08:00-10:00", "10:00-12:00", "12:00-14:00", "14:00-16:00", "16:00-18:00", "18:00-20:00"];

function nextNDays(n) {
  const days = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const iso = istDateISO(d);
    const label =
      i === 0
        ? "Today"
        : i === 1
        ? "Tomorrow"
        : d.toLocaleDateString("en-IN", {
            timeZone: "Asia/Kolkata",
            weekday: "short",
            day: "numeric",
            month: "short",
          });
    days.push({ iso, label });
  }
  return days;
}

export default function BookingPage() {
  const { sku } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [service, setService] = useState(null);
  const [step, setStep] = useState(1);
  const [date, setDate] = useState(nextNDays(1)[0].iso);
  const [slot, setSlot] = useState("");
  const [issue, setIssue] = useState("");
  const [addresses, setAddresses] = useState([]);
  const [addrPick, setAddrPick] = useState(null);
  const [newAddr, setNewAddr] = useState({ label: "Home", line1: "", line2: "", city: "", pincode: "" });
  const [submitting, setSubmitting] = useState(false);
  const days = nextNDays(7);

  useEffect(() => {
    api.get(`/catalog/service/${sku}`).then((r) => setService(r.data)).catch(() => { toast.error("Service not found"); nav("/services"); });
  }, [sku, nav]);

  useEffect(() => {
    if (user?.role === "customer") {
      api.get("/customer/addresses").then((r) => {
        setAddresses(r.data);
        if (r.data.length > 0) setAddrPick(r.data[0].id);
      }).catch(() => {});
    }
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center p-6 bg-white">
        <div className="max-w-sm text-center">
          <div className="font-display font-black text-3xl tracking-tighter mb-3">Login to book</div>
          <p className="text-sm text-neutral-500 mb-6">Quick phone signup — under 30 seconds.</p>
          <Link to={`/customer/login?next=/book/${sku}`} className="gr-btn gr-btn-primary w-full">Login or sign up</Link>
        </div>
      </div>
    );
  }
  if (!service) return <div className="p-10 text-sm text-neutral-400">Loading…</div>;
  const svc = service.service;

  const submit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        service_sku: sku, slot_date: date, slot_window: slot, issue_note: issue,
      };
      if (addrPick) payload.address_id = addrPick;
      else payload.address = newAddr;
      const { data } = await api.post("/customer/bookings", payload);
      toast.success("Booking confirmed!");
      nav(`/track/${data.id}`);
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setSubmitting(false); }
  };

  const canStep2 = date && slot;
  const canStep3 = addrPick || (newAddr.line1 && newAddr.city);

  return (
    <div className="min-h-screen bg-neutral-50" data-testid="booking-page">
      <header className="border-b border-neutral-200 bg-white sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button onClick={() => nav(-1)} className="flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900" data-testid="booking-back">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="text-xs font-mono text-neutral-400">Step {step} / 3</div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        <div className="bg-white p-5 border border-neutral-200">
          <div className="gr-overline">{service.category?.name}</div>
          <div className="font-display font-bold text-xl mt-1">{svc.name}</div>
          <div className="text-sm text-neutral-500 mt-1">{svc.desc}</div>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-neutral-100">
            <div className="font-display font-black text-2xl text-[#ff5f1f]">₹{svc.price}</div>
            <div className="text-xs text-neutral-500 flex items-center gap-1"><Clock size={12} /> ~{svc.duration}</div>
          </div>
        </div>

        {/* Step 1: Date & Slot */}
        {step === 1 && (
          <div className="bg-white p-5 border border-neutral-200 space-y-5" data-testid="step-slot">
            <div>
              <div className="gr-overline mb-2 flex items-center gap-1"><Calendar size={12} /> Choose a date</div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {days.map((d) => (
                  <button key={d.iso} onClick={() => setDate(d.iso)}
                    className={`shrink-0 px-4 py-3 border text-center min-w-[88px] ${date === d.iso ? "border-[#ff5f1f] bg-orange-50" : "border-neutral-200 hover:border-neutral-400"}`}
                    data-testid={`day-${d.iso}`}>
                    <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{d.label.split(",")[0]}</div>
                    {d.label.includes(",") && <div className="text-xs text-neutral-400 mt-0.5">{d.label.split(",")[1]}</div>}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="gr-overline mb-2 flex items-center gap-1"><Clock size={12} /> Choose a 2-hour slot</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SLOTS.map((s) => (
                  <button key={s} onClick={() => setSlot(s)}
                    className={`px-3 py-3 border font-mono text-sm ${slot === s ? "border-[#ff5f1f] bg-orange-50 text-[#ff5f1f] font-bold" : "border-neutral-200 hover:border-neutral-400"}`}
                    data-testid={`slot-${s}`}>
                    {fmtSlotWindow(s)}
                  </button>
                ))}
              </div>
            </div>
            <button disabled={!canStep2} onClick={() => setStep(2)} className="gr-btn gr-btn-primary w-full py-3" data-testid="next-to-step2">
              Continue
            </button>
          </div>
        )}

        {/* Step 2: Address */}
        {step === 2 && (
          <div className="bg-white p-5 border border-neutral-200 space-y-4" data-testid="step-address">
            <div className="gr-overline flex items-center gap-1"><MapPin size={12} /> Where should we come?</div>
            {addresses.length > 0 && (
              <div className="space-y-2">
                {addresses.map((a) => (
                  <button key={a.id} onClick={() => setAddrPick(a.id)}
                    className={`w-full text-left p-3 border ${addrPick === a.id ? "border-[#ff5f1f] bg-orange-50" : "border-neutral-200 hover:border-neutral-400"}`}
                    data-testid={`addr-${a.id}`}>
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-sm">{a.label}</div>
                      {addrPick === a.id && <Check size={14} className="text-[#ff5f1f]" />}
                    </div>
                    <div className="text-xs text-neutral-500 mt-1">{a.line1}{a.line2 ? `, ${a.line2}` : ""} · {a.city} {a.pincode || ""}</div>
                  </button>
                ))}
              </div>
            )}
            <details className="border border-dashed border-neutral-300 p-3" open={addresses.length === 0}>
              <summary className="text-sm font-semibold cursor-pointer">+ Add new address</summary>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="col-span-2"><label className="gr-label">House / building, area</label>
                  <input className="gr-input" value={newAddr.line1} onChange={(e) => { setNewAddr({ ...newAddr, line1: e.target.value }); setAddrPick(null); }} data-testid="new-addr-line1" /></div>
                <div className="col-span-2"><label className="gr-label">Landmark (optional)</label>
                  <input className="gr-input" value={newAddr.line2} onChange={(e) => setNewAddr({ ...newAddr, line2: e.target.value })} data-testid="new-addr-line2" /></div>
                <div><label className="gr-label">City</label>
                  <input className="gr-input" value={newAddr.city} onChange={(e) => { setNewAddr({ ...newAddr, city: e.target.value }); setAddrPick(null); }} data-testid="new-addr-city" /></div>
                <div><label className="gr-label">Pincode</label>
                  <input className="gr-input" value={newAddr.pincode} onChange={(e) => setNewAddr({ ...newAddr, pincode: e.target.value })} data-testid="new-addr-pin" /></div>
              </div>
            </details>
            <div>
              <label className="gr-label">Describe the issue (optional)</label>
              <textarea rows={2} className="gr-input" value={issue} onChange={(e) => setIssue(e.target.value)}
                placeholder="e.g. AC not cooling since yesterday, makes a loud noise" data-testid="issue-input" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="gr-btn gr-btn-ghost flex-1" data-testid="back-to-step1">Back</button>
              <button disabled={!canStep3} onClick={() => setStep(3)} className="gr-btn gr-btn-primary flex-1 py-3" data-testid="next-to-step3">
                Review
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="bg-white p-5 border border-neutral-200 space-y-4" data-testid="step-review">
            <div className="gr-overline">Review & confirm</div>
            <div className="space-y-3 text-sm">
              <Row label="Service" value={svc.name} />
              <Row label="Date & time" value={`${days.find((d) => d.iso === date)?.label} · ${fmtSlotWindow(slot)} IST`} />
              <Row label="Address" value={addrPick
                ? (() => { const a = addresses.find((x) => x.id === addrPick); return a ? `${a.line1}, ${a.city}` : "—"; })()
                : `${newAddr.line1}, ${newAddr.city}`} />
              <Row label="For" value={`${user.name} · ${user.phone}`} />
              {issue && <Row label="Issue" value={issue} />}
            </div>
            <div className="bg-orange-50 border border-orange-200 p-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-neutral-600">Estimated price</div>
                <div className="font-display font-black text-2xl text-[#ff5f1f]">₹{svc.price}</div>
              </div>
              <div className="text-[11px] text-neutral-500 text-right max-w-[180px]">
                Pay cash on completion. Parts (if needed) quoted on-site.
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="gr-btn gr-btn-ghost flex-1" data-testid="back-to-step2">Back</button>
              <button onClick={submit} disabled={submitting} className="gr-btn gr-btn-primary flex-1 py-3 text-base" data-testid="confirm-booking">
                {submitting ? "Booking…" : "Confirm booking"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3 border-b border-neutral-100 pb-2">
      <div className="text-neutral-500 shrink-0">{label}</div>
      <div className="font-semibold text-right">{value}</div>
    </div>
  );
}
