"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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
  Utensils,
  Megaphone,
  CreditCard,
  Shield,
  MessageSquare,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import LogoutConfirmModal from "@/components/LogoutConfirmModal";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface StaffPermissions {
  can_dashboard?: boolean;
  can_reservations?: boolean;
  can_services?: boolean;
  can_billing?: boolean;
}

interface AdminSidebarProps {
  role?: "admin" | "manager" | "staff";
  unreadCount?: number;
  permissions?: StaffPermissions;
}

const adminNav: NavItem[] = [
  { label: "Analytics Hub", href: "/admin", icon: <LayoutDashboard size={18} /> },
  { label: "Reservations", href: "/admin/reservations", icon: <CalendarDays size={18} /> },
  { label: "Messages", href: "/admin/messages", icon: <MessageSquare size={18} /> },
  { label: "Customers", href: "/admin/customers", icon: <Users size={18} /> },
  { label: "Menu", href: "/admin/menu", icon: <Utensils size={18} /> },
  { label: "Services", href: "/admin/services", icon: <Layers size={18} /> },
  { label: "Announcements & Promos", href: "/admin/announcements", icon: <Megaphone size={18} /> },
  { label: "Staff Members", href: "/admin/staff", icon: <UserCog size={18} /> },
  { label: "Settings", href: "/admin/settings", icon: <Settings size={18} /> },
];

const managerNav: NavItem[] = [
  { label: "Analytics Hub", href: "/manager", icon: <LayoutDashboard size={18} /> },
  { label: "Reservations", href: "/manager/reservations", icon: <CalendarDays size={18} /> },
  { label: "Messages", href: "/manager/messages", icon: <MessageSquare size={18} /> },
  { label: "Customers", href: "/manager/customers", icon: <Users size={18} /> },
  { label: "Menu", href: "/manager/menu", icon: <Utensils size={18} /> },
  { label: "Services", href: "/manager/services", icon: <Layers size={18} /> },
  { label: "Announcements & Promos", href: "/manager/announcements", icon: <Megaphone size={18} /> },
  { label: "Settings", href: "/manager/settings", icon: <Settings size={18} /> },
];

export default function AdminSidebar({
  role: initialRole,
  unreadCount = 0,
  permissions: initialPermissions,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<{
    first_name?: string;
    last_name?: string;
    email?: string;
    role?: string;
  } | null>(null);
  const [effectiveRole, setEffectiveRole] = useState<"admin" | "manager" | "staff">(
    initialRole || "admin"
  );
  const [perms, setPerms] = useState<StaffPermissions>(initialPermissions || {});
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [unreadMsgCount, setUnreadMsgCount] = useState<number>(0);
  const supabase = createClient();

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const { count, error } = await supabase
          .from("contact_messages")
          .select("*", { count: "exact", head: true })
          .eq("status", "unread");
        if (!error && typeof count === "number") {
          setUnreadMsgCount(count);
        }
      } catch {
        // Table might not exist yet
      }
    };
    fetchUnread();

    const channel = supabase
      .channel("sidebar-contact-messages-count")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contact_messages" },
        () => {
          fetchUnread();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const getProfileAndPerms = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("first_name, last_name, email, role")
          .eq("id", user.id)
          .single();

        if (data) {
          setProfile(data);
          const detectedRole = (initialRole || data.role || "admin") as "admin" | "manager" | "staff";
          setEffectiveRole(detectedRole);

          if (detectedRole === "staff") {
            const { data: pData } = await supabase
              .from("staff_permissions")
              .select("*")
              .eq("staff_id", user.id)
              .single();
            if (pData) {
              setPerms(pData);
            }
          }
        }
      }
    };
    getProfileAndPerms();
  }, [initialRole]);

  useEffect(() => {
    if (initialPermissions) {
      setPerms(initialPermissions);
    }
  }, [initialPermissions]);

  // Construct staff navigation dynamically based on permissions
  const getStaffNav = (): NavItem[] => {
    const items: NavItem[] = [];

    if (perms.can_dashboard) {
      items.push({
        label: "Analytics Hub",
        href: "/admin",
        icon: <LayoutDashboard size={18} />,
      });
    }

    if (perms.can_reservations) {
      items.push({
        label: "Reservations",
        href: "/admin/reservations",
        icon: <CalendarDays size={18} />,
      });
    }

    if (perms.can_services) {
      items.push({
        label: "Services",
        href: "/admin/services",
        icon: <Layers size={18} />,
      });
    }

    if (perms.can_billing) {
      // Direct shortcut for staff with billing permissions
      items.push({
        label: "Billing & Walk-Ins",
        href: "/admin/reservations?view=walkin",
        icon: <CreditCard size={18} />,
      });
    }

    return items;
  };

  const nav =
    effectiveRole === "staff"
      ? getStaffNav()
      : effectiveRole === "manager"
      ? managerNav
      : adminNav;

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await supabase.auth.signOut();
      window.location.href = "/login";
    } finally {
      setIsLoggingOut(false);
    }
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
        <div className="flex items-center gap-1.5 mt-1.5 ml-10">
          {effectiveRole === "staff" && <Shield size={10} className="text-red-300" />}
          <p className="text-white/60 text-[10px] font-semibold tracking-wider uppercase">
            {effectiveRole === "staff"
              ? "Staff Portal"
              : effectiveRole === "manager"
              ? "Manager Panel"
              : "Admin Panel"}
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {nav.map((item) => {
          // Parse href into path and query parts
          const [itemPath, itemQuery] = item.href.split("?");
          const currentQuery = searchParams.toString();

          let active: boolean;
          if (itemQuery) {
            // For items with a query string (e.g. ?view=walkin), match BOTH path AND query
            active = pathname === itemPath && currentQuery === itemQuery;
          } else {
            // For plain path items, match path only — but ensure a query-string variant isn't active
            active = pathname === itemPath && !currentQuery;
          }
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
              {item.label === "Messages" && unreadMsgCount > 0 && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    active
                      ? "bg-red-800 text-white"
                      : "bg-red-500 text-white animate-pulse"
                  }`}
                >
                  {unreadMsgCount > 9 ? "9+" : unreadMsgCount}
                </span>
              )}
              {active && <ChevronRight size={14} className="text-red-400" />}
            </Link>
          );
        })}

        {effectiveRole === "staff" && nav.length === 0 && (
          <div className="p-4 text-center text-xs text-white/50 bg-white/5 rounded-xl my-4">
            No permissions active yet. Please ask an admin to assign modules to your account.
          </div>
        )}
      </nav>

      {/* User Card */}
      <div className="p-3 border-t border-white/10">
        <div className="bg-white/10 rounded-xl p-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-300 flex items-center justify-center text-red-900 font-bold text-xs flex-shrink-0">
              {profile?.first_name?.[0] ?? "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">
                {profile?.first_name && profile?.last_name
                  ? `${profile.first_name} ${profile.last_name}`
                  : profile?.email || "User"}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="text-red-300 text-[10px] uppercase font-bold tracking-wide">
                  {effectiveRole}
                </span>
                <span className="text-white/30 text-[10px]">•</span>
                <p className="text-white/40 text-[10px] truncate">{profile?.email ?? ""}</p>
              </div>
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowLogoutModal(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all text-xs font-medium cursor-pointer"
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

      <LogoutConfirmModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
        isLoading={isLoggingOut}
      />
    </>
  );
}
