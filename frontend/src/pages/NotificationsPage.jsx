import React, { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { MessageSquare, Phone, Bell } from "lucide-react";
import { fmtISTDateTime } from "@/lib/date";

const CHANNEL_ICON = { sms: Phone, whatsapp: MessageSquare, push: Bell };

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/notifications");
      setItems(data);
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); const id = setInterval(load, 10000); return () => clearInterval(id); }, []);

  return (
    <div className="space-y-6" data-testid="notifications-page">
      <div>
        <div className="gr-overline">Messaging</div>
        <h1 className="font-display font-black text-4xl tracking-tighter mt-1">Notifications</h1>
        <p className="text-neutral-500 text-sm mt-1">SMS & WhatsApp triggers. Provider is currently <b>MOCKED</b> — plug Twilio/Gupshup later.</p>
      </div>

      <div className="gr-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="gr-table">
            <thead><tr><th>When</th><th>Channel</th><th>To</th><th>Message</th><th>Status</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="text-center py-8 text-neutral-400">Loading…</td></tr>}
              {!loading && items.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-neutral-400">No notifications yet. Assign a lead to trigger one.</td></tr>}
              {items.map((n) => {
                const Icon = CHANNEL_ICON[n.channel] || Bell;
                return (
                  <tr key={n.id} data-testid={`notify-${n.id}`}>
                    <td className="font-mono text-xs">{fmtISTDateTime(n.created_at)}</td>
                    <td>
                      <span className="gr-badge assigned_technician inline-flex items-center gap-1">
                        <Icon size={10} /> {n.channel}
                      </span>
                    </td>
                    <td className="font-mono text-xs">{n.to}</td>
                    <td className="whitespace-normal max-w-xl text-sm">{n.body}</td>
                    <td><span className="gr-badge assigned_manager">{n.status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
