import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { LOGO_URL } from "../lib/api";
import {
  LayoutDashboard, Building2, Users, DollarSign, FolderSearch,
  ListChecks, Receipt, Zap, FileText, LogOut, Menu, X, ShieldCheck
} from "lucide-react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/properties", label: "Properties & Units", icon: Building2, testid: "nav-properties" },
  { to: "/tenants", label: "Tenants & Leases", icon: Users, testid: "nav-tenants" },
  { to: "/payments", label: "Payments", icon: DollarSign, testid: "nav-payments" },
  { to: "/documents", label: "Documents", icon: FolderSearch, testid: "nav-documents" },
  { to: "/tasks", label: "Tasks", icon: ListChecks, testid: "nav-tasks" },
  { to: "/expenses", label: "Expenses", icon: Receipt, testid: "nav-expenses" },
  { to: "/utilities", label: "Utility Accounts", icon: Zap, testid: "nav-utilities" },
  { to: "/applications", label: "Applications", icon: FileText, testid: "nav-applications" },
];

export function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const [open, setOpen] = React.useState(false);
  const loc = useLocation();

  React.useEffect(() => { setOpen(false); }, [loc.pathname]);

  return (
    <div className="min-h-screen flex bg-white relative">
      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 inset-x-0 z-30 bg-white border-b border-ink-600 flex items-center justify-between px-4 h-14">
        <button data-testid="mobile-menu-toggle" onClick={() => setOpen(!open)} className="text-crimson-600">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
        <div className="flex items-center gap-2">
          <img src={LOGO_URL} alt="Kell" className="h-8 w-8 object-contain" />
          <div className="brand-mark text-lg">KELL</div>
        </div>
        <div className="w-6" />
      </header>

      {/* Sidebar */}
      <aside
        data-testid="sidebar"
        className={`fixed md:static top-0 left-0 h-screen md:h-auto md:min-h-screen w-72 bg-ink-800 border-r border-ink-600 z-40 transform transition-transform md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="px-6 pt-6 pb-5 border-b border-ink-600">
          <div className="flex items-center justify-center">
            <img src={LOGO_URL} alt="Kell Commercial" className="h-20 w-auto object-contain" />
          </div>
        </div>

        <nav className="px-3 py-4 space-y-0.5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              data-testid={item.testid}
              className={({ isActive }) =>
                `relative flex items-center gap-3 px-4 py-2.5 rounded-sm text-sm transition-all duration-150 ${
                  isActive
                    ? "nav-active bg-ink-800 text-bone-100"
                    : "text-bone-300 hover:bg-ink-800 hover:text-bone-100"
                }`
              }
            >
              <item.icon size={16} className="opacity-70" />
              <span className="font-display tracking-wider uppercase text-xs">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="absolute md:relative bottom-0 inset-x-0 p-4 border-t border-ink-600">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] text-bone-100 font-semibold">{user?.name}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <ShieldCheck size={11} className={isAdmin ? "text-crimson-600" : "text-gold-600"} />
                <span className="text-[10px] tracking-[0.2em] uppercase text-bone-300">
                  {isAdmin ? "Administrator" : "View only"}
                </span>
              </div>
            </div>
            <button data-testid="logout-btn" onClick={logout} className="text-bone-300 hover:text-crimson-600 transition-colors">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {open && <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setOpen(false)} />}

      <main className="flex-1 md:ml-0 pt-14 md:pt-0 min-h-screen relative z-10">
        <div className="page-enter">{children}</div>
      </main>
    </div>
  );
}
