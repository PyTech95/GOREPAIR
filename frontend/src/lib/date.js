// All date/time helpers are pinned to Indian Standard Time (Asia/Kolkata).
// Backend stores timestamps in UTC; the frontend always renders IST regardless
// of the user's local timezone.

const IST_TZ = "Asia/Kolkata";

/** Returns YYYY-MM-DD for the given Date, evaluated in IST (fixes UTC edge-case around midnight). */
export function istDateISO(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year").value;
  const m = parts.find((p) => p.type === "month").value;
  const d = parts.find((p) => p.type === "day").value;
  return `${y}-${m}-${d}`;
}

/** Full IST datetime, e.g. "3 Jul 2026, 09:54 AM". */
export function fmtISTDateTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: IST_TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Short IST date, e.g. "3 Jul 2026". */
export function fmtISTDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", {
    timeZone: IST_TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Time only, e.g. "09:54 AM IST". */
export function fmtISTTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-IN", {
    timeZone: IST_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Converts a 24-hour slot window "08:00-10:00" to a friendly IST label
 * like "8:00 AM – 10:00 AM" (or "10:00 AM – 12:00 PM").
 */
export function fmtSlotWindow(win) {
  if (!win || !win.includes("-")) return win || "";
  const [a, b] = win.split("-");
  return `${to12h(a)} – ${to12h(b)}`;
}

function to12h(hhmm) {
  const [hStr, mStr] = hhmm.split(":");
  let h = parseInt(hStr, 10);
  const suffix = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${mStr} ${suffix}`;
}
