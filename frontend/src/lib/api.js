import axios from "axios";

const API_BASE = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("kc_token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function formatApiError(err) {
  const d = err?.response?.data?.detail;
  if (d == null) return err?.message || "Something went wrong.";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((e) => (e?.msg ? e.msg : JSON.stringify(e))).join(" ");
  return String(d);
}

export const LOGO_URL =
  "https://customer-assets.emergentagent.com/job_rentec-integration/artifacts/g37cogzi_kell%20comm%20logo%20transparent.png";
