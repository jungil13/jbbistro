"use client";

import AdminSidebar from "@/components/admin/AdminSidebar";
import NotificationBell from "@/components/admin/NotificationBell";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Shield,
  CalendarDays,
  Layers,
  CreditCard,
  AlertCircle,
  ArrowRight,
  Clock,
} from "lucide-react";

interface PermissionsState {
  can_dashboard: boolean;
  can_reservations: boolean;
  can_services: boolean;
  can_billing?: boolean;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [greeting, setGreeting] = useState("");
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState<"admin" | "manager" | "staff">("staff");
  const [permissions, setPermissions] = useState<PermissionsState>({
    can_dashboard: false,
    can_reservations: false,
    can_services: false,
    can_billing: false,
  });
  const [loadingUser, setLoadingUser] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting("Good Morning");
    else if (h < 18) setGreeting("Good Afternoon");
    else setGreeting("Good Evening");

    const getUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, last_name, role")
            .eq("id", user.id)
            .single();

          const role = (profile?.role as "admin" | "manager" | "staff") || "staff";
          setUserRole(role);

          const firstName = profile?.first_name?.trim();
          let displayName = "";
          if (firstName) {
            displayName = firstName;
          } else if (role === "admin") {
            displayName = "Admin";
          } else if (role === "manager") {
            displayName = "Manager";
          } else {
            displayName = user.email?.split("@")[0] || "Staff";
          }
          setUserName(displayName);

            if (role === "staff") {
              const { data: perms } = await supabase
                .from("staff_permissions")
                .select("*")
                .eq("staff_id", user.id)
                .single();

              if (perms) {
                setPermissions({
                  can_dashboard: Boolean(perms.can_dashboard),
                  can_reservations: Boolean(perms.can_reservations),
                  can_services: Boolean(perms.can_services),
                  can_billing: Boolean(perms.can_billing),
                });
              } else {
                setPermissions({
                  can_dashboard: false,
                  can_reservations: false,
                  can_services: false,
                  can_billing: false,
                });
              }
            } else {
              // Admin or manager has full module access
              setPermissions({
                can_dashboard: true,
                can_reservations: true,
                can_services: true,
                can_billing: true,
              });
            }
          }
      } catch (err) {
        console.error("Error loading user profile in layout:", err);
      } finally {
        setLoadingUser(false);
      }
    };
    getUser();
  }, []);

  // Show clean animated loading spinner while session & role permissions resolve
  if (loadingUser) {
    return (
      <div className="min-h-screen bg-gray-50/80 flex flex-col items-center justify-center p-4">
        {/* Hidden accessible text retained in DOM */}
        <div className="sr-only" aria-live="polite">
          <h2>Verifying Security Access</h2>
          <p>Authenticating session and role permissions...</p>
        </div>

        {/* Elegant Bistro Loading Animation Spinner */}
        <div className="relative flex items-center justify-center">
          {/* Outer glowing pulse ring */}
          <div className="absolute w-16 h-16 rounded-full bg-red-900/10 animate-ping duration-1000" />
          
          {/* Main spinning gradient dual-ring */}
          <div className="w-12 h-12 rounded-full border-3 border-gray-200 border-t-[#8B1327] border-r-[#c9a84c] animate-spin" />

          {/* Inner accent dot */}
          <div className="absolute w-2.5 h-2.5 rounded-full bg-[#8B1327]" />
        </div>
      </div>
    );
  }

  // Determine if the current staff user is trying to view dashboard (/admin) without can_dashboard permission
  const isStaffWithoutDashboard =
    userRole === "staff" &&
    pathname === "/admin" &&
    !permissions.can_dashboard;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <AdminSidebar role={userRole} permissions={permissions} />

      {/* Main content area */}
      <div className="flex-1 lg:ml-60 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-14 lg:top-0 z-20 bg-white border-b border-gray-100 px-4 lg:px-6 h-14 lg:h-16 flex items-center gap-4 shadow-sm mt-14 lg:mt-0">
          <div className="flex-1 flex items-center gap-3">
            <div>
              <p className="text-xs text-gray-400 hidden sm:block">{greeting},</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-gray-800">{userName || (userRole === "admin" ? "Admin" : "Staff")} 👋</p>
                <span
                  className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                    userRole === "admin"
                      ? "bg-red-100 text-red-800 border-red-200"
                      : userRole === "manager"
                      ? "bg-purple-100 text-purple-800 border-purple-200"
                      : "bg-blue-100 text-blue-800 border-blue-200"
                  }`}
                >
                  {userRole}
                </span>
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 w-48">
            <Search size={14} className="text-gray-400" />
            <input
              type="text"
              placeholder="Quick search…"
              className="bg-transparent text-sm text-gray-600 placeholder-gray-400 outline-none flex-1 w-full"
            />
          </div>

          <NotificationBell />

          <div className="w-8 h-8 rounded-full bg-red-900 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm">
            {(userName[0] || (userRole === "admin" ? "A" : "S")).toUpperCase()}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">
          {isStaffWithoutDashboard ? (
            /* Friendly Staff Landing Hub if they lack dashboard analytics permission */
            <div className="max-w-2xl mx-auto py-12 px-4 text-center space-y-6">
              <div className="w-16 h-16 bg-blue-50 text-blue-700 rounded-3xl flex items-center justify-center mx-auto shadow-inner border border-blue-100">
                <Shield size={32} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">
                  Welcome to Jbenz Bistro Staff Portal
                </h1>
                <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
                  You are signed in as <strong className="text-gray-700">{userName}</strong>. Select
                  one of your assigned operational modules below to begin your shift:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left pt-2">
                {permissions.can_reservations && (
                  <Link
                    href="/admin/reservations"
                    className="p-5 bg-white border border-gray-200/80 rounded-2xl shadow-sm hover:border-red-900 hover:shadow-md transition-all group no-underline"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                        <CalendarDays size={20} />
                      </div>
                      <ArrowRight
                        size={16}
                        className="text-gray-300 group-hover:text-red-900 group-hover:translate-x-1 transition-all"
                      />
                    </div>
                    <h3 className="font-bold text-gray-800 text-sm group-hover:text-red-900 transition-colors">
                      Reservations
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Check booking arrivals, approve schedules, and manage status
                    </p>
                  </Link>
                )}

                {permissions.can_services && (
                  <Link
                    href="/admin/services"
                    className="p-5 bg-white border border-gray-200/80 rounded-2xl shadow-sm hover:border-red-900 hover:shadow-md transition-all group no-underline"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                        <Layers size={20} />
                      </div>
                      <ArrowRight
                        size={16}
                        className="text-gray-300 group-hover:text-red-900 group-hover:translate-x-1 transition-all"
                      />
                    </div>
                    <h3 className="font-bold text-gray-800 text-sm group-hover:text-red-900 transition-colors">
                      Services & Rooms
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Update table and karaoke room availability in real-time
                    </p>
                  </Link>
                )}
              </div>

              {!permissions.can_reservations &&
                !permissions.can_services && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center space-y-2 max-w-md mx-auto">
                    <Clock size={28} className="text-amber-600 mx-auto" />
                    <h4 className="font-bold text-amber-900 text-sm">
                      No Active Permissions Assigned
                    </h4>
                    <p className="text-xs text-amber-700">
                      Your staff account is verified, but an administrator has not yet assigned any
                      operational module permissions. Please contact your manager.
                    </p>
                  </div>
                )}
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
