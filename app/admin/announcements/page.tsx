"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Megaphone,
  Sparkles,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Search,
  Upload,
  Link as LinkIcon,
  X,
  Loader2,
  Calendar,
  ExternalLink,
  Eye,
  CheckCircle2,
  AlertCircle,
  Clock,
  Tag,
  BellRing,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import {
  getAnnouncements,
  addAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  toggleAnnouncementActive,
  toggleAnnouncementBanner,
  AnnouncementItem,
} from "@/app/actions/announcements";
import {
  getAllPromotionClaimsAction,
  updatePromotionClaimStatusAction,
  PromotionClaimRecord,
} from "@/app/actions/promotions";

export default function AdminAnnouncementsPage() {
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "announcement" | "promotion">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Tab state: Announcements & Promos vs Claimed Promotions
  const [mainTab, setMainTab] = useState<"announcements" | "claims">("announcements");
  const [claims, setClaims] = useState<PromotionClaimRecord[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [claimsFilter, setClaimsFilter] = useState<"all" | "pending" | "approved" | "used" | "rejected">("all");
  const [claimActionLoadingId, setClaimActionLoadingId] = useState<string | null>(null);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<AnnouncementItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingAnnouncement, setDeletingAnnouncement] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  // Form State
  const [formData, setFormData] = useState<{
    type: "announcement" | "promotion";
    title: string;
    badge: string;
    description: string;
    image_url: string;
    validity: string;
    valid_until: string;
    duration_days: number;
    link_url: string;
    link_text: string;
    is_active: boolean;
    show_banner: boolean;
    sort_order: number;
  }>({
    type: "announcement",
    title: "",
    badge: "",
    description: "",
    image_url: "",
    validity: "7 Days",
    valid_until: "",
    duration_days: 7,
    link_url: "/reserve",
    link_text: "Learn More",
    is_active: true,
    show_banner: false,
    sort_order: 0,
  });

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await getAnnouncements();
      if (res.success && res.data) {
        setItems(res.data);
      }
    } catch (err) {
      console.error("Error loading announcements:", err);
      toast.error("Failed to load announcements");
    } finally {
      setLoading(false);
    }
  };

  const fetchClaims = async () => {
    setClaimsLoading(true);
    try {
      const data = await getAllPromotionClaimsAction();
      setClaims(data);
    } catch (e) {
      console.error("Error fetching claims:", e);
      toast.error("Failed to load promotion claims");
    } finally {
      setClaimsLoading(false);
    }
  };

  const handleUpdateClaimStatus = async (claimId: string, status: "approved" | "rejected" | "used") => {
    setClaimActionLoadingId(claimId);
    // Optimistic update for instant UI feedback
    setClaims((prev) =>
      prev.map((c) => (c.id === claimId ? { ...c, status } : c))
    );
    try {
      const res = await updatePromotionClaimStatusAction({
        claim_id: claimId,
        status,
      });
      if (res.success) {
        toast.success(`Claim ${status === "approved" ? "approved" : status === "rejected" ? "rejected" : "updated"}!`);
        await fetchClaims();
      } else {
        toast.error(res.error || "Failed to update claim");
        await fetchClaims();
      }
    } catch (e: any) {
      toast.error(e.message || "An error occurred");
      await fetchClaims();
    } finally {
      setClaimActionLoadingId(null);
    }
  };

  useEffect(() => {
    fetchItems();
    fetchClaims();

    // Supabase Realtime channel
    const channel = supabase
      .channel("announcements-admin-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => {
        fetchItems();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "promotion_claims" }, () => {
        fetchClaims();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, () => {
        fetchItems();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Filtered Items
  const filtered = items.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      (item.badge && item.badge.toLowerCase().includes(search.toLowerCase())) ||
      (item.description && item.description.toLowerCase().includes(search.toLowerCase()));

    const matchesType = typeFilter === "all" || item.type === typeFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && item.is_active) ||
      (statusFilter === "inactive" && !item.is_active);

    return matchesSearch && matchesType && matchesStatus;
  });

  const handleOpenModal = (item?: AnnouncementItem) => {
    if (item) {
      setEditingItem(item);
      const validUntil = (item as any).valid_until || "";
      let days = 7;
      if (validUntil) {
        const diff = Math.ceil((new Date(validUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        days = Math.max(1, diff);
      }
      setFormData({
        type: item.type,
        title: item.title,
        badge: item.badge || "",
        description: item.description || "",
        image_url: item.image_url || "",
        validity: item.validity || `${days} Days`,
        valid_until: validUntil,
        duration_days: days,
        link_url: item.link_url || "/reserve",
        link_text: item.link_text || (item.type === "promotion" ? "Claim This Promo Now" : "Learn More"),
        is_active: item.is_active,
        show_banner: item.show_banner,
        sort_order: item.sort_order || 0,
      });
    } else {
      setEditingItem(null);
      const d = new Date();
      d.setDate(d.getDate() + 7);
      const defaultDate = d.toISOString().split("T")[0];
      setFormData({
        type: "announcement",
        title: "",
        badge: "",
        description: "",
        image_url: "",
        validity: `7 Days (Until ${defaultDate})`,
        valid_until: defaultDate,
        duration_days: 7,
        link_url: "/reserve",
        link_text: "Learn More",
        is_active: true,
        show_banner: false,
        sort_order: items.length + 1,
      });
    }
    setShowModal(true);
  };

  // Image Upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file size must be less than 5MB");
      return;
    }

    setUploadingImage(true);
    const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `announcements/${Date.now()}_${cleanName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from("uploads")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        toast.error("Upload failed: " + uploadError.message);
      } else {
        const {
          data: { publicUrl },
        } = supabase.storage.from("uploads").getPublicUrl(filePath);
        setFormData((prev) => ({ ...prev, image_url: publicUrl }));
        toast.success("Picture uploaded successfully!");
      }
    } catch (err: any) {
      toast.error("Upload error: " + err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error("Title is required");
      return;
    }

    setSaving(true);
    try {
      if (editingItem) {
        const res = await updateAnnouncement(editingItem.id, formData);
        if (res.success) {
          toast.success("Updated successfully!");
          setShowModal(false);
          fetchItems();
        } else {
          toast.error(res.error || "Failed to update");
        }
      } else {
        const res = await addAnnouncement(formData);
        if (res.success) {
          toast.success("Created successfully!");
          setShowModal(false);
          fetchItems();
        } else {
          toast.error(res.error || "Failed to create");
        }
      }
    } catch (err: any) {
      toast.error("An error occurred: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    const res = await toggleAnnouncementActive(id, !current);
    if (res.success) {
      toast.success(!current ? "Activated" : "Deactivated");
      fetchItems();
    } else {
      toast.error("Failed to update status");
    }
  };

  const handleToggleBanner = async (id: string, current: boolean) => {
    const res = await toggleAnnouncementBanner(id, !current);
    if (res.success) {
      toast.success(!current ? "Set as toast banner" : "Removed from toast banner");
      fetchItems();
    } else {
      toast.error("Failed to update banner status");
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    setDeletingAnnouncement(true);
    const res = await deleteAnnouncement(deleteConfirmId);
    setDeletingAnnouncement(false);
    if (res.success) {
      toast.success("Deleted successfully!");
      setDeleteConfirmId(null);
      fetchItems();
    } else {
      toast.error("Failed to delete");
    }
  };

  // Quick stats
  const totalCount = items.length;
  const activeCount = items.filter((i) => i.is_active).length;
  const promoCount = items.filter((i) => i.type === "promotion" && i.is_active).length;
  const bannerItem = items.find((i) => i.show_banner && i.is_active);

  return (
    <div className="space-y-6 max-w-6xl pb-12">
      <Toaster position="top-right" />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight font-playfair">
            Announcements &amp; Promotions
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Manage site-wide promotions, announcement banners, customer promo claims, and validity schedules
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              fetchItems();
              fetchClaims();
            }}
            disabled={loading || claimsLoading}
            className="p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors shadow-sm"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading || claimsLoading ? "animate-spin" : ""} />
          </button>
          {mainTab === "announcements" && (
            <button
              onClick={() => handleOpenModal()}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-900 hover:bg-red-800 text-white rounded-xl font-medium text-sm transition-all shadow-md hover:shadow-lg"
            >
              <Plus size={16} />
              <span>Add Announcement / Promo</span>
            </button>
          )}
        </div>
      </div>

      {/* Primary Section Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setMainTab("announcements")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            mainTab === "announcements"
              ? "bg-[#3d0a14] text-white shadow-sm"
              : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
          }`}
        >
          <Megaphone size={14} /> Announcements &amp; Promos ({items.length})
        </button>
        <button
          onClick={() => {
            setMainTab("claims");
            fetchClaims();
          }}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            mainTab === "claims"
              ? "bg-[#3d0a14] text-white shadow-sm"
              : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
          }`}
        >
          <Tag size={14} /> Claimed Promotions ({claims.length})
          {claims.filter((c) => c.status === "pending").length > 0 && (
            <span className="bg-amber-400 text-red-950 px-2 py-0.5 rounded-full text-[10px] font-extrabold animate-pulse">
              {claims.filter((c) => c.status === "pending").length} pending
            </span>
          )}
        </button>
      </div>

      {mainTab === "claims" ? (
        <div className="space-y-6">
          {/* Claims Filter & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="inline-flex bg-gray-100 p-1 rounded-xl text-xs font-medium text-gray-600 flex-wrap">
              {(["all", "pending", "approved", "used", "rejected"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setClaimsFilter(st)}
                  className={`px-3 py-1.5 rounded-lg capitalize transition-all ${
                    claimsFilter === st
                      ? "bg-white text-gray-900 shadow-sm font-bold"
                      : "hover:text-gray-900"
                  }`}
                >
                  {st} ({claims.filter((c) => st === "all" || c.status === st).length})
                </button>
              ))}
            </div>

            <span className="text-xs text-gray-400">
              Total Claims: <strong>{claims.length}</strong>
            </span>
          </div>

          {/* Claims List Table / Cards */}
          {claimsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : claims.filter((c) => claimsFilter === "all" || c.status === claimsFilter).length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <Tag size={28} className="mx-auto text-gray-300 mb-2" />
              <h3 className="text-sm font-bold text-gray-700">No promotion claims found</h3>
              <p className="text-xs text-gray-400 mt-1">There are no customer promotion claims under this filter.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5">Customer</th>
                      <th className="px-5 py-3.5">Promotion</th>
                      <th className="px-5 py-3.5">Discount</th>
                      <th className="px-5 py-3.5">Claim Date</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5 text-right">Admin Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {claims
                      .filter((c) => claimsFilter === "all" || c.status === claimsFilter)
                      .map((claim) => (
                        <tr key={claim.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-4">
                            <p className="font-bold text-gray-900">{claim.customer_name}</p>
                            <p className="text-[11px] text-gray-500">{claim.customer_email}</p>
                            {claim.customer_phone && (
                              <p className="text-[10px] text-gray-400">{claim.customer_phone}</p>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <span className="font-semibold text-gray-800">{claim.promotion_title}</span>
                          </td>
                          <td className="px-5 py-4">
                            <span className="font-bold text-[#c9a84c]">{claim.discount_percent}% OFF</span>
                          </td>
                          <td className="px-5 py-4 text-gray-500">
                            {new Date(claim.claimed_at).toLocaleDateString()}
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`px-2.5 py-1 rounded-full font-bold text-[10px] uppercase tracking-wider ${
                                claim.status === "approved"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : claim.status === "pending"
                                  ? "bg-amber-100 text-amber-800"
                                  : claim.status === "used"
                                  ? "bg-gray-100 text-gray-700"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {claim.status}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            {claim.status === "pending" ? (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  disabled={claimActionLoadingId === claim.id}
                                  onClick={() => handleUpdateClaimStatus(claim.id, "approved")}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-sm transition-all disabled:opacity-50"
                                >
                                  {claimActionLoadingId === claim.id ? "..." : "Approve"}
                                </button>
                                <button
                                  type="button"
                                  disabled={claimActionLoadingId === claim.id}
                                  onClick={() => handleUpdateClaimStatus(claim.id, "rejected")}
                                  className="px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg font-bold text-xs transition-all disabled:opacity-50"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : claim.status === "approved" ? (
                              <div className="flex items-center justify-end gap-2">
                                <span className="text-[11px] text-emerald-600 font-semibold">Ready for checkout</span>
                                <button
                                  type="button"
                                  disabled={claimActionLoadingId === claim.id}
                                  onClick={() => handleUpdateClaimStatus(claim.id, "rejected")}
                                  className="text-[10px] text-gray-400 hover:text-red-500 underline"
                                >
                                  Revoke
                                </button>
                              </div>
                            ) : claim.status === "used" ? (
                              <span className="text-[11px] text-gray-400 font-medium">Applied to Billing</span>
                            ) : (
                              <button
                                type="button"
                                disabled={claimActionLoadingId === claim.id}
                                onClick={() => handleUpdateClaimStatus(claim.id, "approved")}
                                className="text-xs text-blue-600 hover:underline font-semibold"
                              >
                                Re-approve
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Stats Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-900 flex items-center justify-center font-bold">
            <Megaphone size={22} />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">Total Entries</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">{totalCount}</span>
              <span className="text-xs text-emerald-600 font-medium">({activeCount} Active)</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
            <Sparkles size={22} />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">Active Promotions</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">{promoCount}</span>
              <span className="text-xs text-gray-400">Featured</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
            <BellRing size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 font-medium">Live Toast Banner</p>
            <p className="text-xs font-semibold text-gray-800 truncate">
              {bannerItem ? bannerItem.title : "None active"}
            </p>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Search bar */}
          <div className="relative w-full md:w-80">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by title, badge, text..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-red-300"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Type selector */}
            <div className="inline-flex bg-gray-100 p-1 rounded-xl text-xs font-medium text-gray-600">
              <button
                onClick={() => setTypeFilter("all")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  typeFilter === "all" ? "bg-white text-gray-900 shadow-sm font-semibold" : "hover:text-gray-900"
                }`}
              >
                All Types
              </button>
              <button
                onClick={() => setTypeFilter("announcement")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  typeFilter === "announcement" ? "bg-white text-gray-900 shadow-sm font-semibold" : "hover:text-gray-900"
                }`}
              >
                Announcements
              </button>
              <button
                onClick={() => setTypeFilter("promotion")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  typeFilter === "promotion" ? "bg-white text-gray-900 shadow-sm font-semibold" : "hover:text-gray-900"
                }`}
              >
                Promotions
              </button>
            </div>

            {/* Status selector */}
            <div className="inline-flex bg-gray-100 p-1 rounded-xl text-xs font-medium text-gray-600">
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  statusFilter === "all" ? "bg-white text-gray-900 shadow-sm font-semibold" : "hover:text-gray-900"
                }`}
              >
                All Status
              </button>
              <button
                onClick={() => setStatusFilter("active")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  statusFilter === "active" ? "bg-white text-emerald-700 shadow-sm font-semibold" : "hover:text-gray-900"
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setStatusFilter("inactive")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  statusFilter === "inactive" ? "bg-white text-gray-500 shadow-sm font-semibold" : "hover:text-gray-900"
                }`}
              >
                Inactive
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-56 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3">
            <Megaphone size={24} />
          </div>
          <h3 className="text-base font-bold text-gray-700 mb-1">No announcements or promos found</h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto mb-4">
            Try adjusting your search criteria or create a new announcement or promotion.
          </p>
          <button
            onClick={() => handleOpenModal()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-900 text-white rounded-xl text-xs font-semibold hover:bg-red-800"
          >
            <Plus size={14} /> Add New Entry
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((item) => (
            <div
              key={item.id}
              className={`relative bg-white rounded-2xl border transition-all overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-md ${
                item.is_active ? "border-gray-200" : "border-gray-200/60 opacity-70 bg-gray-50/50"
              }`}
            >
              {/* Card top banner indicator */}
              {item.show_banner && item.is_active && (
                <div className="bg-gradient-to-r from-red-900 via-amber-600 to-red-900 text-white text-[10px] font-bold px-3 py-1 flex items-center gap-1.5 uppercase tracking-wider">
                  <BellRing size={11} /> Live Toast Banner
                </div>
              )}

              <div className="p-5">
                <div className="flex items-start gap-4">
                  {/* Thumbnail */}
                  <div
                    onClick={() => item.image_url && setPreviewImageUrl(item.image_url)}
                    className={`w-20 h-20 rounded-xl flex-shrink-0 overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center group relative ${
                      item.image_url ? "cursor-pointer" : ""
                    }`}
                  >
                    {item.image_url ? (
                      <>
                        <img
                          src={item.image_url}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                          <Eye size={14} />
                        </div>
                      </>
                    ) : (
                      <div className="text-gray-300 flex flex-col items-center">
                        {item.type === "promotion" ? <Sparkles size={20} /> : <Megaphone size={20} />}
                        <span className="text-[9px] mt-1 font-medium">No Image</span>
                      </div>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span
                        className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          item.type === "promotion"
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : "bg-red-100 text-red-800 border border-red-200"
                        }`}
                      >
                        {item.type}
                      </span>
                      {item.badge && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 flex items-center gap-1">
                          <Tag size={10} /> {item.badge}
                        </span>
                      )}
                      {item.validity && (
                        <span className="text-[11px] text-gray-500 flex items-center gap-1">
                          <Clock size={11} className="text-gray-400" /> {item.validity}
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-gray-900 text-base leading-snug line-clamp-1">
                      {item.title}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                      {item.description || "No description provided."}
                    </p>
                  </div>
                </div>

                {/* Additional details */}
                {item.link_url && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                    <span className="flex items-center gap-1 font-mono text-[11px] truncate max-w-[200px]">
                      <ExternalLink size={11} /> {item.link_url}
                    </span>
                    <span className="text-gray-600 font-medium">
                      Button: &quot;{item.link_text || "Claim Offer"}&quot;
                    </span>
                  </div>
                )}
              </div>

              {/* Action Bar Footer */}
              <div className="px-5 py-3 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between gap-2">
                {/* Status switches */}
                <div className="flex items-center gap-3">
                  {/* Active Toggle */}
                  <button
                    onClick={() => handleToggleActive(item.id, item.is_active)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      item.is_active
                        ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                        : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        item.is_active ? "bg-emerald-500" : "bg-gray-400"
                      }`}
                    />
                    {item.is_active ? "Active" : "Inactive"}
                  </button>

                  {/* Banner Toast Toggle */}
                  <button
                    onClick={() => handleToggleBanner(item.id, item.show_banner)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      item.show_banner
                        ? "bg-purple-100 text-purple-800 hover:bg-purple-200 font-semibold"
                        : "text-gray-400 hover:text-gray-700 hover:bg-gray-200/60"
                    }`}
                    title="Toggle whether this displays as the floating toast banner"
                  >
                    <BellRing size={12} />
                    {item.show_banner ? "Banner ON" : "Banner OFF"}
                  </button>
                </div>

                {/* Edit & Delete */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenModal(item)}
                    className="p-1.5 text-gray-500 hover:text-red-900 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-200"
                    title="Edit"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(item.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-200"
                    title="Delete"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
        </>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-50 text-red-900 flex items-center justify-center">
                  {formData.type === "promotion" ? <Sparkles size={18} /> : <Megaphone size={18} />}
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    {editingItem ? "Edit Announcement / Promo" : "New Announcement / Promo"}
                  </h2>
                  <p className="text-[11px] text-gray-400">Fill in details and upload an optional picture</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {/* Type Switcher */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Entry Type</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setFormData({
                      ...formData,
                      type: "announcement",
                      link_text: formData.link_text === "Claim This Promo Now" ? "Learn More" : formData.link_text,
                    })}
                    className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      formData.type === "announcement"
                        ? "bg-white text-red-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    <Megaphone size={14} /> Announcement
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({
                      ...formData,
                      type: "promotion",
                      link_text: formData.link_text === "Learn More" ? "Claim This Promo Now" : formData.link_text,
                    })}
                    className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      formData.type === "promotion"
                        ? "bg-white text-amber-700 shadow-sm"
                        : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    <Sparkles size={14} /> Promotion (Claimable)
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  {formData.type === "promotion"
                    ? "Customers can claim this and receive a discount voucher for their reservation."
                    : "Informational update shown on the public Announcements page."}
                </p>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    formData.type === "promotion"
                      ? "e.g. Weekend VIP Karaoke & Pulutan Fiesta"
                      : "e.g. Special Holiday Operating Hours"
                  }
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-red-300"
                />
              </div>

              {/* Badge & Validity */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Badge / Tag</label>
                  <input
                    type="text"
                    placeholder="e.g. Exclusive Promo, Notice"
                    value={formData.badge}
                    onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-red-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Duration (Days) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    placeholder="e.g. 7"
                    value={formData.duration_days || ""}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      const days = isNaN(val) ? 1 : Math.max(1, val);
                      const d = new Date();
                      d.setDate(d.getDate() + days);
                      const targetDate = d.toISOString().split("T")[0];
                      setFormData({
                        ...formData,
                        duration_days: days,
                        valid_until: targetDate,
                        validity: `${days} Day${days > 1 ? "s" : ""} (Until ${targetDate})`,
                      });
                    }}
                    className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-red-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Valid Until (Date) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split("T")[0]}
                    value={formData.valid_until || ""}
                    onChange={(e) => {
                      const targetDate = e.target.value;
                      if (!targetDate) return;
                      const now = new Date();
                      const selected = new Date(targetDate);
                      const diffMs = selected.getTime() - now.getTime();
                      const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
                      setFormData({
                        ...formData,
                        valid_until: targetDate,
                        duration_days: days,
                        validity: `${days} Day${days > 1 ? "s" : ""} (Until ${targetDate})`,
                      });
                    }}
                    className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-red-300"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Description / Details</label>
                <textarea
                  rows={3}
                  placeholder="Provide promotional details, discount terms, or announcement notes..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-red-300 resize-none"
                />
              </div>

              {/* Image Upload & URL */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Picture / Banner Image</label>
                
                {formData.image_url ? (
                  <div className="relative mb-2 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 h-36 flex items-center justify-center group">
                    <img
                      src={formData.image_url}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, image_url: "" })}
                      className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1.5 shadow-md hover:bg-red-700 transition-colors"
                      title="Remove image"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-200 hover:border-red-300 rounded-xl p-4 text-center cursor-pointer transition-colors bg-gray-50/50 hover:bg-gray-50"
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      {uploadingImage ? (
                        <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                          <Loader2 size={16} className="animate-spin text-red-900" />
                          <span>Uploading image...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-gray-500">
                          <Upload size={20} className="text-gray-400" />
                          <span className="text-xs font-semibold text-gray-700">Click to upload picture</span>
                          <span className="text-[10px] text-gray-400">PNG, JPG, WebP up to 5MB</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-400">Or paste image URL:</span>
                      <input
                        type="url"
                        placeholder="https://images.unsplash.com/..."
                        value={formData.image_url}
                        onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                        className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-red-300"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Link URL & Button Text */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Button Link</label>
                  <input
                    type="text"
                    placeholder="/reserve"
                    value={formData.link_url}
                    onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-red-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Button Text</label>
                  <input
                    type="text"
                    placeholder={formData.type === "promotion" ? "Claim This Promo Now" : "Learn More"}
                    value={formData.link_text}
                    onChange={(e) => setFormData({ ...formData, link_text: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-red-300"
                  />
                </div>
              </div>
              {formData.type === "promotion" && (
                <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  💡 <strong>Promotion:</strong> Customers will see a <em>"Claim This Promo Now"</em> button automatically. Once admin approves their claim, they can apply the discount on their reservation checkout.
                </p>
              )}

              {/* Toggles */}
              <div className="p-3 bg-gray-50 rounded-xl space-y-2.5 border border-gray-100">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 rounded text-red-900 focus:ring-red-900 border-gray-300"
                  />
                  <div>
                    <p className="text-xs font-bold text-gray-800">Publish Immediately (Active)</p>
                    <p className="text-[10px] text-gray-400">Controls visibility on customer-facing pages</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer border-t border-gray-200/60 pt-2">
                  <input
                    type="checkbox"
                    checked={formData.show_banner}
                    onChange={(e) => setFormData({ ...formData, show_banner: e.target.checked })}
                    className="w-4 h-4 rounded text-red-900 focus:ring-red-900 border-gray-300"
                  />
                  <div>
                    <p className="text-xs font-bold text-gray-800">Show as Top Toast Banner</p>
                    <p className="text-[10px] text-gray-400">Display as floating notification in the upper-right corner</p>
                  </div>
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || uploadingImage}
                  className="px-5 py-2.5 rounded-xl bg-red-900 hover:bg-red-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  <span>{editingItem ? "Save Changes" : "Create Entry"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
              <AlertCircle size={24} />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">Delete Entry?</h3>
            <p className="text-xs text-gray-500 mb-5">
              Are you sure you want to delete this announcement/promo? This action cannot be undone.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                disabled={deletingAnnouncement}
                onClick={handleDelete}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold disabled:opacity-60 flex items-center gap-1.5"
              >
                {deletingAnnouncement && (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {deletingAnnouncement ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Image Preview Modal */}
      {previewImageUrl && (
        <div
          onClick={() => setPreviewImageUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm cursor-pointer"
        >
          <div className="relative max-w-2xl w-full max-h-[85vh] flex items-center justify-center">
            <img
              src={previewImageUrl}
              alt="Full Preview"
              className="max-w-full max-h-[80vh] rounded-2xl object-contain shadow-2xl"
            />
            <button
              onClick={() => setPreviewImageUrl(null)}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
