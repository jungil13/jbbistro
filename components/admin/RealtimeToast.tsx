"use client";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

export default function RealtimeToast() {
  const supabase = createClient();

  useEffect(() => {
    let channel: any = null;

    const setupAuthAndListener = async () => {
      // 1. Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return; // Guests and unauthenticated users must NEVER receive internal reservation toasts

      // 2. Verify role-based permissions (only admin, manager, staff with reservations access)
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, can_reservations")
        .eq("id", user.id)
        .single();

      if (!profile) return;
      const isAuthorizedStaff =
        profile.role === "admin" ||
        profile.role === "manager" ||
        (profile.role === "staff" && profile.can_reservations !== false);

      if (!isAuthorizedStaff) {
        return; // Normal customers must NEVER receive global reservation broadcasts
      }

      // 3. Check if notifications are enabled in settings
      const { data: settingsData } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "realtime_notifications")
        .single();

      const notificationsEnabled = settingsData?.value !== "false";
      if (!notificationsEnabled) return;

      channel = supabase
        .channel("staff-reservations-toast")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "reservations" }, (payload) => {
          toast.custom((t) => (
            <div
              className={`${
                t.visible ? "animate-enter" : "animate-leave"
              } max-w-sm w-full bg-white shadow-xl rounded-2xl pointer-events-auto flex ring-1 ring-black/5 overflow-hidden border border-gray-100`}
            >
              <div className="p-4 flex-1">
                <div className="flex items-start">
                  <div className="flex-shrink-0 pt-0.5">
                    <div className="h-10 w-10 rounded-xl bg-red-50 text-red-700 flex items-center justify-center font-bold text-lg">
                      🛎️
                    </div>
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-bold text-gray-900">New Reservation Received</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {payload.new.customer_name} booked for {payload.new.date} at {payload.new.time_start}.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex border-l border-gray-100">
                <button
                  onClick={() => toast.dismiss(t.id)}
                  className="w-full px-4 flex items-center justify-center text-xs font-bold text-gray-500 hover:text-gray-800 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          ), { duration: 6000 });
        })
        .subscribe();
    };

    setupAuthAndListener();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
