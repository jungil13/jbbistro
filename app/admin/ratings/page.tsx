"use client";

import { useEffect, useState } from "react";
import {
  Star,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  MessageSquareHeart,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { CustomerRating } from "@/lib/ratings";
import {
  getAllRatingsAdminAction,
  updateRatingStatusAction,
  deleteRatingAction,
} from "@/app/actions/ratings";
import { createClient } from "@/lib/supabase/client";
import toast, { Toaster } from "react-hot-toast";

export default function AdminRatingsPage() {
  const [ratings, setRatings] = useState<CustomerRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [ratingFilter, setRatingFilter] = useState<number | "all">("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const supabase = createClient();

  const loadRatings = async (showToast = false) => {
    setLoading(true);
    const res = await getAllRatingsAdminAction();
    if (res.success) {
      setRatings(res.data);
      if (showToast) toast.success("Reviews updated");
    } else {
      toast.error(res.error || "Failed to load reviews");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRatings();

    // Realtime listener for reviews table
    const channel = supabase
      .channel("admin-customer-ratings-channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "customer_ratings" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newItem = payload.new as CustomerRating;
            setRatings((prev) => [newItem, ...prev]);
            toast("New review received for moderation!", {
              icon: "⭐",
              duration: 4000,
            });
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as CustomerRating;
            setRatings((prev) =>
              prev.map((r) => (r.id === updated.id ? updated : r))
            );
          } else if (payload.eventType === "DELETE") {
            const oldId = (payload.old as any)?.id;
            if (oldId) {
              setRatings((prev) => prev.filter((r) => r.id !== oldId));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleUpdateStatus = async (
    id: string,
    newStatus: "approved" | "rejected" | "pending"
  ) => {
    setActionLoading(id);
    const res = await updateRatingStatusAction(id, newStatus);
    setActionLoading(null);

    if (res.success) {
      setRatings((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
      );
      if (newStatus === "approved") {
        toast.success("Review approved! It is now live on the website. ⭐", {
          icon: "✅",
        });
      } else if (newStatus === "rejected") {
        toast.error("Review marked as rejected.", {
          icon: "🚫",
        });
      } else {
        toast("Review moved back to pending.");
      }
    } else {
      toast.error(res.error || "Failed to update review status");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete the review from "${name}"?`)) {
      return;
    }

    setActionLoading(id);
    const res = await deleteRatingAction(id);
    setActionLoading(null);

    if (res.success) {
      setRatings((prev) => prev.filter((r) => r.id !== id));
      toast.success("Review deleted successfully.");
    } else {
      toast.error(res.error || "Failed to delete review");
    }
  };

  // Metrics
  const totalCount = ratings.length;
  const pendingCount = ratings.filter((r) => r.status === "pending").length;
  const approvedCount = ratings.filter((r) => r.status === "approved").length;
  const rejectedCount = ratings.filter((r) => r.status === "rejected").length;

  const approvedRatings = ratings.filter((r) => r.status === "approved");
  const avgRating =
    approvedRatings.length > 0
      ? (
          approvedRatings.reduce((acc, r) => acc + r.rating, 0) /
          approvedRatings.length
        ).toFixed(1)
      : "5.0";

  // Filtered List
  const filtered = ratings.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (ratingFilter !== "all" && r.rating !== ratingFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = r.name?.toLowerCase().includes(q);
      const matchComment = r.comment?.toLowerCase().includes(q);
      const matchService = r.service_type?.toLowerCase().includes(q);
      if (!matchName && !matchComment && !matchService) return false;
    }
    return true;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <Toaster position="top-right" />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center">
              <Star size={18} className="fill-amber-500 text-amber-500" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#3d0a14] font-playfair tracking-tight">
              Customer Reviews Moderation
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Admin, Manager & Staff review portal. Reviews require approval before displaying live to guests.
          </p>
        </div>

        <button
          onClick={() => loadRatings(true)}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors shadow-2xs self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Pending Card */}
        <div
          onClick={() => setStatusFilter("pending")}
          className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === "pending"
              ? "bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/30 shadow-sm"
              : "bg-white border-gray-200/80 hover:border-amber-200 shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-xs font-bold uppercase tracking-wider">Awaiting Approval</span>
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-amber-900 font-playfair">
              {pendingCount}
            </span>
            <span className="text-[11px] text-amber-700/80 font-medium">pending reviews</span>
          </div>
        </div>

        {/* Live Approved Card */}
        <div
          onClick={() => setStatusFilter("approved")}
          className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === "approved"
              ? "bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-400/30 shadow-sm"
              : "bg-white border-gray-200/80 hover:border-emerald-200 shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-xs font-bold uppercase tracking-wider">Live & Approved</span>
            <CheckCircle2 size={16} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-900 font-playfair">
              {approvedCount}
            </span>
            <span className="text-[11px] text-emerald-700/80 font-medium">shown on website</span>
          </div>
        </div>

        {/* Average Rating Card */}
        <div className="p-4 sm:p-5 rounded-2xl border border-gray-200/80 bg-white shadow-2xs">
          <div className="flex items-center justify-between text-amber-600">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Live Avg Rating
            </span>
            <Star size={16} className="fill-amber-400 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-gray-900 font-playfair">
              {avgRating}
            </span>
            <span className="text-[11px] text-gray-500 font-medium">/ 5.0 rating</span>
          </div>
        </div>

        {/* Total Reviews Card */}
        <div
          onClick={() => setStatusFilter("all")}
          className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === "all"
              ? "bg-red-50/80 border-red-300 ring-2 ring-red-400/30 shadow-sm"
              : "bg-white border-gray-200/80 hover:border-red-200 shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-bold uppercase tracking-wider">Total Submissions</span>
            <MessageSquareHeart size={16} className="text-red-800" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-gray-900 font-playfair">
              {totalCount}
            </span>
            <span className="text-[11px] text-gray-500 font-medium">all-time records</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200/80 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-gray-100/80 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setStatusFilter("pending")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === "pending"
                  ? "bg-white text-amber-900 shadow-xs font-bold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Clock size={13} className="text-amber-500" />
              <span>Pending</span>
              {pendingCount > 0 && (
                <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setStatusFilter("approved")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === "approved"
                  ? "bg-white text-emerald-900 shadow-xs font-bold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <CheckCircle2 size={13} className="text-emerald-500" />
              <span>Approved</span>
              <span className="bg-gray-200 text-gray-700 text-[10px] px-1.5 py-0.2 rounded-full">
                {approvedCount}
              </span>
            </button>

            <button
              onClick={() => setStatusFilter("rejected")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === "rejected"
                  ? "bg-white text-red-900 shadow-xs font-bold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <XCircle size={13} className="text-red-500" />
              <span>Rejected</span>
              {rejectedCount > 0 && (
                <span className="bg-gray-200 text-gray-700 text-[10px] px-1.5 py-0.2 rounded-full">
                  {rejectedCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === "all"
                  ? "bg-white text-gray-900 shadow-xs font-bold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              All ({totalCount})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 lg:max-w-xs">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search by diner, review, or service..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl text-xs border border-gray-200 focus:border-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/20 outline-none"
            />
          </div>
        </div>

        {/* Rating Stars Filter */}
        <div className="flex items-center gap-2 pt-2 border-t border-gray-100 text-xs text-gray-500 overflow-x-auto">
          <span className="font-semibold text-gray-700 whitespace-nowrap">Filter Stars:</span>
          {(["all", 5, 4, 3, 2, 1] as const).map((star) => (
            <button
              key={star}
              onClick={() => setRatingFilter(star)}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                ratingFilter === star
                  ? "bg-[#3d0a14] text-white font-bold"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {star === "all" ? "All Stars" : `${star} ★`}
            </button>
          ))}
        </div>
      </div>

      {/* Review List */}
      {loading ? (
        <div className="p-12 text-center text-gray-400 bg-white rounded-2xl border border-gray-200/80">
          <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-[#c9a84c]" />
          <p className="text-xs font-medium">Loading customer reviews…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-gray-200/80 space-y-2">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-500 mx-auto flex items-center justify-center">
            <CheckCircle2 size={24} />
          </div>
          <h3 className="text-base font-bold text-gray-900">No reviews found</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            {statusFilter === "pending"
              ? "All caught up! There are currently no pending reviews waiting for moderation."
              : "No reviews match your selected filter criteria."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((item) => {
            const isPending = item.status === "pending";
            const isApproved = item.status === "approved";
            const isRejected = item.status === "rejected";

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl p-5 border shadow-2xs transition-all flex flex-col justify-between ${
                  isPending
                    ? "border-amber-300 ring-1 ring-amber-300/40 bg-gradient-to-b from-amber-50/20 to-white"
                    : isApproved
                    ? "border-emerald-200/80 hover:border-emerald-400"
                    : "border-gray-200/80 opacity-75"
                }`}
              >
                <div>
                  {/* Top Bar: Stars, Tag & Status Badge */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          size={15}
                          className={
                            i < item.rating
                              ? "fill-amber-400 text-amber-400"
                              : "text-gray-200 fill-gray-100"
                          }
                        />
                      ))}
                      <span className="ml-1 text-xs font-bold text-gray-700">
                        {item.rating}.0
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Status Tag */}
                      {isPending && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          <Clock size={11} />
                          <span>Pending Approval</span>
                        </span>
                      )}
                      {isApproved && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 size={11} />
                          <span>Live On Site</span>
                        </span>
                      )}
                      {isRejected && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-300">
                          <XCircle size={11} />
                          <span>Rejected</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Service Category */}
                  <div className="mb-2.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B6E28] bg-[#fbf5e6] px-2.5 py-0.5 rounded-full border border-[#c9a84c]/20">
                      {item.service_type}
                    </span>
                  </div>

                  {/* Comment Text */}
                  <p className="text-xs sm:text-sm text-gray-800 leading-relaxed font-serif italic mb-4 bg-gray-50/70 p-3.5 rounded-xl border border-gray-100">
                    "{item.comment}"
                  </p>
                </div>

                {/* Footer: User Details & Moderation Actions */}
                <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3d0a14] to-[#800A1D] text-white flex items-center justify-center font-bold text-xs">
                      {item.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 leading-tight">
                        {item.name}
                      </h4>
                      <p className="text-[10px] text-gray-400">
                        {new Date(item.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    {/* Approve Button */}
                    {!isApproved && (
                      <button
                        onClick={() => handleUpdateStatus(item.id, "approved")}
                        disabled={actionLoading === item.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all shadow-2xs cursor-pointer disabled:opacity-60"
                        title="Approve review to show live on website"
                      >
                        <CheckCircle2 size={13} />
                        <span>Approve</span>
                      </button>
                    )}

                    {/* Reject Button */}
                    {!isRejected && (
                      <button
                        onClick={() => handleUpdateStatus(item.id, "rejected")}
                        disabled={actionLoading === item.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 active:scale-95 transition-all cursor-pointer disabled:opacity-60"
                        title="Reject review"
                      >
                        <XCircle size={13} />
                        <span>Reject</span>
                      </button>
                    )}

                    {/* Move back to pending if already approved or rejected */}
                    {(isApproved || isRejected) && (
                      <button
                        onClick={() => handleUpdateStatus(item.id, "pending")}
                        disabled={actionLoading === item.id}
                        className="p-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer"
                        title="Reset to Pending"
                      >
                        <Clock size={14} />
                      </button>
                    )}

                    {/* Delete button */}
                    <button
                      onClick={() => handleDelete(item.id, item.name)}
                      disabled={actionLoading === item.id}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-60"
                      title="Permanently Delete Review"
                    >
                      {actionLoading === item.id ? (
                        <div className="w-3.5 h-3.5 border-2 border-red-600/30 border-t-red-600 rounded-full animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
