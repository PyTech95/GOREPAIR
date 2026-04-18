import React, { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Wallet, ArrowDownRight, ArrowUpRight, Zap } from "lucide-react";

export default function WalletPage() {
  const { user, refresh } = useAuth();
  const [balance, setBalance] = useState(0);
  const [txns, setTxns] = useState([]);
  const [managers, setManagers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [adjust, setAdjust] = useState({ manager_id: "", points: 500, reason: "" });

  const isAdmin = user?.role === "super_admin";

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

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

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
              <button className="gr-btn gr-btn-primary" onClick={recharge} disabled={loading} data-testid="recharge-btn">
                {loading ? "Processing…" : `Add ${amount} pts`}
              </button>
            </div>
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
    </div>
  );
}
