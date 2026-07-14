"use client";
import { useEffect, useState } from "react";
import {
  PhilippinePeso,
  CalendarDays,
  Users,
  TrendingUp,
  Clock,
  Mic2,
  Layers,
} from "lucide-react";
import StatCard from "@/components/admin/StatCard";
import { createClient } from "@/lib/supabase/client";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const COLORS = ["#991b1b", "#c9a84c", "#374151", "#dc2626", "#b45309"];

// Actual data is fetched from the database below
interface Stats {
  totalRevenue: number;
  totalReservations: number;
  customerCount: number;
  growthRate: number;
  pendingCount: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalRevenue: 0,
    totalReservations: 0,
    customerCount: 0,
    growthRate: 0,
    pendingCount: 0,
  });
  const [reservationTrendData, setReservationTrendData] = useState<any[]>([]);
  const [peakHoursData, setPeakHoursData] = useState<any[]>([]);
  const [popularServicesData, setPopularServicesData] = useState<any[]>([]);
  const [recentReservations, setRecentReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const loadStats = async () => {
      try {
        // Total reservations
        const { count: totalRes } = await supabase
          .from("reservations")
          .select("*", { count: "exact", head: true });

        // Pending reservations
        const { count: pendingRes } = await supabase
          .from("reservations")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending");

        // Customer count (unique emails)
        const { count: custCount } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("role", "customer");

        // Total revenue from confirmed reservations
        const { data: revData } = await supabase
          .from("reservations")
          .select("total_amount")
          .eq("status", "confirmed");
        const totalRev = revData?.reduce((sum, r) => sum + (r.total_amount || 0), 0) ?? 0;

        // Growth rate (this month vs last month reservations)
        const now = new Date();
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
        const { count: thisMonth } = await supabase
          .from("reservations")
          .select("*", { count: "exact", head: true })
          .gte("created_at", firstOfMonth);
        const { count: lastMonth } = await supabase
          .from("reservations")
          .select("*", { count: "exact", head: true })
          .gte("created_at", firstOfLastMonth)
          .lt("created_at", firstOfMonth);
        const growth = lastMonth && lastMonth > 0
          ? Math.round(((thisMonth ?? 0) - lastMonth) / lastMonth * 100)
          : 0;

        // Recent reservations
        const { data: recent } = await supabase
          .from("reservations")
          .select("*, services(name, type)")
          .order("created_at", { ascending: false })
          .limit(5);

        setStats({
          totalRevenue: totalRev,
          totalReservations: totalRes ?? 0,
          customerCount: custCount ?? 0,
          growthRate: growth,
          pendingCount: pendingRes ?? 0,
        });
        setRecentReservations(recent ?? []);

        // --- FETCH DATA FOR CHARTS ---
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: chartDataRaw } = await supabase
          .from("reservations")
          .select("created_at, time_start, services(name)")
          .gte("created_at", thirtyDaysAgo);

        if (chartDataRaw) {
          const trendMap: Record<string, number> = {};
          const hourMap: Record<string, number> = {};
          const serviceMap: Record<string, number> = {};

          chartDataRaw.forEach((r) => {
            // Trend (group by day)
            const dateStr = new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
            trendMap[dateStr] = (trendMap[dateStr] || 0) + 1;

            // Peak hours
            if (r.time_start) {
              const hourStr = r.time_start.split(":")[0];
              const hourNum = parseInt(hourStr, 10);
              const ampm = hourNum >= 12 ? "PM" : "AM";
              const displayHour = hourNum % 12 === 0 ? 12 : hourNum % 12;
              const label = `${displayHour}${ampm}`;
              hourMap[label] = (hourMap[label] || 0) + 1;
            }

            // Popular services
            const sName = r.services?.name || "Unknown";
            serviceMap[sName] = (serviceMap[sName] || 0) + 1;
          });

          // Trend: last 7 days
          const last7Days = Array.from({ length: 7 }).map((_, i) => {
            const d = new Date(now);
            d.setDate(d.getDate() - (6 - i));
            const ds = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            return { date: ds, reservations: trendMap[ds] || 0 };
          });
          setReservationTrendData(last7Days);

          // Peak Hours: 10AM to 11PM
          const hourOrder = ["10AM", "11AM", "12PM", "1PM", "2PM", "3PM", "4PM", "5PM", "6PM", "7PM", "8PM", "9PM", "10PM", "11PM"];
          setPeakHoursData(hourOrder.map(h => ({ hour: h, bookings: hourMap[h] || 0 })));

          // Popular Services: Top 5
          setPopularServicesData(
            Object.keys(serviceMap)
              .map(k => ({ name: k, value: serviceMap[k] }))
              .sort((a, b) => b.value - a.value)
              .slice(0, 5)
          );
        }
      } catch (err) {
        console.error("Error loading stats:", err);
      } finally {
        setLoading(false);
      }
    };

    loadStats();

    // Realtime: refresh on new reservation
    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => {
        loadStats();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-700",
      confirmed: "bg-green-100 text-green-700",
      cancelled: "bg-red-100 text-red-600",
    };
    return (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${map[status] ?? "bg-gray-100 text-gray-500"}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-800">Analytics Hub</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Real-time overview of your bistro performance
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Revenue"
          value={`₱${stats.totalRevenue.toLocaleString()}`}
          subtitle="From confirmed bookings"
          trend={12}
          icon={<PhilippinePeso size={20} />}
          color="green"
        />
        <StatCard
          title="Total Reservations"
          value={stats.totalReservations}
          subtitle={`${stats.pendingCount} pending approval`}
          trend={8}
          icon={<CalendarDays size={20} />}
          color="blue"
        />
        <StatCard
          title="Customers"
          value={stats.customerCount}
          subtitle="Registered users"
          trend={5}
          icon={<Users size={20} />}
          color="purple"
        />
        <StatCard
          title="Growth Rate"
          value={`${stats.growthRate > 0 ? "+" : ""}${stats.growthRate}%`}
          subtitle="Month-over-month"
          trend={stats.growthRate}
          icon={<TrendingUp size={20} />}
          color="orange"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Reservation Trends (full width) */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-gray-800">Reservation Trends</h2>
              <p className="text-xs text-gray-400">Last 14 days</p>
            </div>
            <CalendarDays size={16} className="text-gray-300" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={reservationTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <Tooltip
                contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", fontSize: "12px" }}
              />
              <Line
                type="monotone"
                dataKey="reservations"
                stroke="#991b1b"
                strokeWidth={2.5}
                dot={{ fill: "#991b1b", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Popular Services Pie */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-gray-800">Popular Services</h2>
              <p className="text-xs text-gray-400">Booking distribution</p>
            </div>
            <Layers size={16} className="text-gray-300" />
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={popularServicesData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={65}
                dataKey="value"
                paddingAngle={3}
              >
                {popularServicesData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: "12px", fontSize: "11px" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1 mt-2">
            {popularServicesData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-2 text-xs">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-gray-600 flex-1 truncate">{entry.name}</span>
                <span className="text-gray-400 font-semibold">{entry.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Peak Hours Chart */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-gray-800">Peak Hours</h2>
            <p className="text-xs text-gray-400">Busiest times of the day</p>
          </div>
          <Clock size={16} className="text-gray-300" />
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={peakHoursData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#9ca3af" }} />
            <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
            <Tooltip
              contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", fontSize: "12px" }}
            />
            <Bar dataKey="bookings" fill="#991b1b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Reservations Table */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-gray-800">Recent Reservations</h2>
            <p className="text-xs text-gray-400">Latest 5 bookings</p>
          </div>
          <a href="/admin/reservations" className="text-xs text-red-700 font-semibold hover:underline">
            View all →
          </a>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map((i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : recentReservations.length === 0 ? (
          <div className="text-center py-8">
            <CalendarDays size={32} className="text-gray-200 mx-auto mb-2" />
            <p className="text-xs text-gray-400">No reservations yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  {["ID", "Customer", "Service", "Date", "Guests", "Status"].map((h) => (
                    <th key={h} className="text-left py-2 px-3 text-gray-400 font-semibold uppercase tracking-wide text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentReservations.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-gray-500">{r.reservation_code ?? r.id.slice(0, 8)}</td>
                    <td className="py-2.5 px-3 font-semibold text-gray-700">{r.customer_name ?? "—"}</td>
                    <td className="py-2.5 px-3 text-gray-500">{r.services?.name ?? "—"}</td>
                    <td className="py-2.5 px-3 text-gray-500">{r.date}</td>
                    <td className="py-2.5 px-3 text-gray-500">{r.guests}</td>
                    <td className="py-2.5 px-3">{statusBadge(r.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
