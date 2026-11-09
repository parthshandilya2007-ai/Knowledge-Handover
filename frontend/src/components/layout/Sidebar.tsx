import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FolderGit2,
  FileText,
  Cpu,
  FileCheck,
  Bot,
  User as UserIcon,
  LogOut,
  Shield,
  Layers
} from "lucide-react";
import { useAuth } from "../../features/auth/AuthContext";

interface NavItem {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
}

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Projects", href: "/projects", icon: FolderGit2 },
  { name: "Knowledge", href: "/sources", icon: FileText },
  { name: "Processing", href: "/processing", icon: Cpu },
  { name: "Handover", href: "/handover", icon: Layers },
  { name: "Review & Approvals", href: "/review", icon: FileCheck },
  { name: "AI Assistant", href: "/assistant", icon: Bot }
];

export function Sidebar({ mobileOpen, setMobileOpen }: { mobileOpen: boolean; setMobileOpen: (open: boolean) => void }) {
  const location = useLocation();
  const { user, logout } = useAuth();

  const isCurrent = (path: string) => {
    if (path === "/dashboard") return location.pathname === "/dashboard";
    return location.pathname.startsWith(path);
  };

  const navContent = (
    <div className="flex flex-col h-full justify-between bg-panel border-r border-surface-border">
      <div>
        {/* Brand */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-surface-border">
          <div className="w-8 h-8 rounded-lg bg-accent/20 border border-accent flex items-center justify-center text-accent">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight text-white">Knowledge Handover</h1>
            <p className="text-[11px] text-text-muted">Replace the Person, Not the Knowledge</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="px-3 py-4 space-y-1">
          {navigation.map((item) => {
            const active = isCurrent(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  active
                    ? "bg-accent/15 text-accent border border-accent/20 font-semibold"
                    : "text-text-secondary hover:text-white hover:bg-surface"
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? "text-accent" : "text-text-secondary"}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User info & Logout */}
      <div className="p-4 border-t border-surface-border">
        <Link
          to="/profile"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-surface transition-colors mb-2"
        >
          <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent font-semibold text-xs">
            {user?.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-xs font-medium text-white truncate">{user?.name || "User"}</p>
            <p className="text-[11px] text-text-muted truncate">{user?.email}</p>
          </div>
        </Link>

        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-text-secondary hover:text-red-400 hover:bg-red-950/20 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 fixed inset-y-0 z-30">{navContent}</aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-64 max-w-xs h-full z-10">{navContent}</div>
        </div>
      )}
    </>
  );
}
