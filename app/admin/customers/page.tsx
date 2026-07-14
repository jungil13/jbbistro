"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Users, Search, Crown, Star, Medal, Mail, Phone, ShoppingBag } from "lucide-react";

interface Customer {
  id: string;
  email: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  customers?: {
    tier: string;
    total_spend: number;
    total_bookings: number;
    services_used: string[];
  };
}

const tierBadge = (tier: string) => {
  const map: Record<string, { color: string; icon: React.ReactNode }> = {
    vip: { color: "bg-yellow-100 text-yellow-700 border border-yellow-200", icon: <Crown size={10} /> },
    member: { color: "bg-blue-100 text-blue-700 border border-blue-200", icon: <Star size={10} /> },
    regular: { color: "bg-gray-100 text-gray-600 border border-gray-200", icon: <Medal size={10} /> },
  };
  const t = map[tier] ?? map.regular;
  return (
    <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${t.color}`}>
      {t.icon}{tier}
    </span>
  );
};

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filtered, setFiltered] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const supabase = createClient();

  useEffect(() => {
    const fetchCustomers = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*, customers(*)")
        .eq("role", "customer")
        .order("created_at", { ascending: false });
      if (data) {
        const mapped = data.map((c: any) => ({
          ...c,
          customers: Array.isArray(c.customers) ? c.customers[0] : c.customers
        }));
        setCustomers(mapped);
        setFiltered(mapped);
      }
      setLoading(false);
    };
    fetchCustomers();
  }, []);

  useEffect(() => {
    let result = customers;
    if (tierFilter !== "all") {
      result = result.filter((c) => c.customers?.tier === tierFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.phone?.includes(q)
      );
    }
    setFiltered(result);
  }, [customers, search, tierFilter]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Customers</h1>
        <p className="text-sm text-gray-400">View and manage all registered customers</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total", value: customers.length, color: "bg-gray-800", icon: <Users size={15}/> },
          { label: "VIP", value: customers.filter(c => c.customers?.tier === "vip").length, color: "bg-yellow-600", icon: <Crown size={15}/> },
          { label: "Members", value: customers.filter(c => c.customers?.tier === "member").length, color: "bg-blue-700", icon: <Star size={15}/> },
        ].map((s) => (
          <div key={s.label} className={`${s.color} text-white rounded-2xl p-4 flex items-center gap-3`}>
            <div className="bg-white/15 rounded-xl p-2">{s.icon}</div>
            <div>
              <p className="text-xl font-bold leading-none">{s.value}</p>
              <p className="text-xs text-white/70 mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100"
          />
        </div>
        <div className="flex items-center gap-2">
          {["all", "vip", "member", "regular"].map((t) => (
            <button
              key={t}
              onClick={() => setTierFilter(t)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold capitalize transition-colors ${
                tierFilter === t ? "bg-red-900 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1,2,3,4].map((i) => <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Users size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No customers found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["Customer", "Email", "Phone", "Total Spend", "Bookings", "Services Used", "Tier"].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-gray-400 font-semibold uppercase tracking-wide text-[10px] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-red-100 text-red-800 flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {(c.first_name?.[0] ?? c.email?.[0] ?? "?").toUpperCase()}
                        </div>
                        <span className="font-semibold text-gray-700">
                          {c.first_name || c.last_name
                            ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()
                            : "—"}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <Mail size={11} className="text-gray-300" />
                        {c.email}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <Phone size={11} className="text-gray-300" />
                        {c.phone ?? "—"}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-gray-700">
                      ₱{(c.customers?.total_spend ?? 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center text-gray-500">{c.customers?.total_bookings ?? 0}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {(c.customers?.services_used ?? []).length === 0 ? (
                          <span className="text-gray-400">—</span>
                        ) : (
                          (c.customers?.services_used ?? []).map((s: string) => (
                            <span key={s} className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full text-[10px] capitalize">{s}</span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">{tierBadge(c.customers?.tier ?? "regular")}</td>
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
