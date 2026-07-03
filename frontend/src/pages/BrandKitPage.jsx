import React, { useEffect, useMemo, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ShoppingBag, Check, Package } from "lucide-react";
import { fmtISTDate } from "@/lib/date";

export default function BrandKitPage() {
  const { user, refresh } = useAuth();
  const [items, setItems] = useState([]);
  const [cart, setCart] = useState({});
  const [orders, setOrders] = useState([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [a, b] = await Promise.all([api.get("/brand-kit/items"), api.get("/brand-kit/orders")]);
      setItems(a.data); setOrders(b.data);
    } catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); }, []);

  const total = useMemo(
    () => items.reduce((s, it) => s + ((cart[it.sku] || 0) * it.price_points), 0),
    [cart, items]
  );

  const bump = (sku, d) => setCart((c) => ({ ...c, [sku]: Math.max(0, (c[sku] || 0) + d) }));

  const placeOrder = async () => {
    const payload = Object.entries(cart).filter(([, q]) => q > 0).map(([sku, qty]) => ({ sku, qty }));
    if (!payload.length) return toast.error("Cart is empty");
    setSaving(true);
    try {
      await api.post("/brand-kit/order", { items: payload });
      toast.success("Order placed! Items ship in 3-5 business days.");
      setCart({}); await refresh(); await load();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6" data-testid="brand-kit-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="gr-overline">Onboarding</div>
          <h1 className="font-display font-black text-4xl tracking-tighter mt-1">Brand Kit Store</h1>
          <p className="text-neutral-500 text-sm mt-1">Certified uniforms and essentials for your field team. Paid via wallet points.</p>
        </div>
        <div className="gr-card gr-metric min-w-[180px]">
          <div className="gr-overline">Wallet</div>
          <div className="font-display font-black text-2xl mt-1">{user?.wallet_balance ?? 0} <span className="text-sm text-neutral-500 font-normal">pts</span></div>
        </div>
      </div>

      {!user?.has_brand_kit && (
        <div className="gr-ai-panel flex items-center gap-3 flex-wrap">
          <Package className="text-[#002fa7]" />
          <div className="flex-1">
            <div className="font-display font-bold">First-time manager? Order your Welcome Kit!</div>
            <div className="text-sm text-neutral-600">Includes t-shirts, bill book, ID cards — everything you need to operate as a GO Repair manager.</div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((it) => {
          const qty = cart[it.sku] || 0;
          return (
            <div key={it.sku} className="gr-card gr-card-hover p-0 overflow-hidden flex flex-col" data-testid={`kit-${it.sku}`}>
              <div className="aspect-[4/3] bg-neutral-100 overflow-hidden">
                <img src={it.image} alt={it.name} className="w-full h-full object-cover" />
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <div className="font-display font-bold">{it.name}</div>
                <div className="text-xs text-neutral-500 mt-1 flex-1">{it.desc}</div>
                <div className="flex items-center justify-between mt-4">
                  <div className="font-display font-black text-xl text-[#ff5f1f]">{it.price_points} <span className="text-xs text-neutral-500 font-normal">pts</span></div>
                  <div className="flex items-center gap-1">
                    <button className="gr-btn gr-btn-ghost px-2" onClick={() => bump(it.sku, -1)} data-testid={`kit-minus-${it.sku}`}>−</button>
                    <span className="font-mono w-6 text-center">{qty}</span>
                    <button className="gr-btn gr-btn-outline px-2" onClick={() => bump(it.sku, 1)} data-testid={`kit-plus-${it.sku}`}>+</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="gr-card sticky bottom-4 flex items-center justify-between" data-testid="cart-summary">
        <div>
          <div className="gr-overline">Cart total</div>
          <div className="font-display font-black text-2xl">{total} pts</div>
        </div>
        <button className="gr-btn gr-btn-primary" disabled={!total || saving} onClick={placeOrder} data-testid="place-order-btn">
          <ShoppingBag size={15} /> {saving ? "Placing…" : "Place order"}
        </button>
      </div>

      {orders.length > 0 && (
        <div className="gr-card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-200">
            <div className="gr-overline">Orders</div>
            <div className="font-display font-bold text-lg mt-0.5">Your brand-kit orders</div>
          </div>
          <div className="overflow-x-auto">
            <table className="gr-table">
              <thead><tr><th>Date</th><th>Items</th><th>Points</th><th>Status</th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} data-testid={`order-${o.id}`}>
                    <td className="font-mono text-xs">{fmtISTDate(o.created_at)}</td>
                    <td className="whitespace-normal">{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</td>
                    <td className="font-mono font-bold">{o.total_points}</td>
                    <td><span className="gr-badge in_progress"><Check size={10} className="inline -mt-0.5 mr-1" /> {o.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
