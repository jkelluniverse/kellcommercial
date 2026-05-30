import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { LOGO_URL, formatApiError } from "../lib/api";
import { Lock, Mail } from "lucide-react";

export default function Login() {
  const { user, checking, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  if (checking) return <div className="min-h-screen flex items-center justify-center text-bone-300">…</div>;
  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (e2) {
      setErr(formatApiError(e2));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-ink-950 via-ink-900 to-ink-950" />
      <div className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 80%, rgba(185,28,28,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(201,169,97,0.08) 0%, transparent 50%)",
        }}
      />

      <div className="relative w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src={LOGO_URL} alt="Kell Commercial" className="h-24 w-24 object-contain mb-3" />
          <div className="brand-mark text-5xl">KELL</div>
          <div className="brand-sub mt-1">COMMERCIAL · EST. 1978</div>
        </div>

        <form data-testid="login-form" onSubmit={submit} className="panel-hot p-7 space-y-5">
          <div className="text-center mb-1">
            <div className="font-display tracking-wider uppercase text-xs text-gold-500">Asset Manager</div>
            <div className="text-bone-200 text-sm mt-1">Sign in to continue</div>
          </div>

          <div>
            <label className="label">Email</label>
            <div className="relative">
              <Mail size={14} className="absolute top-3 left-3 text-ink-500" />
              <input
                data-testid="login-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input pl-9"
                placeholder="jacob@nicecityhomes.com"
                autoFocus
                required
              />
            </div>
          </div>

          <div>
            <label className="label">Password</label>
            <div className="relative">
              <Lock size={14} className="absolute top-3 left-3 text-ink-500" />
              <input
                data-testid="login-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input pl-9"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {err && <div data-testid="login-error" className="text-crimson-500 text-xs">{err}</div>}

          <button
            data-testid="login-submit-btn"
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>

          <div className="text-center text-[10px] tracking-[0.3em] uppercase text-ink-500">
            Authorized access only
          </div>
        </form>
      </div>
    </div>
  );
}
