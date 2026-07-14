"use client";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

export default function RealtimeToast() {
  const supabase = createClient();

  useEffect(() => {
    let settingsCache = true;

    // Check if notifications are enabled in settings
    const checkSettings = async () => {
      const { data } = await supabase.from("settings").select("value").eq("key", "realtime_notifications").single();
      if (data) settingsCache = data.value === "true";
    };
    checkSettings();

    const channel = supabase
      .channel("global-toast")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reservations" }, (payload) => {
        if (!settingsCache) return;
        toast.custom((t) => (
          <div
            className={`${
              t.visible ? "animate-enter" : "animate-leave"
            } max-w-sm w-full bg-white shadow-lg rounded-xl pointer-events-auto flex ring-1 ring-black ring-opacity-5 overflow-hidden`}
          >
            <div className="p-4 flex-1">
              <div className="flex items-start">
                <div className="flex-shrink-0 pt-0.5">
                  <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                    <span className="text-red-600 text-lg">🛎️</span>
                  </div>
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-bold text-gray-900">New Reservation!</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {payload.new.customer_name} just booked a service for {payload.new.date} at {payload.new.time_start}.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex border-l border-gray-200">
              <button
                onClick={() => toast.dismiss(t.id)}
                className="w-full border border-transparent rounded-none rounded-r-xl p-4 flex items-center justify-center text-sm font-medium text-red-600 hover:text-red-500 focus:outline-none"
              >
                Close
              </button>
            </div>
          </div>
        ), { duration: 5000 });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return null; // Invisible component
}
