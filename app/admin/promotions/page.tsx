"use client";

import { useState, useEffect, useRef } from "react";
import {
  Tag,
  Plus,
  Search,
  Filter,
  Sparkles,
  Clock,
  Calendar,
  Percent,
  DollarSign,
  Package,
  Cake,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Trash2,
  Eye,
  Loader2,
  X,
  TrendingUp,
  Flame,
  Info,
  Layers,
  ChevronDown,
  Upload,
  Check,
  History,
  ShieldCheck,
  Ban,
  ArrowRight
} from "lucide-react";
import {
  Promotion,
  PromotionType,
  PromotionStatus,
  BundleItem,
  getPromotionsAction,
  createPromotionAction,
  updatePromotionAction,
  deletePromotionAction,
  togglePromotionActiveAction,
  getPromotionStatsAction,
} from "@/app/actions/promotions";
import { getManilaDateTime } from "@/lib/dateUtils";
import { createClient } from "@/lib/supabase/client";
import toast, { Toaster } from "react-hot-toast";

export default function AdminPromotionsPage() {
  const supabase = createClient();

  // Data states
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({
    totalPromotions: 0,
    activePromotions: 0,
    totalRedemptions: 0,
    totalDiscountGranted: 0,
    isHappyHourLive: false,
    recentRedemptions: [],
  });

  // Filter states
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Promotion | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Manila Time Clock
  const [manilaInfo, setManilaInfo] = useState({
    currentTimeStr: "12:00",
    currentDateStr: "",
    dayName: "",
  });

  // Form state
  const [formData, setFormData] = useState<Partial<Promotion>>({
    name: "",
    type: "percentage",
    description: "",
    terms: "",
    image_url: "",
    is_active: true,
    status: "active",
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
    discount_percent: 10,
    discount_amount: 100,
    min_spend: 500,
    bundle_price: 599,
    bundle_items: [],
    eligible_menu_item_ids: [],
    eligible_categories: [],
    applicable_days: [1, 2, 3, 4, 5], // Mon-Fri default for happy hour
    start_time: "15:00",
    end_time: "18:00",
    birthday_reward_item_id: "",
    birthday_reward_name: "Complimentary Sweet Treat",
    birthday_window_days: 7,
    max_total_redemptions: null,
    max_per_customer: 1,
    allow_stacking: false,
    sort_order: 0,
  });

  // Bundle builder temporary state
  const [bundlePickItemId, setBundlePickItemId] = useState("");
  const [bundlePickQty, setBundlePickQty] = useState(1);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Load initial data
  const loadData = async () => {
    try {
      const [promos, statsData, menuRes] = await Promise.all([
        getPromotionsAction(true),
        getPromotionStatsAction(),
        supabase.from("menu_items").select("*").eq("available", true).order("name"),
      ]);

      setPromotions(promos);
      setStats(statsData);
      if (menuRes.data) {
        setMenuItems(menuRes.data);
      }

      const { currentTimeStr, currentDateStr, dayOfWeek } = getManilaDateTime();
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      setManilaInfo({
        currentTimeStr,
        currentDateStr,
        dayName: dayNames[dayOfWeek],
      });
    } catch (e) {
      console.error("Error loading promotions page data:", e);
      toast.error("Failed to load promotions data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Refresh Manila time every minute
    const interval = setInterval(() => {
      const { currentTimeStr, currentDateStr, dayOfWeek } = getManilaDateTime();
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      setManilaInfo({
        currentTimeStr,
        currentDateStr,
        dayName: dayNames[dayOfWeek],
      });
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // Filter promotions
  const filteredPromotions = promotions.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(search.toLowerCase())) ||
      item.type.toLowerCase().includes(search.toLowerCase());

    const matchesType = typeFilter === "all" || item.type === typeFilter;
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  // Categories list from menu
  const availableCategories = Array.from(new Set(menuItems.map((m) => m.category || "General")));

  // Open modal for Create or Edit
  const handleOpenModal = (promo?: Promotion) => {
    if (promo) {
      setEditingItem(promo);
      setFormData({
        ...promo,
      });
    } else {
      setEditingItem(null);
      const today = new Date().toISOString().split("T")[0];
      setFormData({
        name: "",
        type: "percentage",
        description: "",
        terms: "Standard restobar reservation and dine-in terms apply. One promo per transaction.",
        image_url: "",
        is_active: true,
        status: "active",
        start_date: today,
        end_date: "",
        discount_percent: 10,
        discount_amount: 100,
        min_spend: 500,
        bundle_price: 599,
        bundle_items: [],
        eligible_menu_item_ids: [],
        eligible_categories: [],
        applicable_days: [1, 2, 3, 4, 5],
        start_time: "15:00",
        end_time: "18:00",
        birthday_reward_item_id: "",
        birthday_reward_name: "Complimentary Sweet Treat",
        birthday_window_days: 7,
        max_total_redemptions: null,
        max_per_customer: 1,
        allow_stacking: false,
        sort_order: promotions.length + 1,
      });
    }
    setShowModal(true);
  };

  // Toggle active switch
  const handleToggleActive = async (id: string, current: boolean) => {
    const updated = !current;
    // Optimistic update
    setPromotions((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, is_active: updated, status: updated ? "active" : "inactive" } : p
      )
    );

    const res = await togglePromotionActiveAction(id, updated);
    if (!res.success) {
      toast.error(res.error || "Failed to toggle status");
      loadData();
    } else {
      toast.success(updated ? "Promotion activated!" : "Promotion deactivated.");
    }
  };

  // Delete promotion
  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    setDeleting(true);
    try {
      const res = await deletePromotionAction(deleteConfirmId);
      if (res.success) {
        toast.success("Promotion deleted successfully.");
        setPromotions((prev) => prev.filter((p) => p.id !== deleteConfirmId));
        setDeleteConfirmId(null);
      } else {
        toast.error(res.error || "Failed to delete promotion.");
      }
    } catch (e: any) {
      toast.error(e.message || "An error occurred.");
    } finally {
      setDeleting(false);
    }
  };

  // Image upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, WebP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size exceeds 5MB limit.");
      return;
    }

    setUploadingImage(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `promo_${Date.now()}.${fileExt}`;
      const filePath = `promotions/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("menu")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        // Fallback: convert to base64 data url
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormData((prev) => ({ ...prev, image_url: reader.result as string }));
          toast.success("Image uploaded!");
          setUploadingImage(false);
        };
        reader.readAsDataURL(file);
        return;
      }

      const { data: { publicUrl } } = supabase.storage.from("menu").getPublicUrl(filePath);
      setFormData((prev) => ({ ...prev, image_url: publicUrl }));
      toast.success("Image uploaded successfully!");
    } catch (err: any) {
      toast.error("Upload failed: " + err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  // Add item to bundle
  const handleAddBundleItem = () => {
    if (!bundlePickItemId) {
      toast.error("Please select a menu item to add to the bundle.");
      return;
    }
    const item = menuItems.find((m) => m.id === bundlePickItemId);
    if (!item) return;

    const existingIdx = (formData.bundle_items || []).findIndex((b) => b.menu_item_id === item.id);
    let updatedBundle = [...(formData.bundle_items || [])];

    if (existingIdx >= 0) {
      updatedBundle[existingIdx].quantity += bundlePickQty;
    } else {
      updatedBundle.push({
        menu_item_id: item.id,
        name: item.name,
        quantity: bundlePickQty,
        original_price: Number(item.price || 0),
      });
    }

    setFormData((prev) => ({ ...prev, bundle_items: updatedBundle }));
    setBundlePickItemId("");
    setBundlePickQty(1);
  };

  // Remove item from bundle
  const handleRemoveBundleItem = (index: number) => {
    const updated = (formData.bundle_items || []).filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, bundle_items: updated }));
  };

  // Calculated bundle regular sum
  const bundleRegularTotal = (formData.bundle_items || []).reduce(
    (sum, it) => sum + it.original_price * it.quantity,
    0
  );
  const bundleSavings = Math.max(0, bundleRegularTotal - (formData.bundle_price || 0));

  // Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingItem) {
        const res = await updatePromotionAction(editingItem.id, formData);
        if (res.success) {
          toast.success("Promotion updated successfully!");
          setShowModal(false);
          loadData();
        } else {
          toast.error(res.error || "Failed to update promotion.");
        }
      } else {
        const res = await createPromotionAction(formData);
        if (res.success) {
          toast.success("Promotion created successfully!");
          setShowModal(false);
          loadData();
        } else {
          toast.error(res.error || "Failed to create promotion.");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  // Helper for type icons & badge colors
  const getTypeMeta = (type: PromotionType) => {
    switch (type) {
      case "percentage":
        return {
          label: "Percentage Discount",
          icon: <Percent size={14} />,
          badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
          iconBg: "bg-blue-50 text-blue-700",
        };
      case "fixed_amount":
        return {
          label: "Fixed Discount",
          badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
          iconBg: "bg-purple-50 text-purple-700",
        };
      case "bundle":
        return {
          label: "Bundle Deal",
          icon: <Package size={14} />,
          badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
          iconBg: "bg-amber-50 text-amber-700",
        };
      case "happy_hour":
        return {
          label: "Happy Hour",
          icon: <Flame size={14} />,
          badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
          iconBg: "bg-rose-50 text-rose-700",
        };
      case "birthday":
        return {
          label: "Birthday Special",
          icon: <Cake size={14} />,
          badgeClass: "bg-pink-50 text-pink-700 border-pink-200",
          iconBg: "bg-pink-50 text-pink-700",
        };
    }
  };

  const getStatusBadge = (status: PromotionStatus) => {
    switch (status) {
      case "active":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active
          </span>
        );
      case "scheduled":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
            Scheduled
          </span>
        );
      case "expired":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Expired
          </span>
        );
      case "draft":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
            Draft
          </span>
        );
      case "inactive":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-50 text-gray-500 border border-gray-200">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
            Inactive
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <Toaster position="top-right" />

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-red-900/10 text-red-950 flex items-center justify-center font-bold">
              <Tag size={18} />
            </div>
            <h1
              className="text-2xl font-bold text-gray-900 tracking-tight"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Promotion Management System
            </h1>
          </div>
          <p className="text-xs text-gray-500">
            Configure percentage discounts, fixed vouchers, barkada bundles, happy hours, and birthday rewards.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowHistoryModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <History size={15} />
            <span>Redemption Log ({stats.totalRedemptions})</span>
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-950 hover:bg-red-900 text-white text-xs font-semibold transition-all shadow-md active:scale-95"
          >
            <Plus size={16} />
            <span>New Promotion</span>
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Promos */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
            <Sparkles size={22} />
          </div>
          <div>
            <p className="text-[11px] text-gray-400 uppercase font-semibold tracking-wider">Active Campaigns</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black text-gray-900">{stats.activePromotions}</span>
              <span className="text-xs text-gray-400">/ {stats.totalPromotions} total</span>
            </div>
          </div>
        </div>

        {/* Manila Happy Hour Status */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3.5">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold ${
              stats.isHappyHourLive ? "bg-rose-50 text-rose-700 animate-pulse" : "bg-orange-50 text-orange-700"
            }`}
          >
            <Flame size={22} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] text-gray-400 uppercase font-semibold tracking-wider">Manila Happy Hour</p>
              {stats.isHappyHourLive && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              )}
            </div>
            <p className="text-sm font-bold text-gray-900 mt-0.5">
              {stats.isHappyHourLive ? "🔥 Live Now (3PM - 6PM)" : "Inactive Currently"}
            </p>
            <p className="text-[10px] text-gray-400">Time: {manilaInfo.currentTimeStr} ({manilaInfo.dayName})</p>
          </div>
        </div>

        {/* Total Redemptions */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <p className="text-[11px] text-gray-400 uppercase font-semibold tracking-wider">Total Claims & Orders</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black text-gray-900">{stats.totalRedemptions}</span>
              <span className="text-xs text-gray-400">Redemptions</span>
            </div>
          </div>
        </div>

        {/* Total Savings Granted */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
            <TrendingUp size={22} />
          </div>
          <div>
            <p className="text-[11px] text-gray-400 uppercase font-semibold tracking-wider">Total Discount Savings</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black text-gray-900">
                ₱{stats.totalDiscountGranted.toLocaleString()}
              </span>
              <span className="text-xs text-gray-400">Granted</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-gray-100 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by promo name, description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-red-400 transition-colors"
            />
          </div>

          {/* Type Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto overflow-x-auto">
            {[
              { id: "all", label: "All Types" },
              { id: "percentage", label: "Percentage (%)" },
              { id: "fixed_amount", label: "Fixed (₱)" },
              { id: "bundle", label: "Bundles" },
              { id: "happy_hour", label: "Happy Hour" },
              { id: "birthday", label: "Birthday" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTypeFilter(t.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  typeFilter === t.id
                    ? "bg-red-950 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-xs font-semibold text-gray-600">
            {["all", "active", "scheduled", "expired", "inactive"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-lg capitalize transition-all ${
                  statusFilter === s ? "bg-white text-gray-900 shadow-sm font-bold" : "hover:text-gray-900"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Promotion Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-64 bg-gray-100 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : filteredPromotions.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-red-50 text-red-900 flex items-center justify-center mx-auto mb-3">
            <Tag size={24} />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">No promotions match your filters</h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto mb-5">
            Try adjusting your search query, or create a brand new campaign using the 5 promotion types.
          </p>
          <button
            onClick={() => handleOpenModal()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-950 text-white rounded-xl text-xs font-semibold hover:bg-red-900 shadow-sm"
          >
            <Plus size={15} /> Create Promotion
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPromotions.map((promo) => {
            const meta = getTypeMeta(promo.type);
            return (
              <div
                key={promo.id}
                className={`bg-white rounded-3xl border transition-all duration-200 overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-md ${
                  promo.is_active ? "border-gray-200/80" : "border-gray-200/50 opacity-75 bg-gray-50/50"
                }`}
              >
                {/* Card Top Image / Header */}
                <div className="relative">
                  {promo.image_url ? (
                    <div className="h-40 w-full overflow-hidden bg-gray-100 relative group">
                      <img
                        src={promo.image_url}
                        alt={promo.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    </div>
                  ) : (
                    <div className="h-28 w-full bg-gradient-to-br from-red-950 via-[#4d0c18] to-red-900 flex items-center justify-center relative">
                      <div className="text-white/20">
                        {meta.icon}
                      </div>
                    </div>
                  )}

                  {/* Badges on image */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider backdrop-blur-md border ${meta.badgeClass}`}
                    >
                      {meta.icon} {meta.label}
                    </span>
                    {getStatusBadge(promo.status)}
                  </div>

                  <div className="absolute bottom-2.5 left-3.5 right-3.5 text-white">
                    <h3 className="font-bold text-base text-white drop-shadow-sm line-clamp-1">
                      {promo.name}
                    </h3>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <div>
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                      {promo.description || "No promotional description provided."}
                    </p>

                    {/* Specific Promotion Details */}
                    <div className="mt-3 p-3 bg-gray-50 rounded-2xl border border-gray-100 text-xs space-y-1.5">
                      {promo.type === "percentage" && (
                        <div className="flex items-center justify-between text-gray-700">
                          <span className="font-semibold text-blue-900">{promo.discount_percent}% Off</span>
                          <span className="text-[11px] text-gray-500">
                            Min. Spend: ₱{promo.min_spend.toLocaleString()}
                          </span>
                        </div>
                      )}

                      {promo.type === "fixed_amount" && (
                        <div className="flex items-center justify-between text-gray-700">
                          <span className="font-bold text-purple-900">₱{promo.discount_amount} Discount</span>
                          <span className="text-[11px] text-gray-500">
                            Min. Spend: ₱{promo.min_spend.toLocaleString()}
                          </span>
                        </div>
                      )}

                      {promo.type === "bundle" && (
                        <div>
                          <div className="flex items-center justify-between font-bold">
                            <span className="text-amber-800">₱{promo.bundle_price.toLocaleString()} Bundle</span>
                            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              Save ₱{promo.discount_amount || 130}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-400 mt-1 line-clamp-1">
                            Includes: {promo.bundle_items.map((b) => `${b.quantity}x ${b.name}`).join(", ") || "Custom items"}
                          </p>
                        </div>
                      )}

                      {promo.type === "happy_hour" && (
                        <div>
                          <div className="flex items-center justify-between font-bold text-rose-900">
                            <span>{promo.discount_percent}% Off Drinks</span>
                            <span className="text-[10px] text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full font-semibold">
                              ⏰ {promo.start_time} - {promo.end_time}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-400 mt-1">
                            Mon - Fri (Asia/Manila time)
                          </p>
                        </div>
                      )}

                      {promo.type === "birthday" && (
                        <div>
                          <div className="flex items-center justify-between font-bold text-pink-900">
                            <span>Complimentary Treat</span>
                            <span className="text-[10px] text-pink-700 bg-pink-50 px-2 py-0.5 rounded-full font-semibold">
                              🎂 1x Per Year
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-400 mt-1 line-clamp-1">
                            {promo.birthday_reward_name || "Special Sweet Treat"} (Min spend: ₱{promo.min_spend})
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Validity & Usage counter */}
                    <div className="mt-3 flex items-center justify-between text-[11px] text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {promo.end_date ? `Until ${promo.end_date}` : "Ongoing"}
                      </span>
                      <span className="font-medium text-gray-600">
                        {promo.current_redemptions_count} Redemptions
                      </span>
                    </div>
                  </div>

                  {/* Card Action Bar */}
                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                    {/* Toggle Active Switch */}
                    <button
                      type="button"
                      onClick={() => handleToggleActive(promo.id, promo.is_active)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        promo.is_active
                          ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          promo.is_active ? "bg-emerald-500 animate-pulse" : "bg-gray-400"
                        }`}
                      />
                      <span>{promo.is_active ? "Active" : "Inactive"}</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenModal(promo)}
                        className="p-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                        title="Edit Promotion"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(promo.id)}
                        className="p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete Promotion"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT PROMOTION MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-gray-100 my-8 max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-900/10 text-red-950 flex items-center justify-center font-bold">
                  <Tag size={20} />
                </div>
                <div>
                  <h2
                    className="text-lg font-bold text-gray-900"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    {editingItem ? "Edit Promotion Campaign" : "Create New Promotion"}
                  </h2>
                  <p className="text-xs text-gray-400">
                    Select a promotion model and configure its discount logic & scheduling.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-5">
              {/* Promotion Type Selector (5 Models) */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  1. Select Promotion Type
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { id: "percentage", label: "Percentage", icon: <Percent size={15} />, desc: "e.g. 10% Off" },
                    { id: "fixed_amount", label: "Fixed ₱", desc: "₱100 off ₱800" },
                    { id: "bundle", label: "Bundle Deal", icon: <Package size={15} />, desc: "Meal deal ₱599" },
                    { id: "happy_hour", label: "Happy Hour", icon: <Flame size={15} />, desc: "3PM - 6PM Drinks" },
                    { id: "birthday", label: "Birthday", icon: <Cake size={15} />, desc: "Free Sweet Treat" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, type: t.id as PromotionType })}
                      className={`p-2.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                        formData.type === t.id
                          ? "border-red-900 bg-red-50/50 text-red-950 shadow-sm ring-1 ring-red-900"
                          : "border-gray-200 hover:border-gray-300 text-gray-700 bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                        {t.icon}
                        <span>{t.label}</span>
                      </div>
                      <span className="text-[10px] text-gray-400">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Promotion Details Box */}
              <div className="p-4 sm:p-5 bg-gray-50/80 rounded-2xl border border-gray-200/70 space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-800">
                  <Sparkles size={14} className="text-red-900" />
                  <span>2. Specific Rules for {getTypeMeta(formData.type as PromotionType).label}</span>
                </div>

                {/* TYPE A: Percentage Discount */}
                {formData.type === "percentage" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Discount Percentage (%) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          max="100"
                          required
                          value={formData.discount_percent || ""}
                          onChange={(e) =>
                            setFormData({ ...formData, discount_percent: Math.min(100, Math.max(1, Number(e.target.value))) })
                          }
                          className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-red-400 bg-white"
                          placeholder="e.g. 10"
                        />
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">%</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">Calculates automatic deduction on eligible subtotal.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Minimum Order Spend (₱)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.min_spend ?? 0}
                        onChange={(e) => setFormData({ ...formData, min_spend: Math.max(0, Number(e.target.value)) })}
                        className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-red-400 bg-white"
                        placeholder="e.g. 1000"
                      />
                      <p className="text-[10px] text-gray-400 mt-1">Order must meet this amount before discount triggers.</p>
                    </div>
                  </div>
                )}

                {/* TYPE B: Fixed Amount Discount */}
                {formData.type === "fixed_amount" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Fixed Discount Amount (₱) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={formData.discount_amount || ""}
                        onChange={(e) => setFormData({ ...formData, discount_amount: Math.max(1, Number(e.target.value)) })}
                        className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-red-400 bg-white"
                        placeholder="e.g. 100"
                      />
                      <p className="text-[10px] text-gray-400 mt-1">Exact peso amount deducted from qualifying total.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Minimum Qualifying Spend (₱) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={formData.min_spend || ""}
                        onChange={(e) => setFormData({ ...formData, min_spend: Math.max(1, Number(e.target.value)) })}
                        className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-red-400 bg-white"
                        placeholder="e.g. 800"
                      />
                      <p className="text-[10px] text-gray-400 mt-1">E.g. ₱100 off orders worth at least ₱800.</p>
                    </div>
                  </div>
                )}

                {/* TYPE C: Bundle Promo Builder */}
                {formData.type === "bundle" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Bundle Promotional Price (₱) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={formData.bundle_price || ""}
                          onChange={(e) => setFormData({ ...formData, bundle_price: Math.max(1, Number(e.target.value)) })}
                          className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-red-400 bg-white font-bold"
                          placeholder="e.g. 599 or 999"
                        />
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-gray-200 text-xs flex flex-col justify-center">
                        <span className="text-gray-400 text-[10px] uppercase font-bold">Calculated Bundle Savings</span>
                        <div className="flex items-baseline gap-2 mt-0.5">
                          <span className="text-sm font-bold text-gray-900">
                            Regular: ₱{bundleRegularTotal.toLocaleString()}
                          </span>
                          <span className="text-xs text-emerald-600 font-extrabold">
                            Save ₱{bundleSavings.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bundle Items Selector */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Add Included Menu Products:
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={bundlePickItemId}
                          onChange={(e) => setBundlePickItemId(e.target.value)}
                          className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-red-400"
                        >
                          <option value="">-- Choose Menu Item --</option>
                          {menuItems.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.category}) — ₱{m.price} [Stock: {m.stock ?? 50}]
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="1"
                          max="99"
                          value={bundlePickQty}
                          onChange={(e) => setBundlePickQty(Math.max(1, Number(e.target.value)))}
                          className="w-16 px-2 py-2 text-xs border border-gray-200 rounded-xl bg-white text-center"
                          title="Quantity"
                        />
                        <button
                          type="button"
                          onClick={handleAddBundleItem}
                          className="px-3 py-2 bg-red-950 text-white rounded-xl text-xs font-semibold hover:bg-red-900"
                        >
                          Add Item
                        </button>
                      </div>

                      {/* Included Items Table */}
                      {(formData.bundle_items || []).length > 0 ? (
                        <div className="mt-3 border border-gray-200 rounded-xl overflow-hidden bg-white">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50 border-b border-gray-200 text-gray-400 text-[10px] uppercase">
                              <tr>
                                <th className="px-3 py-2 text-left">Product</th>
                                <th className="px-3 py-2 text-center">Qty</th>
                                <th className="px-3 py-2 text-right">Unit Price</th>
                                <th className="px-3 py-2 text-right">Subtotal</th>
                                <th className="px-3 py-2 text-center">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {(formData.bundle_items || []).map((it, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 font-medium text-gray-800">{it.name}</td>
                                  <td className="px-3 py-2 text-center font-bold">{it.quantity}</td>
                                  <td className="px-3 py-2 text-right text-gray-500">₱{it.original_price}</td>
                                  <td className="px-3 py-2 text-right font-semibold">
                                    ₱{(it.original_price * it.quantity).toLocaleString()}
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveBundleItem(idx)}
                                      className="text-red-500 hover:text-red-700 p-1"
                                    >
                                      <X size={13} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-[11px] text-gray-400 italic mt-2">
                          No items added to bundle yet. Select products above.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* TYPE D: Happy Hour Promo */}
                {formData.type === "happy_hour" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Discount % <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          required
                          value={formData.discount_percent || ""}
                          onChange={(e) =>
                            setFormData({ ...formData, discount_percent: Math.min(100, Math.max(1, Number(e.target.value))) })
                          }
                          className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white"
                          placeholder="e.g. 20"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Start Time (Asia/Manila) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="time"
                          required
                          value={formData.start_time || "15:00"}
                          onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                          className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          End Time (Asia/Manila) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="time"
                          required
                          value={formData.end_time || "18:00"}
                          onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                          className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white"
                        />
                      </div>
                    </div>

                    {/* Applicable Days */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Active Days of the Week:
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { val: 1, label: "Mon" },
                          { val: 2, label: "Tue" },
                          { val: 3, label: "Wed" },
                          { val: 4, label: "Thu" },
                          { val: 5, label: "Fri" },
                          { val: 6, label: "Sat" },
                          { val: 0, label: "Sun" },
                        ].map((d) => {
                          const active = (formData.applicable_days || []).includes(d.val);
                          return (
                            <button
                              key={d.val}
                              type="button"
                              onClick={() => {
                                const currentDays = formData.applicable_days || [];
                                const nextDays = active
                                  ? currentDays.filter((x) => x !== d.val)
                                  : [...currentDays, d.val];
                                setFormData({ ...formData, applicable_days: nextDays });
                              }}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                active
                                  ? "bg-rose-900 text-white shadow-sm"
                                  : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-100"
                              }`}
                            >
                              {d.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Categories */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Eligible Categories (Drinks/Food):
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {availableCategories.map((cat) => {
                          const active = (formData.eligible_categories || []).includes(cat);
                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => {
                                const currentCats = formData.eligible_categories || [];
                                const nextCats = active
                                  ? currentCats.filter((x) => x !== cat)
                                  : [...currentCats, cat];
                                setFormData({ ...formData, eligible_categories: nextCats });
                              }}
                              className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-all ${
                                active
                                  ? "bg-red-950 text-white border-red-950 shadow-sm"
                                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-100"
                              }`}
                            >
                              {cat}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* TYPE E: Birthday Promo */}
                {formData.type === "birthday" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Select Complimentary Reward Item
                        </label>
                        <select
                          value={formData.birthday_reward_item_id || ""}
                          onChange={(e) => {
                            const found = menuItems.find((m) => m.id === e.target.value);
                            setFormData({
                              ...formData,
                              birthday_reward_item_id: e.target.value,
                              birthday_reward_name: found ? `Complimentary ${found.name}` : "Free Birthday Treat",
                              discount_amount: Number(found?.price || 39),
                            });
                          }}
                          className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white"
                        >
                          <option value="">-- Choose from Menu (e.g. Kropek / Dessert) --</option>
                          {menuItems.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} (₱{m.price})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Or Custom Reward Name:
                        </label>
                        <input
                          type="text"
                          value={formData.birthday_reward_name || ""}
                          onChange={(e) => setFormData({ ...formData, birthday_reward_name: e.target.value })}
                          className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white"
                          placeholder="e.g. Complimentary Leche Flan"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Eligibility Window (+/- Days from Birthday)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={formData.birthday_window_days || 7}
                          onChange={(e) => setFormData({ ...formData, birthday_window_days: Math.max(1, Number(e.target.value)) })}
                          className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white"
                          placeholder="e.g. 7 or 15"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">Customer can claim within this many days of birthdate.</p>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Minimum Order Spend (₱)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={formData.min_spend ?? 300}
                          onChange={(e) => setFormData({ ...formData, min_spend: Math.max(0, Number(e.target.value)) })}
                          className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white"
                          placeholder="e.g. 300"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Universal Campaign Details */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  3. Campaign Information
                </label>

                {/* Name */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Promotion Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Weekend VIP Pulutan Fiesta"
                    value={formData.name || ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-red-400"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Description & Details</label>
                  <textarea
                    rows={2}
                    placeholder="Provide details about discounts, menu savings, and what's included..."
                    value={formData.description || ""}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-red-400 resize-none"
                  />
                </div>

                {/* Terms */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Terms & Conditions</label>
                  <textarea
                    rows={2}
                    placeholder="Eligibility, redemption limits, Philippine SC/PWD non-stacking rules..."
                    value={formData.terms || ""}
                    onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-red-400 resize-none"
                  />
                </div>

                {/* Validity Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={formData.start_date || ""}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-red-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Expiration Date</label>
                    <input
                      type="date"
                      value={formData.end_date || ""}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-red-400"
                    />
                  </div>
                </div>

                {/* Image Upload */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Promotional Banner Image</label>
                  {formData.image_url ? (
                    <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 h-32 flex items-center justify-center">
                      <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, image_url: "" })}
                        className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1.5 shadow-md hover:bg-red-700 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-gray-200 hover:border-red-400 rounded-2xl p-3.5 text-center cursor-pointer transition-colors bg-gray-50/50 hover:bg-gray-50"
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
                            <Upload size={18} className="text-gray-400" />
                            <span className="text-xs font-semibold text-gray-700">Upload Banner Image</span>
                            <span className="text-[10px] text-gray-400">PNG, JPG, WebP up to 5MB</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-gray-400">Or Image URL:</span>
                        <input
                          type="url"
                          placeholder="https://images.unsplash.com/..."
                          value={formData.image_url || ""}
                          onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                          className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-red-400"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Stacking & Limits */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200/70">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="w-4 h-4 rounded text-red-900 focus:ring-red-900 border-gray-300"
                      />
                      <div>
                        <p className="text-xs font-bold text-gray-800">Publish Immediately (Active)</p>
                        <p className="text-[10px] text-gray-400">Visible to customers during checkout</p>
                      </div>
                    </label>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200/70">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.allow_stacking}
                        onChange={(e) => setFormData({ ...formData, allow_stacking: e.target.checked })}
                        className="w-4 h-4 rounded text-red-900 focus:ring-red-900 border-gray-300"
                      />
                      <div>
                        <p className="text-xs font-bold text-gray-800">Allow Stacking</p>
                        <p className="text-[10px] text-gray-400">Can be combined with other offers</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || uploadingImage}
                  className="px-5 py-2.5 rounded-xl bg-red-950 hover:bg-red-900 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md active:scale-95 transition-all disabled:opacity-50"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  <span>{editingItem ? "Save Changes" : "Create Campaign"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REDEMPTION HISTORY AUDIT LOG MODAL */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-7 shadow-2xl border border-gray-100 my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                  <History size={20} />
                </div>
                <div>
                  <h2
                    className="text-lg font-bold text-gray-900"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    Promotion Redemption & Audit History
                  </h2>
                  <p className="text-xs text-gray-400">
                    Live log of all customer and walk-in promotional redemptions.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {stats.recentRedemptions.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-xs">
                <p>No promotion redemptions recorded yet.</p>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 text-[10px] uppercase">
                    <tr>
                      <th className="px-3.5 py-2.5 text-left">Customer</th>
                      <th className="px-3.5 py-2.5 text-left">Promotion Name</th>
                      <th className="px-3.5 py-2.5 text-left">Type</th>
                      <th className="px-3.5 py-2.5 text-right">Discount (₱)</th>
                      <th className="px-3.5 py-2.5 text-left">Date / Time</th>
                      <th className="px-3.5 py-2.5 text-left">Processed By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {stats.recentRedemptions.map((r: any) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-3.5 py-2.5 font-semibold text-gray-900">
                          {r.customer_name}
                          {r.customer_email && (
                            <span className="block text-[10px] text-gray-400 font-normal">{r.customer_email}</span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 font-medium text-gray-800">{r.promotion_name}</td>
                        <td className="px-3.5 py-2.5 capitalize text-gray-500">{r.promotion_type}</td>
                        <td className="px-3.5 py-2.5 text-right font-bold text-emerald-700">
                          ₱{Number(r.discount_amount || 0).toLocaleString()}
                        </td>
                        <td className="px-3.5 py-2.5 text-gray-500 text-[11px]">
                          {new Date(r.redeemed_at).toLocaleDateString()} {new Date(r.redeemed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-3.5 py-2.5 text-gray-600 font-mono text-[11px]">
                          {r.processed_by || "System"}
                          {r.verified_birthday && (
                            <span className="ml-1 text-[9px] bg-pink-50 text-pink-700 font-bold px-1.5 py-0.5 rounded-full border border-pink-200">
                              Bday Verified
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center border border-gray-100">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
              <AlertCircle size={24} />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">Delete Promotion?</h3>
            <p className="text-xs text-gray-500 mb-5">
              Are you sure you want to remove this promotion? Active customers will no longer be able to claim or apply it.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                disabled={deleting}
                onClick={handleDelete}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold disabled:opacity-60 flex items-center gap-1.5"
              >
                {deleting && <Loader2 size={13} className="animate-spin" />}
                <span>{deleting ? "Deleting..." : "Yes, Delete"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
