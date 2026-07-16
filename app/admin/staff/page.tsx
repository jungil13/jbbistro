"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  UserCog,
  Search,
  Download,
  Plus,
  CheckCircle,
  XCircle,
  Mail,
  Phone,
} from "lucide-react";
import Link from "next/link";
import Pagination from "@/components/admin/Pagination";

interface Staff {
  id: string;
  first_name?: string;
  last_name?: string;
  email: string;
  phone?: string;
  role: string;
  status: string;
  photo_url?: string;
  created_at: string;
}

export default function AdminStaff() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [filtered, setFiltered] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const supabase = createClient();

  useEffect(() => {
    const fetchStaff = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .in("role", ["admin", "manager", "staff"])
        .order("created_at", { ascending: false });
      if (data) {
        setStaff(data);
        setFiltered(data);
      }
      setLoading(false);
    };
    fetchStaff();
  }, []);

  useEffect(() => {
    if (!search) { setFiltered(staff); return; }
    const q = search.toLowerCase();
    setFiltered(
      staff.filter(
        (s) =>
          `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
          s.email?.toLowerCase().includes(q) ||
          s.role.toLowerCase().includes(q)
      )
    );
    setCurrentPage(1);
  }, [search, staff]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedData = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const exportCSV = () => {
    const headers = ["Name", "Email", "Phone", "Role", "Status", "Joined"];
    const rows = filtered.map((s) => [
      `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim(),
      s.email,
      s.phone ?? "",
      s.role,
      s.status,
      new Date(s.created_at).toLocaleDateString(),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "jbenz-staff.csv";
    a.click();
  };

  const roleColor: Record<string, string> = {
    admin: "bg-red-100 text-red-700",
    manager: "bg-purple-100 text-purple-700",
    staff: "bg-blue-100 text-blue-700",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Staff Members</h1>
          <p className="text-sm text-gray-400">Manage your team members</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 border border-gray-200 text-gray-600 px-3 py-2 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            <Download size={14} />
            Export
          </button>
          <Link
            href="/admin/staff/add"
            className="flex items-center gap-2 bg-red-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-red-800 transition-colors no-underline"
          >
            <Plus size={14} />
            Add Staff
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search staff…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-red-300"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1,2,3].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <UserCog size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No staff found</p>
            <Link href="/admin/staff/add" className="inline-flex items-center gap-1.5 mt-3 text-sm text-red-700 font-semibold hover:underline no-underline">
              <Plus size={14} /> Add your first staff member
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["Staff Member", "Email", "Phone", "Role", "Status", "Joined"].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-gray-400 font-semibold uppercase tracking-wide text-[10px] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedData.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        {s.photo_url ? (
                          <img src={s.photo_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-red-100 text-red-800 flex items-center justify-center font-bold text-xs flex-shrink-0">
                            {(s.first_name?.[0] ?? s.email[0]).toUpperCase()}
                          </div>
                        )}
                        <span className="font-semibold text-gray-700">
                          {`${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || s.email}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <Mail size={11} className="text-gray-300" />
                        {s.email}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <Phone size={11} className="text-gray-300" />
                        {s.phone ?? "—"}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${roleColor[s.role] ?? "bg-gray-100 text-gray-500"}`}>
                        {s.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className={`flex items-center gap-1 text-[10px] font-bold ${s.status === "active" ? "text-green-600" : "text-red-400"}`}>
                        {s.status === "active" ? <CheckCircle size={11} /> : <XCircle size={11} />}
                        {s.status}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-400">
                      {new Date(s.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {filtered.length > 0 && !loading && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        )}
      </div>
    </div>
  );
}
