"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Layers,
  UserCog,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Bell,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface AdminSidebarProps {
  role?: "admin" | "manager";
  unreadCount?: number;
}

const adminNav: NavItem[] = [
  { label: "Analytics Hub", href: "/admin", icon: <LayoutDashboard size={18} /> },
  { label: "Reservations", href: "/admin/reservations", icon: <CalendarDays size={18} /> },
  { label: "Customers", href: "/admin/customers", icon: <Users size={18} /> },
  { label: "Services", href: "/admin/services", icon: <Layers size={18} /> },
  { label: "Staff Members", href: "/admin/staff", icon: <UserCog size={18} /> },
  { label: "Settings", href: "/admin/settings", icon: <Settings size={18} /> },
];

const managerNav: NavItem[] = [
  { label: "Analytics Hub", href: "/manager", icon: <LayoutDashboard size={18} /> },
  { label: "Reservations", href: "/manager/reservations", icon: <CalendarDays size={18} /> },
  { label: "Customers", href: "/manager/customers", icon: <Users size={18} /> },
  { label: "Services", href: "/manager/services", icon: <Layers size={18} /> },
  { label: "Settings", href: "/manager/settings", icon: <Settings size={18} /> },
];

export default function AdminSidebar({ role = "admin", unreadCount = 0 }: AdminSidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<{ first_name?: string; last_name?: string; email?: string } | null>(null);
  const supabase = createClient();
  const nav = role === "admin" ? adminNav : managerNav;

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("first_name, last_name, email")
          .eq("id", user.id)
          .single();
        setProfile(data);
      }
    };
    getProfile();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <Link href="/" className="flex items-center gap-2 no-underline">
          <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
            <span className="font-bold text-white text-xs">JB</span>
          </div>
          <div>
            <span className="text-white font-bold text-sm font-playfair">Jbenz</span>
            <span className="text-red-300 font-semibold text-sm font-playfair"> Bistro</span>
          </div>
        </Link>
        <p className="text-white/40 text-[10px] mt-1 ml-10 capitalize">{role} Panel</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {nav.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all no-underline group ${
                active
                  ? "bg-white text-red-900 shadow-md"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className={active ? "text-red-800" : "text-white/50 group-hover:text-white"}>
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
              {active && <ChevronRight size={14} className="text-red-400" />}
            </Link>
          );
        })}
      </nav>

      {/* User Card */}
      <div className="p-3 border-t border-white/10">
        <div className="bg-white/10 rounded-xl p-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-300 flex items-center justify-center text-red-900 font-bold text-xs flex-shrink-0">
              {profile?.first_name?.[0] ?? "A"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">
                {profile?.first_name && profile?.last_name
                  ? `${profile.first_name} ${profile.last_name}`
                  : "Admin User"}
              </p>
              <p className="text-white/40 text-[10px] truncate">{profile?.email ?? ""}</p>
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all text-xs font-medium"
        >
          <LogOut size={14} />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Topbar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-red-900 px-4 h-14 flex items-center justify-between shadow-lg">
        <Link href="/" className="flex items-center gap-2 no-underline">
          <span className="text-white font-bold font-playfair text-lg">Jbenz</span>
          <span className="text-red-300 font-bold font-playfair text-lg">Bistro</span>
        </Link>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <div className="relative">
              <Bell size={20} className="text-white" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-white text-red-900 text-[9px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            </div>
          )}
          <button onClick={() => setOpen(!open)} className="text-white p-1">
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={`lg:hidden fixed top-0 left-0 bottom-0 z-50 w-64 bg-red-900 transform transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="pt-14 h-full">
          <SidebarContent />
        </div>
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col fixed top-0 left-0 bottom-0 w-60 bg-gradient-to-b from-red-950 to-red-900 z-30 shadow-2xl">
        <SidebarContent />
      </aside>
    </>
  );
}
