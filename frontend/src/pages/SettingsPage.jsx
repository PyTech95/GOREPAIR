import React, { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Settings as SettingsIcon, QrCode } from "lucide-react";

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [costPerLead, setCostPerLead] = useState(200);
  const [welcome, setWelcome] = useState(500);
  const [upiVpa, setUpiVpa] = useState("");
  const [upiName, setUpiName] = useState("GO Repair");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/settings").then((r) => {
      setSettings(r.data);
      setCostPerLead(r.data.cost_per_lead);
      setWelcome(r.data.welcome_bonus_points);
      setUpiVpa(r.data.upi_vpa || "");
      setUpiName(r.data.upi_name || "GO Repair");
    }).catch((e) => toast.error(formatApiError(e)));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put("/settings", {
        cost_per_lead: Number(costPerLead),
        welcome_bonus_points: Number(welcome),
        upi_vpa: upiVpa,
        upi_name: upiName,
      });
      setSettings(data);
      toast.success("Settings saved");
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 max-w-3xl" data-testid="settings-page">
      <div>
        <div className="gr-overline">System</div>
        <h1 className="font-display font-black text-4xl tracking-tighter mt-1">Settings</h1>
      </div>

      <div className="gr-card">
        <div className="flex items-center gap-2 mb-4">
          <SettingsIcon size={16} className="text-neutral-400" />
          <div className="font-display font-bold text-lg">Economy</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="gr-label">Cost per lead (points)</label>
            <input type="number" className="gr-input" value={costPerLead} onChange={(e) => setCostPerLead(e.target.value)} data-testid="cost-per-lead" />
            <div className="text-xs text-neutral-500 mt-1">Debited from manager's wallet on assignment.</div>
          </div>
          <div>
            <label className="gr-label">Welcome bonus (points)</label>
            <input type="number" className="gr-input" value={welcome} onChange={(e) => setWelcome(e.target.value)} data-testid="welcome-bonus" />
            <div className="text-xs text-neutral-500 mt-1">Points credited to new managers on signup.</div>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button className="gr-btn gr-btn-primary" onClick={save} disabled={saving} data-testid="save-settings-btn">
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </div>

      <div className="gr-card">
        <div className="flex items-center gap-2 mb-4">
          <QrCode size={16} className="text-neutral-400" />
          <div className="font-display font-bold text-lg">UPI receiver (for manager recharge QR)</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="gr-label">UPI VPA (Virtual Payment Address)</label>
            <input className="gr-input" placeholder="gorepair@okhdfc" value={upiVpa}
              onChange={(e) => setUpiVpa(e.target.value)} data-testid="upi-vpa-input" />
            <div className="text-xs text-neutral-500 mt-1">Managers will scan this in their UPI app when recharging.</div>
          </div>
          <div>
            <label className="gr-label">Display name on QR</label>
            <input className="gr-input" value={upiName} onChange={(e) => setUpiName(e.target.value)} data-testid="upi-name-input" />
            <div className="text-xs text-neutral-500 mt-1">Shown to managers as "Pay to" in their UPI app.</div>
          </div>
        </div>
      </div>

      {settings && (
        <div className="gr-card">
          <div className="gr-overline mb-3">Current catalog</div>
          <div className="grid sm:grid-cols-2 gap-2">
            {(settings.brand_kit_items || []).map((it) => (
              <div key={it.sku} className="flex justify-between border border-neutral-200 px-3 py-2">
                <div className="text-sm font-semibold">{it.name}</div>
                <div className="font-mono text-sm text-[#ff5f1f]">{it.price_points} pts</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
