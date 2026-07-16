"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  User,
  Bell,
  CalendarDays,
  Camera,
  Check,
  CheckCheck,
  X,
  ChevronRight,
  LogOut,
  Phone,
  Mail,
  Calendar,
  Clock,
  Loader2,
  Pencil,
  Save,
  Eye,
  Printer,
  Trash2,
} from "lucide-react";
import ReservationDetailsModal from "@/components/ReservationDetailsModal";
import { formatDistanceToNow } from "date-fns";
import { formatDate, formatTime } from "@/lib/dateUtils";
import toast, { Toaster } from "react-hot-toast";

type Tab = "profile" | "reservations" | "notifications";

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  dob: string | null;
  photo_url: string | null;
  role: string;
}

interface Reservation {
  id: string;
  reservation_code: string;
  date: string;
  time_start: string;
  guests: number;
  status: string;
  total_amount: number;
  notes: string | null;
  services: { name: string; type: string; description?: string | null } | null;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  read: boolean;
  created_at: string;
}

const statusColors: Record<string, string> = {
  pending:   "bg-amber-100 text-amber-700 border-amber-200",
  confirmed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-100 text-red-600 border-red-200",
};

const notifColors: Record<string, string> = {
  reservation: "bg-blue-100 text-blue-700",
  payment:     "bg-emerald-100 text-emerald-700",
  warning:     "bg-amber-100 text-amber-700",
  error:       "bg-red-100 text-red-600",
  success:     "bg-green-100 text-green-700",
  info:        "bg-gray-100 text-gray-600",
};

