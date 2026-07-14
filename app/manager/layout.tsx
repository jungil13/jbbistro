"use client";
import AdminSidebar from "@/components/admin/AdminSidebar";
import NotificationBell from "@/components/admin/NotificationBell";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Search } from "lucide-react";

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  const [greeting, setGreeting] = useState("");
  const [userName, setUserName] = useState("Manager");
  const supabase = createClient();

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting("Good Morning");
    else if (h < 18) setGreeting("Good Afternoon");
    else setGreeting("Good Evening");

    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("first_name")
          .eq("id", user.id)
          .single();
        if (data?.first_name) setUserName(data.first_name);
      }
    };
    getUser();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <AdminSidebar role="manager" />

      {/* Main content area */}
      <div className="flex-1 lg:ml-60 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-14 lg:top-0 z-20 bg-white border-b border-gray-100 px-4 lg:px-6 h-14 lg:h-16 flex items-center gap-4 shadow-sm mt-14 lg:mt-0">
          <div className="flex-1">
            <p className="text-xs text-gray-400 hidden sm:block">{greeting},</p>
            <p className="text-sm font-bold text-gray-800 hidden sm:block">{userName} 👋</p>
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
          <div className="w-8 h-8 rounded-full bg-purple-900 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
            {userName[0]}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
