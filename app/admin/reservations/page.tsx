"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  CalendarDays,
  Clock,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Printer,
  Trash2,
  Banknote,
  Plus,
} from "lucide-react";
import ReservationDetailsModal from "@/components/ReservationDetailsModal";
import RecordWalkInModal from "@/components/admin/RecordWalkInModal";
import { format } from "date-fns";
import { formatDate, formatTime } from "@/lib/dateUtils";
import toast, { Toaster } from "react-hot-toast";
import { deleteReservationAction } from "@/app/actions/reservation";
import Pagination from "@/components/admin/Pagination";

interface Reservation {
  id: string;
  reservation_code: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  date: string;
  time_start: string;
  guests: number;
  status: "pending" | "confirmed" | "cancelled";
  total_amount: number;
  notes?: string;
  services?: { name: string; type: string; description?: string };
  created_at: string;
}

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700 border border-yellow-200",
    confirmed: "bg-green-100 text-green-700 border border-green-200",
    cancelled: "bg-red-100 text-red-600 border border-red-200",
  };
  return (
    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full capitalize ${map[status] ?? "bg-gray-100 text-gray-500"}`}>
      {status}
    </span>
  );
};

export default function AdminReservations() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [filtered, setFiltered] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "online" | "walkin">("all");
  const [search, setSearch] = useState("");
  const [viewModalRes, setViewModalRes] = useState<Reservation | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const supabase = createClient();

  const isWalkIn = (r: Reservation) => {
    return (
      (r.notes && r.notes.toLowerCase().includes("walk-in")) ||
      (r.reservation_code && r.reservation_code.startsWith("WALK-")) ||
      r.customer_email === "walkin@jbenzbistro.local"
    );
  };

  const fetchReservations = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("reservations")
      .select("*, services(name, type, description), payments(method, reference_number, receipt_url, status), reservation_menu(quantity, menu_items(name, price))")
      .order("created_at", { ascending: false });
    if (!error && data) {
      setReservations(data);
      setFiltered(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReservations();

    // Realtime subscription
    const channel = supabase
      .channel("reservations-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, (payload) => {
        if (payload.eventType === "INSERT") {
          toast.success("New reservation received!", { icon: "🔔" });
        }
        fetchReservations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    let result = reservations;
    if (statusFilter !== "all") result = result.filter((r) => r.status === statusFilter);
    if (typeFilter === "walkin") result = result.filter((r) => isWalkIn(r));
    if (typeFilter === "online") result = result.filter((r) => !isWalkIn(r));

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.customer_name?.toLowerCase().includes(q) ||
          r.customer_email?.toLowerCase().includes(q) ||
          r.reservation_code?.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
    setCurrentPage(1);
  }, [reservations, statusFilter, typeFilter, search]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedData = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("reservations").update({ status }).eq("id", id);
    if (!error) {
      toast.success(`Reservation ${status}!`);
      fetchReservations();
    } else {
      toast.error("Failed to update status");
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    
    const result = await deleteReservationAction(id);
    if (result.success) {
      toast.success("Reservation deleted!");
      fetchReservations();
    } else {
      toast.error("Failed to delete reservation: " + (result.error || "Unknown error"));
    }
  };

  const stats = {
    total: reservations.length,
    walkIn: reservations.filter((r) => isWalkIn(r)).length,
    online: reservations.filter((r) => !isWalkIn(r)).length,
    pending: reservations.filter((r) => r.status === "pending").length,
    confirmed: reservations.filter((r) => r.status === "confirmed").length,
    cancelled: reservations.filter((r) => r.status === "cancelled").length,
  };

  return (
    <div className="space-y-5">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Reservations & Walk-In Orders</h1>
          <p className="text-sm text-gray-400">Manage online table bookings and in-person walk-in customer sales</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowWalkInModal(true)}
            className="flex items-center gap-2 bg-[#3d0a14] hover:bg-[#5c1020] text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md shadow-[#3d0a14]/20"
          >
            <Banknote size={15} className="text-[#c9a84c]" />
            + Record Walk-In Sale
          </button>
          <button
            onClick={fetchReservations}
            className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Bookings", value: stats.total, color: "bg-gray-800", icon: <CalendarDays size={16} /> },
          { label: "Walk-In Orders", value: stats.walkIn, color: "bg-amber-800", icon: <Banknote size={16} /> },
          { label: "Confirmed", value: stats.confirmed, color: "bg-green-700", icon: <CheckCircle size={16} /> },
          { label: "Pending Online", value: stats.pending, color: "bg-yellow-600", icon: <Clock size={16} /> },
        ].map((s) => (
          <div key={s.label} className={`${s.color} text-white rounded-2xl p-4 flex items-center gap-3 shadow-sm`}>
            <div className="bg-white/15 rounded-xl p-2">{s.icon}</div>
            <div>
              <p className="text-2xl font-bold leading-none">{s.value}</p>
              <p className="text-xs text-white/70 mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by code, customer name, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100"
          />
        </div>

        {/* Source Type Filter */}
        <div className="flex items-center p-1 bg-gray-100 rounded-xl w-full sm:w-auto overflow-x-auto">
          {[
            { id: "all", label: "All Types" },
            { id: "online", label: "Online Only" },
            { id: "walkin", label: "Walk-In Only" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTypeFilter(t.id as any)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                typeFilter === t.id ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="flex gap-1 overflow-x-auto w-full sm:w-auto">
          {["all", "pending", "confirmed", "cancelled"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold capitalize transition-colors ${
                statusFilter === s
                  ? "bg-red-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <CalendarDays size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No reservations found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["Type", "Code", "Customer", "Service", "Date / Time", "Amount", "Status", "Actions"].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-gray-400 font-semibold uppercase tracking-wide text-[10px] whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedData.map((r) => {
                  const walkInOrder = isWalkIn(r);
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      {/* Type Badge */}
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

                      <td className="py-3 px-4 font-mono font-bold text-gray-700 whitespace-nowrap">
                        {r.reservation_code ?? r.id.slice(0, 8).toUpperCase()}
                      </td>

                      <td className="py-3 px-4">
                        <p className="font-semibold text-gray-800 flex items-center gap-1.5">
                          {r.customer_name ?? "—"}
                          {r.notes?.includes("Membership:") && (
                            <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">
                              {r.notes.split("Membership: ")[1]?.split("\n")[0] || "VIP"}
                            </span>
                          )}
                        </p>
                        <p className="text-gray-400 text-[10px]">{r.customer_email ?? ""}</p>
                      </td>

                      <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                        {r.services?.name ?? (walkInOrder ? "Food & Drinks" : "Dining")}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <p className="text-gray-700 font-semibold">{formatDate(r.date)}</p>
                        <p className="text-gray-400 text-[10px]">{formatTime(r.time_start)}</p>
                      </td>

                      <td className="py-3 px-4 text-gray-900 font-bold whitespace-nowrap">
                        ₱{Number(r.total_amount || 0).toLocaleString()}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">{statusBadge(r.status)}</td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => setViewModalRes(r)}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-semibold"
                            title="View Details"
                          >
                            <Eye size={11} /> View
                          </button>

                          {r.status === "pending" && (
                            <>
                              <button
                                onClick={() => updateStatus(r.id, "confirmed")}
                                className="bg-green-100 hover:bg-green-200 text-green-700 px-2 py-1 rounded-lg transition-colors font-semibold text-[10px]"
                                title="Confirm"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => updateStatus(r.id, "cancelled")}
                                className="bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded-lg transition-colors font-semibold text-[10px]"
                                title="Reject"
                              >
                                Decline
                              </button>
                            </>
                          )}

                          <button
                            onClick={() => setDeleteConfirmId(r.id)}
                            className="bg-red-50 hover:bg-red-100 text-red-600 p-1.5 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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

      {viewModalRes && (
        <ReservationDetailsModal
          reservation={viewModalRes}
          onClose={() => setViewModalRes(null)}
        />
      )}

      {/* Record Walk-In Modal */}
      {showWalkInModal && (
        <RecordWalkInModal
          onClose={() => setShowWalkInModal(false)}
          onSuccess={() => {
            fetchReservations();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setDeleteConfirmId(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm p-6 text-center shadow-xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <Trash2 size={24} strokeWidth={2} />
            </div>
            <h3 className="text-base font-bold text-gray-800 mb-1">Delete Record?</h3>
            <p className="text-xs text-gray-500 mb-5 leading-relaxed">
              This reservation and its payment records will be permanently removed.
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl font-semibold text-xs hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-xl font-semibold text-xs hover:bg-red-700 transition-colors shadow-md shadow-red-600/20"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
