import axios from "axios";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("gr_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Endpoints that legitimately return 401 for invalid credentials on login/register.
// We must NOT auto-logout on these — otherwise a bad-password toast triggers a
// full redirect. Everything else that 401s is a stale/expired session.
const AUTH_EXEMPT = ["/auth/login", "/customer/login", "/customer/register"];

let _bounced = false;

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err?.response?.status;
    const url = err?.config?.url || "";
    const isAuthPath = AUTH_EXEMPT.some((p) => url.endsWith(p));

    if (status === 401 && !isAuthPath && !_bounced) {
      _bounced = true;
      // Kill any stale token
      localStorage.removeItem("gr_token");
      toast.error("Session expired — please log in again");
      // Route customers to customer-login, staff back to staff-login.
      // Best-effort inference from the current path.
      const path = typeof window !== "undefined" ? window.location.pathname : "/";
      const goesToConsole =
        path.startsWith("/console") ||
        path === "/login" ||
        path === "/notifications" ||
        path === "/settings";
      const nextLogin = goesToConsole ? "/login" : "/customer/login";
      setTimeout(() => {
        _bounced = false;
        if (typeof window !== "undefined" && window.location.pathname !== nextLogin) {
          window.location.href = nextLogin;
        }
      }, 800);
    }
    return Promise.reject(err);
  }
);

export function formatApiError(err) {
  const detail = err?.response?.data?.detail;
  if (!detail) return err?.message || "Something went wrong";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((e) => (e?.msg ? e.msg : JSON.stringify(e))).join(" ");
  }
  return String(detail);
}