export default function ProfilePage() {
  const supabase = createClient();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<Tab>("profile");
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [viewModalRes, setViewModalRes] = useState<Reservation | null>(null);

  // Editable fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  // Realtime notifications
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("profile-notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (payload) => {
        const n = payload.new as Notification;
        setNotifications((prev) => [n, ...prev]);
        toast.custom(() => (
          <div className="bg-white border border-gray-100 shadow-xl rounded-xl px-4 py-3 flex items-center gap-3 max-w-xs">
            <Bell size={18} className="text-red-700 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-gray-800">{n.title}</p>
              {n.message && <p className="text-xs text-gray-500">{n.message}</p>}
            </div>
          </div>
        ), { duration: 4000 });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loadAll = async () => {
    setLoading(true);
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) { router.push("/login"); return; }
    setUser({ id: authUser.id, email: authUser.email ?? "" });

    const [{ data: prof }, { data: res }, { data: notifs }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", authUser.id).single(),
      supabase.from("reservations").select("*, services(name, type, description), payments(method, reference_number, receipt_url, status), reservation_menu(quantity, menu_items(name, price))").eq("customer_email", authUser.email).order("date", { ascending: false }),
      supabase.from("notifications").select("*").eq("user_id", authUser.id).order("created_at", { ascending: false }).limit(30),
    ]);

    if (prof) {
      setProfile(prof);
      setFirstName(prof.first_name ?? "");
      setLastName(prof.last_name ?? "");
      setPhone(prof.phone ?? "");
      setDob(prof.dob ?? "");
    }
    setReservations(res ?? []);
    setNotifications(notifs ?? []);
    setLoading(false);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      first_name: firstName,
      last_name: lastName,
      phone,
      dob: dob || null,
    }).eq("id", user.id);

    if (error) {
      toast.error("Failed to save changes.");
    } else {
      toast.success("Profile updated!");
      setProfile((prev) => prev ? { ...prev, first_name: firstName, last_name: lastName, phone, dob } : prev);
      setEditing(false);
    }
    setSaving(false);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    const { error: paymentError } = await supabase.from("payments").delete().eq("reservation_id", id);
    if (paymentError && paymentError.code !== 'PGRST116') {
      console.warn("Payment delete failed", paymentError);
    }
    const { error } = await supabase.from("reservations").delete().eq("id", id);
    if (!error) {
      toast.success("Reservation deleted!");
      setReservations(prev => prev.filter(r => r.id !== id));
    } else {
      toast.error("Failed to delete reservation");
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const ext = file.name.split(".").pop();
    const path = `avatars/${user.id}.${ext}`;
    setUploading(true);

    const { error: uploadError } = await supabase.storage
      .from("uploads")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error("Photo upload failed: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from("uploads").getPublicUrl(path);

    await supabase.from("profiles").update({ photo_url: publicUrl }).eq("id", user.id);
    setProfile((prev) => prev ? { ...prev, photo_url: publicUrl } : prev);
    toast.success("Profile photo updated!");
    setUploading(false);
  };

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = async () => {
    const ids = notifications.filter((n) => !n.read).map((n) => n.id);
    if (!ids.length) return;
    await supabase.from("notifications").update({ read: true }).in("id", ids);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const deleteNotif = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const unread = notifications.filter((n) => !n.read).length;
  const initials = [profile?.first_name, profile?.last_name].filter(Boolean).map((s) => s![0]).join("").toUpperCase() || user?.email?.[0]?.toUpperCase() || "?";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8f5]">
        <Loader2 size={32} className="animate-spin text-red-800" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8f5]" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Toaster position="top-right" />

      {/* ── Top Bar ── */}
      <header className="bg-[#3d0a14] px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-bold text-xl" style={{ fontFamily: "'Playfair Display', serif" }}>
          <span className="text-white">Jbenz</span>
          <span style={{ color: "#c9a84c" }}> Bistro</span>
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-white/70 hover:text-white text-sm transition-colors"
        >
          <LogOut size={15} />
          Sign Out
        </button>
      </header>

      {/* ── Profile Hero ── */}
      <div className="bg-gradient-to-b from-[#3d0a14] to-[#5c1020] pb-16 pt-8 px-6 text-center">
        {/* Avatar */}
        <div className="relative inline-block mb-4">
          <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white/20 shadow-2xl mx-auto">
            {profile?.photo_url ? (
              <img src={profile.photo_url} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[#c9a84c] flex items-center justify-center text-3xl font-bold text-white">
                {initials}
              </div>
            )}
          </div>
          {/* Upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute bottom-0 right-0 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-all"
          >
            {uploading
              ? <Loader2 size={14} className="animate-spin text-gray-500" />
              : <Camera size={14} className="text-gray-600" />
            }
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
        </div>

        <h1 className="text-white text-xl font-bold mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
          {[profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Guest"}
        </h1>
        <p className="text-white/60 text-sm">{user?.email}</p>
        <span className="inline-block mt-2 px-3 py-0.5 rounded-full text-xs font-semibold capitalize" style={{ background: "rgba(201,168,76,0.2)", color: "#c9a84c", border: "1px solid rgba(201,168,76,0.3)" }}>
          {profile?.role ?? "customer"}
        </span>
      </div>

      {/* ── Tabs ── */}
      <div className="max-w-2xl mx-auto px-4 -mt-8">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
          {/* Tab Bar */}
          <div className="grid grid-cols-3 border-b border-gray-100">
            {(["profile", "reservations", "notifications"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative py-4 text-xs font-semibold tracking-wide uppercase transition-colors flex flex-col items-center gap-1 ${
                  tab === t ? "text-red-800" : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {t === "profile" && <User size={16} />}
                {t === "reservations" && <CalendarDays size={16} />}
                {t === "notifications" && (
                  <div className="relative">
                    <Bell size={16} />
                    {unread > 0 && (
                      <span className="absolute -top-1.5 -right-2 w-3.5 h-3.5 bg-red-600 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </div>
                )}
                <span>{t === "notifications" ? "Alerts" : t}</span>
                {tab === t && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-700 rounded-t-full" />
                )}
              </button>
            ))}
          </div>

          {/* ── PROFILE TAB ── */}
          {tab === "profile" && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-bold text-gray-800 text-base" style={{ fontFamily: "'Playfair Display', serif" }}>
                  Personal Information
                </h2>
                {!editing ? (
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1.5 text-xs text-red-700 font-semibold hover:text-red-900 transition-colors"
                  >
                    <Pencil size={13} /> Edit
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditing(false); setFirstName(profile?.first_name ?? ""); setLastName(profile?.last_name ?? ""); setPhone(profile?.phone ?? ""); setDob(profile?.dob ?? ""); }}
                      className="text-xs text-gray-400 hover:text-gray-600 font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveProfile}
                      disabled={saving}
                      className="flex items-center gap-1.5 text-xs bg-red-800 text-white px-3 py-1.5 rounded-lg hover:bg-red-900 font-semibold transition-all"
                    >
                      {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      Save
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 font-medium mb-1">First Name</label>
                    {editing ? (
                      <input
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-700 focus:ring-2 focus:ring-red-700/10 transition-all"
                      />
                    ) : (
                      <p className="text-sm text-gray-800 font-medium py-2">{profile?.first_name || <span className="text-gray-400 italic">Not set</span>}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 font-medium mb-1">Last Name</label>
                    {editing ? (
                      <input
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-700 focus:ring-2 focus:ring-red-700/10 transition-all"
                      />
                    ) : (
                      <p className="text-sm text-gray-800 font-medium py-2">{profile?.last_name || <span className="text-gray-400 italic">Not set</span>}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 font-medium mb-1 flex items-center gap-1.5">
                    <Mail size={12} /> Email Address
                  </label>
                  <p className="text-sm text-gray-400 py-2">{user?.email} <span className="text-xs text-gray-300">(cannot change)</span></p>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 font-medium mb-1 flex items-center gap-1.5">
                    <Phone size={12} /> Phone Number
                  </label>
                  {editing ? (
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="09XX XXX XXXX"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-700 focus:ring-2 focus:ring-red-700/10 transition-all"
                    />
                  ) : (
                    <p className="text-sm text-gray-800 font-medium py-2">{profile?.phone || <span className="text-gray-400 italic">Not set</span>}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-gray-500 font-medium mb-1 flex items-center gap-1.5">
                    <Calendar size={12} /> Date of Birth
                  </label>
                  {editing ? (
                    <input
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-700 focus:ring-2 focus:ring-red-700/10 transition-all"
                    />
                  ) : (
                    <p className="text-sm text-gray-800 font-medium py-2">
                      {profile?.dob ? formatDate(profile.dob) : <span className="text-gray-400 italic">Not set</span>}
                    </p>
                  )}
                </div>
              </div>

              {/* Quick links */}
              <div className="mt-6 pt-5 border-t border-gray-100 space-y-1">
                <button
                  onClick={() => setTab("reservations")}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center gap-3 text-sm text-gray-700">
                    <CalendarDays size={16} className="text-red-700" />
                    My Reservations
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{reservations.length}</span>
                  </div>
                  <ChevronRight size={15} className="text-gray-300 group-hover:text-gray-500" />
                </button>
                <button
                  onClick={() => setTab("notifications")}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center gap-3 text-sm text-gray-700">
                    <Bell size={16} className="text-red-700" />
                    Notifications
                    {unread > 0 && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">{unread} unread</span>
                    )}
                  </div>
                  <ChevronRight size={15} className="text-gray-300 group-hover:text-gray-500" />
                </button>
              </div>
            </div>
          )}

          {/* ── RESERVATIONS TAB ── */}
          {tab === "reservations" && (
            <div className="p-6">
              <h2 className="font-bold text-gray-800 text-base mb-5" style={{ fontFamily: "'Playfair Display', serif" }}>
                My Reservations
              </h2>
              {reservations.length === 0 ? (
                <div className="text-center py-12">
                  <CalendarDays size={40} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">No reservations yet</p>
                  <Link
                    href="/reserve"
                    className="inline-block mt-4 px-5 py-2 bg-red-800 text-white text-sm font-semibold rounded-xl hover:bg-red-900 transition-colors"
                  >
                    Book Now
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {reservations.map((res) => (
                    <div
                      key={res.id}
                      className="border border-gray-100 rounded-2xl p-4 hover:shadow-md transition-shadow bg-white"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="text-xs font-mono text-gray-400 mb-0.5">{res.reservation_code}</p>
                          <p className="text-sm font-bold text-gray-800">
                            {res.services?.name ?? "Unknown Service"}
                          </p>
                          <p className="text-xs text-gray-400 capitalize">{res.services?.type ?? ""}</p>
                          {res.services?.description && (
                            <p className="text-[11px] text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                              {res.services.description}
                            </p>
                          )}
                        </div>
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border capitalize ${statusColors[res.status] ?? statusColors.pending}`}>
                          {res.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar size={11} />
                          {formatDate(res.date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {formatTime(res.time_start)}
                        </span>
                        <span className="flex items-center gap-1">
                          <User size={11} />
                          {res.guests} {res.guests === 1 ? "guest" : "guests"}
                        </span>
                        {res.total_amount > 0 && (
                          <span className="ml-auto font-semibold text-gray-700">
                            ₱{res.total_amount.toLocaleString()}
                          </span>
                        )}
                      </div>
                      {res.notes && (
                        <p className="mt-2 text-xs text-gray-400 italic border-t border-gray-50 pt-2">{res.notes}</p>
                      )}
                      
                      <div className="mt-3 pt-3 border-t border-gray-50 flex gap-2 justify-end">
                        <button
                          onClick={() => setViewModalRes(res)}
                          className="px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                        >
                          <Eye size={13} /> View
                        </button>
                        <button
                          onClick={() => window.open(`/receipt/${res.id}`, '_blank')}
                          className="px-3 py-1.5 text-xs font-semibold text-red-700 border border-red-100 bg-red-50 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1.5"
                        >
                          <Printer size={13} /> Print
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(res.id)}
                          className="px-3 py-1.5 text-xs font-semibold text-gray-500 border border-gray-200 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors flex items-center gap-1.5 ml-auto"
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── NOTIFICATIONS TAB ── */}
          {tab === "notifications" && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-bold text-gray-800 text-base" style={{ fontFamily: "'Playfair Display', serif" }}>
                  Notifications
                </h2>
                {unread > 0 && (
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1.5 text-xs text-red-700 font-semibold hover:text-red-900 transition-colors"
                  >
                    <CheckCheck size={13} /> Mark all read
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div className="text-center py-12">
                  <Bell size={40} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">No notifications yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`rounded-xl p-4 border transition-colors relative ${
                        !notif.read ? "bg-red-50/50 border-red-100" : "bg-white border-gray-100"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 capitalize ${notifColors[notif.type] ?? notifColors.info}`}>
                          {notif.type}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800">{notif.title}</p>
                          {notif.message && (
                            <p className="text-xs text-gray-500 mt-0.5">{notif.message}</p>
                          )}
                          <p className="text-[10px] text-gray-400 mt-1">
                            {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          {!notif.read && (
                            <button
                              onClick={() => markRead(notif.id)}
                              className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center hover:bg-emerald-100 transition-colors"
                            >
                              <Check size={11} className="text-emerald-600" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteNotif(notif.id)}
                            className="w-6 h-6 rounded-full bg-gray-50 flex items-center justify-center hover:bg-red-50 transition-colors"
                          >
                            <X size={11} className="text-gray-400 hover:text-red-500" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Back to home */}
        <div className="text-center mt-6 mb-8">
          <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            ← Back to Home
          </Link>
        </div>
      </div>

      {viewModalRes && (
        <ReservationDetailsModal
          reservation={viewModalRes}
          onClose={() => setViewModalRes(null)}
        />
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteConfirmId(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center shadow-xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={28} strokeWidth={2} />
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">Delete Reservation?</h3>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              This action cannot be undone. This reservation and its payment records will be permanently removed.
            </p>
            <div className="flex gap-3 w-full">
              <button 
                onClick={() => setDeleteConfirmId(null)} 
                className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete} 
                className="flex-1 bg-red-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-red-700 transition-colors shadow-lg shadow-red-600/30"
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
