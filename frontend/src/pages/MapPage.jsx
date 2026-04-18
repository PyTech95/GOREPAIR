import React, { useEffect, useRef, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { MapPin, Radio, Power } from "lucide-react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

function fmtAge(iso) {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 14);
      return;
    }
    const bounds = points.map((p) => [p.lat, p.lng]);
    map.fitBounds(bounds, { padding: [60, 60] });
  }, [points, map]);
  return null;
}

export default function MapPage() {
  const { user } = useAuth();
  const isTech = user?.role === "technician";
  const [techs, setTechs] = useState([]);
  const [tracking, setTracking] = useState(false);
  const [myLoc, setMyLoc] = useState(null);
  const watchRef = useRef(null);
  const pushIntervalRef = useRef(null);

  const load = async () => {
    if (isTech) return;
    try {
      const { data } = await api.get("/technicians/locations");
      setTechs(data);
    } catch (e) { toast.error(formatApiError(e)); }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line
  }, [isTech]);

  const startTracking = () => {
    if (!navigator.geolocation) return toast.error("Geolocation not supported");
    setTracking(true);
    const push = (pos) => {
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
      setMyLoc(loc);
      api.post("/technicians/me/location", loc).catch(() => {});
    };
    navigator.geolocation.getCurrentPosition(push, (err) => toast.error(`Location: ${err.message}`), { enableHighAccuracy: true });
    watchRef.current = navigator.geolocation.watchPosition(push, () => {}, { enableHighAccuracy: true, maximumAge: 30000 });
    pushIntervalRef.current = setInterval(() => navigator.geolocation.getCurrentPosition(push, () => {}), 60000);
    toast.success("Live tracking started — location shared every 60s");
  };
  const stopTracking = () => {
    setTracking(false);
    if (watchRef.current != null) { navigator.geolocation.clearWatch(watchRef.current); watchRef.current = null; }
    if (pushIntervalRef.current) { clearInterval(pushIntervalRef.current); pushIntervalRef.current = null; }
    toast.info("Tracking paused");
  };
  useEffect(() => () => { if (tracking) stopTracking(); /* eslint-disable-next-line */ }, []);

  if (isTech) {
    return (
      <div className="space-y-6" data-testid="tech-tracking-page">
        <div>
          <div className="gr-overline">Field Ops</div>
          <h1 className="font-display font-black text-4xl tracking-tighter mt-1">Live Tracking</h1>
          <p className="text-neutral-500 text-sm mt-1">Broadcast your location to your manager so they can dispatch nearby jobs faster.</p>
        </div>
        <div className="gr-card max-w-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className={`h-3 w-3 rounded-full ${tracking ? "bg-green-500 animate-pulse" : "bg-neutral-300"}`} />
            <div className="font-display font-bold">{tracking ? "Broadcasting live" : "Not broadcasting"}</div>
          </div>
          {myLoc && (
            <div className="text-xs font-mono text-neutral-500 mb-4">
              <div>Lat: {myLoc.lat.toFixed(5)}</div>
              <div>Lng: {myLoc.lng.toFixed(5)}</div>
              <div>Accuracy: ±{Math.round(myLoc.accuracy)}m</div>
            </div>
          )}
          {!tracking ? (
            <button className="gr-btn gr-btn-primary" onClick={startTracking} data-testid="start-tracking-btn">
              <Radio size={15} /> Start live tracking
            </button>
          ) : (
            <button className="gr-btn gr-btn-outline" onClick={stopTracking} data-testid="stop-tracking-btn">
              <Power size={15} /> Stop broadcasting
            </button>
          )}
          <div className="text-xs text-neutral-500 mt-4">
            Location is shared only with your manager. Refresh happens every 60s while this tab stays open.
          </div>
        </div>
      </div>
    );
  }

  const points = techs.filter((t) => t.location?.lat).map((t) => ({ ...t, lat: t.location.lat, lng: t.location.lng }));

  return (
    <div className="space-y-6" data-testid="map-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="gr-overline">Field Ops</div>
          <h1 className="font-display font-black text-4xl tracking-tighter mt-1">Technician map</h1>
          <p className="text-neutral-500 text-sm mt-1">{points.length} of {techs.length} broadcasting · auto-refresh 15s</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 gr-card p-0 overflow-hidden" style={{ minHeight: 560 }}>
          <MapContainer
            center={[20.5937, 78.9629]}
            zoom={5}
            style={{ width: "100%", height: 560 }}
            scrollWheelZoom
            data-testid="leaflet-map"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {points.map((p) => (
              <CircleMarker
                key={p.id}
                center={[p.lat, p.lng]}
                radius={10}
                pathOptions={{ color: "#0A0A0A", fillColor: "#FF5F1F", fillOpacity: 1, weight: 2 }}
              >
                <Popup>
                  <div style={{ fontFamily: "system-ui", fontSize: 13, minWidth: 160 }}>
                    <b>{p.name}</b><br />
                    <span style={{ color: "#71717a" }}>{p.city} · ★ {p.rating}</span><br />
                    <span style={{ color: "#71717a", fontSize: 11 }}>Updated {fmtAge(p.location.updated_at)}</span>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
            <FitBounds points={points} />
          </MapContainer>
        </div>
        <div className="gr-card p-0 overflow-hidden max-h-[560px] overflow-y-auto">
          <div className="px-4 py-3 border-b border-neutral-200 sticky top-0 bg-white z-10">
            <div className="gr-overline">Team</div>
          </div>
          <div className="divide-y divide-neutral-200">
            {techs.length === 0 && <div className="text-sm text-neutral-400 p-4">No technicians.</div>}
            {techs.map((t) => (
              <div key={t.id} className="p-4 hover:bg-neutral-50" data-testid={`tech-card-${t.id}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-sm">{t.name}</div>
                    <div className="text-[11px] text-neutral-500">{t.city || "—"} · ★ {t.rating}</div>
                  </div>
                  <div className={`h-2 w-2 rounded-full mt-1.5 ${t.location?.lat ? "bg-green-500" : "bg-neutral-300"}`} />
                </div>
                {t.location?.lat ? (
                  <div className="mt-2 text-[11px] font-mono text-neutral-500 flex items-center gap-1">
                    <MapPin size={11} /> {t.location.lat.toFixed(3)}, {t.location.lng.toFixed(3)} · {fmtAge(t.location.updated_at)}
                  </div>
                ) : (
                  <div className="mt-2 text-[11px] text-neutral-400">Offline</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
