import React, { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Wallet, ArrowDownRight, ArrowUpRight, Zap, CreditCard, QrCode, Check, X as XIcon, Upload, Clock } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

const BACKEND = process.env.REACT_APP_BACKEND_URL;

let _rzpLoaded = null;
function loadRazorpayScript() {
  if (typeof window === "undefined") return Promise.reject();
  if (window.Razorpay) return Promise.resolve();
  if (_rzpLoaded) return _rzpLoaded;
  _rzpLoaded = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = resolve; s.onerror = reject;
    document.body.appendChild(s);
  });
  return _rzpLoaded;
}

export default function WalletPage() {
  const { user, refresh } = useAuth();
  const [balance, setBalance] = useState(0);
  const [txns, setTxns] = useState([]);
  const [managers, setManagers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [adjust, setAdjust] = useState({ manager_id: "", points: 500, reason: "" });
  const [showUpi, setShowUpi] = useState(false);
  const [requests, setRequests] = useState([]);

  const isAdmin = user?.role === "super_admin";

  const loadRequests = async () => {
    try {
      const { data } = await api.get("/wallet/recharge-requests");
      setRequests(data);
    } catch { /* ignore */ }
  };

  const load = async () => {
    try {
      if (isAdmin) {
        const { data } = await api.get("/users", { params: { role: "manager" } });
        setManagers(data);
        const first = data[0];
        if (first) {
          setSelected(first);
          const t = await api.get("/wallet/transactions", { params: { manager_id: first.id } });
          setTxns(t.data);
        }
      } else {
        const b = await api.get("/wallet/me");
        setBalance(b.data.balance);
        const t = await api.get("/wallet/transactions");
        setTxns(t.data);
      }
    } catch (e) { toast.error(formatApiError(e)); }
  };

  useEffect(() => { load(); loadRequests(); /* eslint-disable-next-line */ }, []);

  const pickManager = async (m) => {
    setSelected(m);
    const t = await api.get("/wallet/transactions", { params: { manager_id: m.id } });
    setTxns(t.data);
  };

  const recharge = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/wallet/recharge", { amount_inr: Number(amount) });
      toast.success(`Recharged ${data.txn.points} pts (mock)`);
      setBalance(data.txn.balance_after);
      await refresh();
      await load();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setLoading(false); }
  };

  const payWithRazorpay = async () => {
    setLoading(true);
    try {
      const cfg = await api.get("/wallet/razorpay/config");
      const { data: order } = await api.post("/wallet/razorpay/create-order", { amount_inr: Number(amount) });
      // MOCK MODE: skip UPI checkout, verify directly
      if (order.mode === "mock") {
        const { data } = await api.post("/wallet/razorpay/verify", {
          razorpay_order_id: order.order.id,
          razorpay_payment_id: `pay_MOCK_${Date.now()}`,
          amount_inr: Number(amount),
        });
        toast.success(`Paid via Razorpay (MOCK) — ${data.txn.points} pts added`);
        setBalance(data.txn.balance_after);
        await refresh(); await load();
        return;
      }
      // LIVE mode
      await loadRazorpayScript();
      const options = {
        key: cfg.data.key_id,
        amount: order.order.amount,
        currency: order.order.currency,
        order_id: order.order.id,
        name: "GO Repair",
        description: `Wallet recharge — ${amount} pts`,
        prefill: { name: user?.name, email: user?.email, contact: user?.phone || "" },
        theme: { color: "#FF5F1F" },
        handler: async (resp) => {
          try {
            const { data } = await api.post("/wallet/razorpay/verify", {
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
              amount_inr: Number(amount),
            });
            toast.success(`Paid — ${data.txn.points} pts added`);
            setBalance(data.txn.balance_after);
            await refresh(); await load();
          } catch (e) { toast.error(formatApiError(e)); }
        },
        modal: { ondismiss: () => toast.info("Payment cancelled") },
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setLoading(false); }
  };

  const adminAdjust = async (type) => {
    if (!adjust.manager_id || !adjust.points) return;
    try {
      await api.post(`/wallet/${type}`, adjust);
      toast.success(`${type} ${adjust.points} pts`);
      setAdjust({ manager_id: "", points: 500, reason: "" });
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <div className="space-y-6" data-testid="wallet-page">
      <div>
        <div className="gr-overline">Finance</div>
        <h1 className="font-display font-black text-4xl tracking-tighter mt-1">Wallet</h1>
      </div>

      {!isAdmin && (
        <>
        <div className="gr-ai-panel flex items-center gap-4 flex-wrap" data-testid="upi-recharge-panel">
          <QrCode size={28} className="text-[#002fa7]" />
          <div className="flex-1 min-w-[240px]">
            <div className="gr-overline text-[#002fa7]">UPI · INSTANT</div>
            <div className="font-display font-bold text-lg">Recharge via UPI QR</div>
            <div className="text-sm text-neutral-600">Pay any UPI app, upload the receipt — admin approves and points land in your wallet.</div>
          </div>
          <button className="gr-btn gr-btn-primary" onClick={() => setShowUpi(true)} data-testid="open-upi-btn">
            <QrCode size={15} /> Pay with UPI
          </button>
        </div>

        {requests.length > 0 && (
          <div className="gr-card p-0 overflow-hidden" data-testid="my-recharge-requests">
            <div className="px-5 py-4 border-b border-neutral-200">
              <div className="gr-overline">My recharge requests</div>
              <div className="font-display font-bold text-lg mt-0.5">Status of UPI recharges</div>
            </div>
            <div className="overflow-x-auto">
              <table className="gr-table">
                <thead><tr><th>Date</th><th>Amount</th><th>Receipt</th><th>Status</th><th>Note</th></tr></thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id} data-testid={`req-${r.id}`}>
                      <td className="font-mono text-xs">{new Date(r.created_at).toLocaleString("en-IN")}</td>
                      <td className="font-bold">₹{r.amount_inr.toLocaleString("en-IN")}</td>
                      <td>
                        <a href={`${BACKEND}${r.receipt_url}`} target="_blank" rel="noreferrer" className="text-[#ff5f1f] text-xs hover:underline">view</a>
                      </td>
                      <td>
                        {r.status === "pending" && <span className="gr-badge assigned_manager"><Clock size={10} className="inline -mt-0.5 mr-1" /> pending</span>}
                        {r.status === "approved" && <span className="gr-badge completed"><Check size={10} className="inline -mt-0.5 mr-1" /> approved</span>}
                        {r.status === "rejected" && <span className="gr-badge cancelled"><XIcon size={10} className="inline -mt-0.5 mr-1" /> rejected</span>}
                      </td>
                      <td className="text-neutral-600 text-xs whitespace-normal max-w-xs">{r.admin_note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-4">
          <div className="gr-card gr-metric md:col-span-1">
            <div className="gr-overline flex items-center gap-1"><Wallet size={13} /> Current balance</div>
            <div className="font-display font-black text-5xl tracking-tighter mt-2" data-testid="wallet-balance">{balance}</div>
            <div className="text-xs text-neutral-500 mt-1">points · 1pt = ₹1 lead value</div>
          </div>
          <div className="gr-card md:col-span-2">
            <div className="gr-overline mb-2 flex items-center gap-1"><Zap size={13} /> Quick recharge (MOCK)</div>
            <div className="text-sm text-neutral-500 mb-3">₹1 = 1 point. Razorpay live payments rolling out next phase.</div>
            <div className="flex gap-2 flex-wrap mb-3">
              {[500, 1000, 2500, 5000, 10000].map((v) => (
                <button key={v} onClick={() => setAmount(v)}
                  className={`gr-btn ${amount === v ? "gr-btn-primary" : "gr-btn-outline"}`}
                  data-testid={`recharge-${v}`}>
                  ₹{v}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="number" className="gr-input flex-1" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="recharge-amount" />
              <button className="gr-btn gr-btn-outline" onClick={recharge} disabled={loading} data-testid="recharge-btn">
                Quick add
              </button>
              <button className="gr-btn gr-btn-primary" onClick={payWithRazorpay} disabled={loading} data-testid="razorpay-btn">
                <CreditCard size={14} /> {loading ? "…" : "Pay via Razorpay"}
              </button>
            </div>
            <div className="text-[11px] text-neutral-400 mt-2 font-mono">Razorpay: MOCK mode (no live keys set). Credits wallet directly for demo.</div>
          </div>
        </div>
        </>
      )}

      {isAdmin && requests.filter((r) => r.status === "pending").length > 0 && (
        <div className="gr-ai-panel" data-testid="admin-pending-requests">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <div className="gr-overline text-[#002fa7]">UPI RECHARGE REQUESTS</div>
              <div className="font-display font-bold text-lg">Pending approval ({requests.filter((r) => r.status === "pending").length})</div>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {requests.filter((r) => r.status === "pending").map((r) => (
              <PendingRequestCard key={r.id} r={r} onDone={() => { loadRequests(); load(); }} />
            ))}
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="grid md:grid-cols-3 gap-4">
          <div className="gr-card">
            <div className="gr-overline mb-3">Managers</div>
            <div className="space-y-2">
              {managers.map((m) => (
                <button
                  key={m.id}
                  onClick={() => pickManager(m)}
                  className={`w-full text-left px-3 py-2 border transition-colors ${selected?.id === m.id ? "border-[#ff5f1f] bg-orange-50/40" : "border-neutral-200 hover:border-neutral-300"}`}
                  data-testid={`mgr-${m.id}`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-sm">{m.name}</div>
                      <div className="text-[11px] text-neutral-500">{m.city}</div>
                    </div>
                    <div className="font-mono font-bold text-[#ff5f1f]">{m.wallet_balance ?? 0}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="gr-card md:col-span-2">
            <div className="gr-overline mb-3">Credit / debit</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="gr-label">Manager</label>
                <select className="gr-input" value={adjust.manager_id} onChange={(e) => setAdjust({ ...adjust, manager_id: e.target.value })} data-testid="adj-mgr">
                  <option value="">Select…</option>
                  {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div><label className="gr-label">Points</label>
                <input type="number" className="gr-input" value={adjust.points} onChange={(e) => setAdjust({ ...adjust, points: Number(e.target.value) })} data-testid="adj-points" />
              </div>
              <div><label className="gr-label">Reason</label>
                <input className="gr-input" value={adjust.reason} onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })} data-testid="adj-reason" />
              </div>
              <div className="col-span-2 flex gap-2 justify-end">
                <button className="gr-btn gr-btn-outline" onClick={() => adminAdjust("debit")} data-testid="adj-debit">Debit</button>
                <button className="gr-btn gr-btn-primary" onClick={() => adminAdjust("credit")} data-testid="adj-credit">Credit</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="gr-card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200">
          <div className="gr-overline">Ledger</div>
          <div className="font-display font-bold text-lg mt-0.5">
            {isAdmin && selected ? `Transactions — ${selected.name}` : "Transaction history"}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="gr-table">
            <thead><tr><th>Date</th><th>Type</th><th>Points</th><th>Balance</th><th>Reason</th></tr></thead>
            <tbody>
              {txns.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-neutral-400">No transactions</td></tr>}
              {txns.map((t) => (
                <tr key={t.id} data-testid={`txn-${t.id}`}>
                  <td className="font-mono text-xs">{new Date(t.created_at).toLocaleString("en-IN")}</td>
                  <td>
                    <span className={`gr-badge ${t.delta > 0 ? "completed" : "cancelled"}`}>
                      {t.delta > 0 ? <ArrowUpRight size={10} className="inline -mt-0.5 mr-1" /> : <ArrowDownRight size={10} className="inline -mt-0.5 mr-1" />}
                      {t.type}
                    </span>
                  </td>
                  <td className={`font-mono font-bold ${t.delta > 0 ? "text-green-600" : "text-red-600"}`}>
                    {t.delta > 0 ? "+" : ""}{t.delta}
                  </td>
                  <td className="font-mono">{t.balance_after}</td>
                  <td className="text-neutral-600 whitespace-normal max-w-xs">{t.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showUpi && <UpiRechargeDialog onClose={() => setShowUpi(false)} onSubmitted={() => { setShowUpi(false); loadRequests(); }} />}
    </div>
  );
}

function UpiRechargeDialog({ onClose, onSubmitted }) {
  const [cfg, setCfg] = useState({ upi_vpa: "", upi_name: "GO Repair" });
  const [amount, setAmount] = useState(1000);
  const [note, setNote] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get("/wallet/upi-config").then((r) => setCfg(r.data)).catch(() => {}); }, []);

  const upiUrl = cfg.upi_vpa
    ? `upi://pay?pa=${encodeURIComponent(cfg.upi_vpa)}&pn=${encodeURIComponent(cfg.upi_name || "GO Repair")}&am=${amount}&cu=INR&tn=${encodeURIComponent("Wallet recharge")}`
    : "";

  const submit = async () => {
    if (!file) return toast.error("Please upload the payment receipt screenshot");
    if (!amount || amount <= 0) return toast.error("Enter a valid amount");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("receipt", file);
      const token = localStorage.getItem("gr_token");
      const url = `${BACKEND}/api/wallet/recharge-request?amount_inr=${amount}&note=${encodeURIComponent(note || "")}`;
      const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || "Submit failed"); }
      toast.success("Recharge request submitted — admin will verify shortly");
      onSubmitted();
    } catch (e) { toast.error(e.message || "Submit failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose} data-testid="upi-dialog">
      <div className="bg-white w-full max-w-lg gr-sharp max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div>
            <div className="font-display font-bold text-lg">UPI Recharge</div>
            <div className="text-xs text-neutral-500 mt-0.5">Scan, pay, then upload the receipt</div>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-900 text-sm">Close</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="gr-label">Amount (₹ = points)</label>
            <div className="flex gap-2 flex-wrap mb-2">
              {[500, 1000, 2500, 5000, 10000].map((v) => (
                <button key={v} type="button" onClick={() => setAmount(v)}
                  className={`gr-btn ${amount === v ? "gr-btn-primary" : "gr-btn-outline"}`}
                  data-testid={`upi-amount-${v}`}>
                  ₹{v.toLocaleString("en-IN")}
                </button>
              ))}
            </div>
            <input type="number" min="1" className="gr-input" value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 0)} data-testid="upi-amount-input" />
          </div>

          <div className="grid sm:grid-cols-2 gap-4 items-center bg-neutral-50 p-4 border border-neutral-200">
            <div className="flex justify-center">
              {upiUrl ? (
                <div className="bg-white p-3 border-2 border-[#ff5f1f]" data-testid="upi-qr">
                  <QRCodeSVG value={upiUrl} size={180} level="M" includeMargin={false} />
                </div>
              ) : (
                <div className="w-[180px] h-[180px] grid place-items-center text-xs text-neutral-400 border">No UPI configured</div>
              )}
            </div>
            <div className="space-y-2">
              <div>
                <div className="gr-label">Pay to</div>
                <div className="font-display font-bold">{cfg.upi_name || "GO Repair"}</div>
                <div className="font-mono text-xs text-neutral-600 break-all">{cfg.upi_vpa || "—"}</div>
              </div>
              <div>
                <div className="gr-label">Amount</div>
                <div className="font-display font-black text-2xl text-[#ff5f1f]">₹{amount.toLocaleString("en-IN")}</div>
              </div>
              <div className="text-[11px] text-neutral-500">
                Open any UPI app (GPay, PhonePe, Paytm) → scan → pay → screenshot the success receipt.
              </div>
            </div>
          </div>

          <div>
            <label className="gr-label">Upload payment receipt (image/PDF, max 8 MB)</label>
            <label className="block border-2 border-dashed border-neutral-300 hover:border-[#ff5f1f] transition-colors p-5 text-center cursor-pointer">
              <Upload size={20} className="mx-auto mb-2 text-neutral-400" />
              <div className="text-sm font-semibold">{file ? file.name : "Click to pick a file"}</div>
              {file && <div className="text-[11px] text-neutral-500 mt-1">{Math.round(file.size / 1024)} KB</div>}
              <input type="file" accept="image/*,application/pdf" className="hidden"
                onChange={(e) => setFile(e.target.files?.[0])} data-testid="receipt-file" />
            </label>
          </div>

          <div>
            <label className="gr-label">UPI reference / note (optional)</label>
            <input className="gr-input" placeholder="e.g. UPI Ref 412...XYZ"
              value={note} onChange={(e) => setNote(e.target.value)} data-testid="upi-note" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button className="gr-btn gr-btn-ghost" onClick={onClose}>Cancel</button>
            <button className="gr-btn gr-btn-primary" disabled={busy || !file} onClick={submit} data-testid="submit-upi-request">
              {busy ? "Submitting…" : "Submit recharge request"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PendingRequestCard({ r, onDone }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const act = async (kind) => {
    setBusy(true);
    try {
      await api.post(`/wallet/recharge-requests/${r.id}/${kind}`, { admin_note: note });
      toast.success(kind === "approve" ? `Approved ₹${r.amount_inr} — wallet credited` : "Rejected");
      onDone();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setBusy(false); }
  };
  return (
    <div className="border border-neutral-200 bg-white p-3" data-testid={`pending-${r.id}`}>
      <div className="flex items-start gap-3">
        <a href={`${BACKEND}${r.receipt_url}`} target="_blank" rel="noreferrer" className="shrink-0 block w-20 h-20 bg-neutral-100 border border-neutral-200 overflow-hidden">
          {r.receipt_url.endsWith(".pdf") ? (
            <div className="grid place-items-center w-full h-full text-[10px] text-neutral-500 font-mono">PDF</div>
          ) : (
            <img src={`${BACKEND}${r.receipt_url}`} alt="receipt" className="w-full h-full object-cover" />
          )}
        </a>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold text-sm truncate">{r.manager_name}</div>
            <div className="font-display font-black text-lg text-[#ff5f1f]">₹{r.amount_inr.toLocaleString("en-IN")}</div>
          </div>
          <div className="text-[11px] text-neutral-500">{new Date(r.created_at).toLocaleString("en-IN")}</div>
          {r.note && <div className="text-xs text-neutral-700 mt-1 truncate" title={r.note}>“{r.note}”</div>}
        </div>
      </div>
      <input className="gr-input mt-3" placeholder="Verification note (e.g. UPI Ref)"
        value={note} onChange={(e) => setNote(e.target.value)} data-testid={`note-${r.id}`} />
      <div className="flex gap-2 mt-2">
        <button className="gr-btn gr-btn-outline flex-1" onClick={() => act("reject")} disabled={busy} data-testid={`reject-${r.id}`}>
          <XIcon size={14} /> Reject
        </button>
        <button className="gr-btn gr-btn-primary flex-1" onClick={() => act("approve")} disabled={busy} data-testid={`approve-${r.id}`}>
          <Check size={14} /> Approve & credit
        </button>
      </div>
    </div>
  );
}
