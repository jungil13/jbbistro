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
  Plus,
  Banknote,
  Sparkles,
  ShoppingBag,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
} from "lucide-react";
import StatCard from "@/components/admin/StatCard";
import RecordWalkInModal from "@/components/admin/RecordWalkInModal";
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
  AreaChart,
  Area,
} from "recharts";
import { format, startOfWeek, endOfWeek, subDays, subWeeks, subMonths, isWithinInterval } from "date-fns";

const COLORS = ["#991b1b", "#c9a84c", "#374151", "#dc2626", "#b45309"];

interface Stats {
  totalRevenue: number;
  totalReservations: number;
  customerCount: number;
  growthRate: number;
  pendingCount: number;
  walkInRevenue: number;
  onlineRevenue: number;
}

type RevenueTimeframe = "daily" | "weekly" | "monthly";

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalRevenue: 0,
    totalReservations: 0,
    customerCount: 0,
    growthRate: 0,
    pendingCount: 0,
    walkInRevenue: 0,
    onlineRevenue: 0,
  });

  const [timeframe, setTimeframe] = useState<RevenueTimeframe>("daily");
  const [revenueChartData, setRevenueChartData] = useState<any[]>([]);
  const [periodSummary, setPeriodSummary] = useState({
    total: 0,
    walkIn: 0,
    online: 0,
    walkInCount: 0,
    onlineCount: 0,
  });

  const [reservationTrendData, setReservationTrendData] = useState<any[]>([]);
  const [peakHoursData, setPeakHoursData] = useState<any[]>([]);
  const [popularServicesData, setPopularServicesData] = useState<any[]>([]);
  const [recentReservations, setRecentReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const supabase = createClient();

  const isWalkIn = (r: any) => {
    return (
      (r.notes && r.notes.toLowerCase().includes("walk-in")) ||
      (r.reservation_code && r.reservation_code.startsWith("WALK-")) ||
      (r.customer_email && r.customer_email === "walkin@jbenzbistro.local")
    );
  };

  const loadStats = async () => {
    try {
      // 1. All confirmed reservations for revenue analytics
      const { data: allConfirmed } = await supabase
        .from("reservations")
        .select("id, reservation_code, total_amount, created_at, date, notes, customer_email")
        .eq("status", "confirmed");

      const confirmedList = allConfirmed || [];

      // Calculate Walk-in vs Online revenue
      let totalRev = 0;
      let walkInRev = 0;
      let onlineRev = 0;

      confirmedList.forEach((r) => {
        const amt = Number(r.total_amount || 0);
        totalRev += amt;
        if (isWalkIn(r)) {
          walkInRev += amt;
        } else {
          onlineRev += amt;
        }
      });

      // Total reservations count
      const { count: totalRes } = await supabase
        .from("reservations")
        .select("*", { count: "exact", head: true });

      // Pending reservations
      const { count: pendingRes } = await supabase
        .from("reservations")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      // Customer count (registered profiles)
      const { count: custCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "customer");

      // Growth rate (this month vs last month confirmed reservations)
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
      const growth =
        lastMonth && lastMonth > 0 ? Math.round((((thisMonth ?? 0) - lastMonth) / lastMonth) * 100) : 0;

      // Recent reservations
      const { data: recent } = await supabase
        .from("reservations")
        .select("*, services(name, type)")
        .order("created_at", { ascending: false })
        .limit(6);

      setStats({
        totalRevenue: totalRev,
        walkInRevenue: walkInRev,
        onlineRevenue: onlineRev,
        totalReservations: totalRes ?? 0,
        customerCount: custCount ?? 0,
        growthRate: growth,
        pendingCount: pendingRes ?? 0,
      });
      setRecentReservations(recent ?? []);

      // Build Revenue Breakdown based on selected timeframe
      computeRevenueBreakdown(confirmedList, timeframe);

      // --- FETCH DATA FOR OTHER CHARTS ---
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
          const servicesVal = r.services as any;
          const sName = (Array.isArray(servicesVal) ? servicesVal[0]?.name : servicesVal?.name) || "Dining Area";
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
        setPeakHoursData(hourOrder.map((h) => ({ hour: h, bookings: hourMap[h] || 0 })));

        // Popular Services: Top 5
        setPopularServicesData(
          Object.keys(serviceMap)
            .map((k) => ({ name: k, value: serviceMap[k] }))
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

  const computeRevenueBreakdown = (confirmedList: any[], mode: RevenueTimeframe) => {
    const now = new Date();

    if (mode === "daily") {
      // Last 7 days breakdown
      const days = Array.from({ length: 7 }).map((_, i) => {
        const d = subDays(now, 6 - i);
        return {
          key: format(d, "yyyy-MM-dd"),
          label: format(d, "EEE, MMM d"),
          walkIn: 0,
          online: 0,
          total: 0,
          walkInCount: 0,
          onlineCount: 0,
        };
      });

      const dayMap = Object.fromEntries(days.map((d) => [d.key, d]));

      confirmedList.forEach((r) => {
        const rDate = format(new Date(r.created_at || r.date), "yyyy-MM-dd");
        if (dayMap[rDate]) {
          const amt = Number(r.total_amount || 0);
          if (isWalkIn(r)) {
            dayMap[rDate].walkIn += amt;
            dayMap[rDate].walkInCount += 1;
          } else {
            dayMap[rDate].online += amt;
            dayMap[rDate].onlineCount += 1;
          }
          dayMap[rDate].total += amt;
        }
      });

      const chartPoints = Object.values(dayMap);
      setRevenueChartData(chartPoints);

      // Period summary for current daily period (last 7 days)
      const sumWalk = chartPoints.reduce((acc, p) => acc + p.walkIn, 0);
      const sumOnline = chartPoints.reduce((acc, p) => acc + p.online, 0);
      const countWalk = chartPoints.reduce((acc, p) => acc + p.walkInCount, 0);
      const countOnline = chartPoints.reduce((acc, p) => acc + p.onlineCount, 0);
      setPeriodSummary({
        total: sumWalk + sumOnline,
        walkIn: sumWalk,
        online: sumOnline,
        walkInCount: countWalk,
        onlineCount: countOnline,
      });
    } else if (mode === "weekly") {
      // Last 5 weeks breakdown
      const weeks = Array.from({ length: 5 }).map((_, i) => {
        const d = subWeeks(now, 4 - i);
        const start = startOfWeek(d, { weekStartsOn: 1 });
        const end = endOfWeek(d, { weekStartsOn: 1 });
        return {
          start,
          end,
          label: `Week of ${format(start, "MMM d")}`,
          walkIn: 0,
          online: 0,
          total: 0,
          walkInCount: 0,
          onlineCount: 0,
        };
      });

      confirmedList.forEach((r) => {
        const rDate = new Date(r.created_at || r.date);
        const amt = Number(r.total_amount || 0);
        const matchedWeek = weeks.find((w) => isWithinInterval(rDate, { start: w.start, end: w.end }));
        if (matchedWeek) {
          if (isWalkIn(r)) {
            matchedWeek.walkIn += amt;
            matchedWeek.walkInCount += 1;
          } else {
            matchedWeek.online += amt;
            matchedWeek.onlineCount += 1;
          }
          matchedWeek.total += amt;
        }
      });

      setRevenueChartData(weeks);

      const sumWalk = weeks.reduce((acc, w) => acc + w.walkIn, 0);
      const sumOnline = weeks.reduce((acc, w) => acc + w.online, 0);
      const countWalk = weeks.reduce((acc, w) => acc + w.walkInCount, 0);
      const countOnline = weeks.reduce((acc, w) => acc + w.onlineCount, 0);
      setPeriodSummary({
        total: sumWalk + sumOnline,
        walkIn: sumWalk,
        online: sumOnline,
        walkInCount: countWalk,
        onlineCount: countOnline,
      });
    } else if (mode === "monthly") {
      // Last 6 months breakdown
      const months = Array.from({ length: 6 }).map((_, i) => {
        const d = subMonths(now, 5 - i);
        return {
          yearMonth: format(d, "yyyy-MM"),
          label: format(d, "MMM yyyy"),
          walkIn: 0,
          online: 0,
          total: 0,
          walkInCount: 0,
          onlineCount: 0,
        };
      });

      const monthMap = Object.fromEntries(months.map((m) => [m.yearMonth, m]));

      confirmedList.forEach((r) => {
        const ym = format(new Date(r.created_at || r.date), "yyyy-MM");
        if (monthMap[ym]) {
          const amt = Number(r.total_amount || 0);
          if (isWalkIn(r)) {
            monthMap[ym].walkIn += amt;
            monthMap[ym].walkInCount += 1;
          } else {
            monthMap[ym].online += amt;
            monthMap[ym].onlineCount += 1;
          }
          monthMap[ym].total += amt;
        }
      });

      const chartPoints = Object.values(monthMap);
      setRevenueChartData(chartPoints);

      const sumWalk = chartPoints.reduce((acc, m) => acc + m.walkIn, 0);
      const sumOnline = chartPoints.reduce((acc, m) => acc + m.online, 0);
      const countWalk = chartPoints.reduce((acc, m) => acc + m.walkInCount, 0);
      const countOnline = chartPoints.reduce((acc, m) => acc + m.onlineCount, 0);
      setPeriodSummary({
        total: sumWalk + sumOnline,
        walkIn: sumWalk,
        online: sumOnline,
        walkInCount: countWalk,
        onlineCount: countOnline,
      });
    }
  };

  useEffect(() => {
    loadStats();

    // Realtime: refresh on any reservation change
    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => {
        loadStats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // When timeframe toggle changes, recompute
  const handleTimeframeChange = async (newTf: RevenueTimeframe) => {
    setTimeframe(newTf);
    const { data: allConfirmed } = await supabase
      .from("reservations")
      .select("id, reservation_code, total_amount, created_at, date, notes, customer_email")
      .eq("status", "confirmed");
    if (allConfirmed) {
      computeRevenueBreakdown(allConfirmed, newTf);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-700",
      confirmed: "bg-green-100 text-green-700",
      cancelled: "bg-red-100 text-red-600",
    };
    return (
      <span
        className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
          map[status] ?? "bg-gray-100 text-gray-500"
        }`}
      >
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Analytics Hub</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Real-time revenue, reservations, and walk-in sales performance
          </p>
        </div>

        {/* Quick Action: Record Walk-In Sale */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowWalkInModal(true)}
            className="flex items-center gap-2 bg-[#3d0a14] hover:bg-[#5c1020] text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md shadow-[#3d0a14]/20"
          >
            <Banknote size={16} className="text-[#c9a84c]" />
            + Record Walk-In Sale
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Lifetime Revenue"
          value={`₱${stats.totalRevenue.toLocaleString()}`}
          subtitle={`Walk-in: ₱${stats.walkInRevenue.toLocaleString()} | Online: ₱${stats.onlineRevenue.toLocaleString()}`}
          trend={12}
          icon={<PhilippinePeso size={20} />}
          color="green"
        />
        <StatCard
          title="Total Bookings"
          value={stats.totalReservations}
          subtitle={`${stats.pendingCount} pending approval`}
          trend={8}
          icon={<CalendarDays size={20} />}
          color="blue"
        />
        <StatCard
          title="Walk-In Revenue Share"
          value={`${stats.totalRevenue > 0 ? Math.round((stats.walkInRevenue / stats.totalRevenue) * 100) : 0}%`}
          subtitle={`₱${stats.walkInRevenue.toLocaleString()} total walk-in sales`}
          trend={15}
          icon={<ShoppingBag size={20} />}
          color="orange"
        />
        <StatCard
          title="Growth Rate"
          value={`${stats.growthRate > 0 ? "+" : ""}${stats.growthRate}%`}
          subtitle="Month-over-month bookings"
          trend={stats.growthRate}
          icon={<TrendingUp size={20} />}
          color="purple"
        />
      </div>

      {/* ── NEW DEDICATED REVENUE ANALYTICS SECTION (DAILY / WEEKLY / MONTHLY + WALK-IN) ── */}
      <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-6">
        {/* Header & Timeframe Switcher */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-[#3d0a14] flex items-center justify-center font-bold">
                <PhilippinePeso size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-800">
                  Revenue Analytics & Walk-In Breakdown
                </h2>
                <p className="text-xs text-gray-400">
                  Track Daily, Weekly, and Monthly revenue from online reservations and walk-in customers
                </p>
              </div>
            </div>
          </div>

          {/* Timeframe Switcher */}
          <div className="flex items-center p-1 bg-gray-100 rounded-xl">
            {(["daily", "weekly", "monthly"] as RevenueTimeframe[]).map((tf) => (
              <button
                key={tf}
                onClick={() => handleTimeframeChange(tf)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                  timeframe === tf
                    ? "bg-white text-[#3d0a14] shadow-sm"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {tf === "daily" ? "Daily (7 Days)" : tf === "weekly" ? "Weekly (5 Wks)" : "Monthly (6 Mos)"}
              </button>
            ))}
          </div>
        </div>

        {/* Breakdown Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Total Period Revenue */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100/60 border border-gray-200">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              {timeframe} Total Revenue
            </span>
            <p className="text-2xl font-extrabold text-gray-900 mt-1">
              ₱{periodSummary.total.toLocaleString()}
            </p>
            <p className="text-[11px] text-gray-400 mt-1">
              {periodSummary.walkInCount + periodSummary.onlineCount} total orders/bookings
            </p>
          </div>

          {/* Walk-In Customer Revenue */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50/70 to-orange-50/50 border border-amber-200/70">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1">
                <Banknote size={14} className="text-[#c9a84c]" /> Walk-In Revenue
              </span>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#c9a84c] text-[#3d0a14]">
                {periodSummary.total > 0 ? Math.round((periodSummary.walkIn / periodSummary.total) * 100) : 0}%
              </span>
            </div>
            <p className="text-2xl font-extrabold text-[#3d0a14] mt-1">
              ₱{periodSummary.walkIn.toLocaleString()}
            </p>
            <p className="text-[11px] text-amber-800/80 mt-1">
              {periodSummary.walkInCount} walk-in customer purchases
            </p>
          </div>

          {/* Online Reservation Revenue */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-50/60 to-red-50/40 border border-red-200/60">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-red-900 uppercase tracking-wider flex items-center gap-1">
                <CalendarDays size={14} className="text-red-700" /> Online Bookings
              </span>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                {periodSummary.total > 0 ? Math.round((periodSummary.online / periodSummary.total) * 100) : 0}%
              </span>
            </div>
            <p className="text-2xl font-extrabold text-red-950 mt-1">
              ₱{periodSummary.online.toLocaleString()}
            </p>
            <p className="text-[11px] text-red-800/80 mt-1">
              {periodSummary.onlineCount} online reservations confirmed
            </p>
          </div>
        </div>

        {/* Dual Series Revenue Chart */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              {timeframe.toUpperCase()} Revenue Comparison Chart
            </p>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#c9a84c]" />
                <span className="text-gray-600">Walk-In Sales</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#3d0a14]" />
                <span className="text-gray-600">Online Bookings</span>
              </div>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis
                  dataKey="label"
                  stroke="#9ca3af"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#f0f0f0" }}
                />
                <YAxis
                  stroke="#9ca3af"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#f0f0f0" }}
                  tickFormatter={(val) => `₱${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <Tooltip
                  formatter={(val: any, name?: any) => [
                    `₱${Number(val).toLocaleString()}`,
                    name === "walkIn" ? "Walk-In Revenue" : "Online Bookings",
                  ]}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="online" fill="#3d0a14" radius={[6, 6, 0, 0]} name="online" maxBarSize={36} />
                <Bar dataKey="walkIn" fill="#c9a84c" radius={[6, 6, 0, 0]} name="walkIn" maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row: Peak Hours & Popular Services */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Peak Hours (2 cols) */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-gray-800">Peak Booking & Activity Hours</h2>
              <p className="text-xs text-gray-400">Activity volume by hour</p>
            </div>
            <Clock size={16} className="text-gray-300" />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={peakHoursData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="hour" stroke="#9ca3af" fontSize={10} tickLine={false} />
              <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
                formatter={(val: any) => [`${val} orders/bookings`, "Volume"]}
              />
              <Bar dataKey="bookings" fill="#991b1b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Popular Services */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-gray-800">Popular Services</h2>
              <p className="text-xs text-gray-400">Share of total reservations</p>
            </div>
            <Layers size={16} className="text-gray-300" />
          </div>
          <div className="h-[200px] flex items-center justify-center">
            {popularServicesData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={popularServicesData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {popularServicesData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-gray-400">No service data available</p>
            )}
          </div>
          <div className="space-y-1.5 mt-2">
            {popularServicesData.map((item, i) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className="text-gray-600 truncate max-w-[140px]">{item.name}</span>
                </div>
                <span className="font-semibold text-gray-800">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Transactions & Reservations Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-800">Recent Orders & Reservations</h2>
            <p className="text-xs text-gray-400">Latest online bookings and walk-in sales</p>
          </div>
          <span className="text-xs text-gray-400 font-medium">{recentReservations.length} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Code", "Type", "Customer", "Service", "Date & Time", "Amount", "Status"].map((h) => (
                  <th
                    key={h}
                    className="text-left py-3 px-4 text-gray-400 font-semibold uppercase tracking-wide text-[10px] whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentReservations.map((r) => {
                const walkInOrder = isWalkIn(r);
                return (
                  <tr key={r.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-gray-700 whitespace-nowrap">
                      {r.reservation_code}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {walkInOrder ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#c9a84c]/20 text-[#3d0a14] border border-[#c9a84c]/40 flex items-center gap-1 w-max">
                          <Banknote size={10} /> Walk-In
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1 w-max">
                          <CalendarDays size={10} /> Online
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-semibold text-gray-800 whitespace-nowrap">
                      {r.customer_name || "Guest"}
                    </td>

                    <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                      {r.services?.name || (walkInOrder ? "Food & Drinks" : "Dining")}
                    </td>

                    <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                      {r.date} • {r.time_start?.slice(0, 5) || "—"}
                    </td>

                    <td className="py-3 px-4 font-bold text-gray-900 whitespace-nowrap">
                      ₱{Number(r.total_amount || 0).toLocaleString()}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">{statusBadge(r.status)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Walk-In Sale Modal */}
      {showWalkInModal && (
        <RecordWalkInModal
          onClose={() => setShowWalkInModal(false)}
          onSuccess={() => {
            loadStats();
          }}
        />
      )}
    </div>
  );
}
