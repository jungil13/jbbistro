"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Layers,
  Plus,
  Edit2,
  X,
  CheckCircle,
  AlertCircle,
  Wrench,
  Mic2,
  Circle,
  Users,
  PhilippinePeso,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

interface Service {
  id: string;
  type: string;
  name: string;
  category: string;
  hourly_rate: number;
  capacity: number;
  status: "available" | "occupied" | "maintenance";
  description?: string;
}

const statusConfig = {
  available: { label: "Available", color: "bg-green-100 text-green-700 border-green-200", icon: <CheckCircle size={12} /> },
  occupied: { label: "Occupied", color: "bg-red-100 text-red-700 border-red-200", icon: <AlertCircle size={12} /> },
  maintenance: { label: "Maintenance", color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: <Wrench size={12} /> },
};

const typeIcon: Record<string, React.ReactNode> = {
  karaoke: <Mic2 size={18} className="text-red-700" />,
  billiards: <Circle size={18} className="text-gray-700" />,
  dining: <Layers size={18} className="text-orange-700" />,
};

const defaultForm = {
  type: "karaoke",
  name: "",
  category: "standard",
  hourly_rate: 400,
  capacity: 8,
  status: "available" as "available" | "occupied" | "maintenance",
  description: "",
};

export default function AdminServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const supabase = createClient();

  const fetchServices = async () => {
    const { data } = await supabase.from("services").select("*").order("type");
    if (data) setServices(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchServices();
    const channel = supabase
      .channel("services-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "services" }, fetchServices)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm(defaultForm);
    setShowModal(true);
  };

  const openEdit = (s: Service) => {
    setEditing(s);
    setForm({
      type: s.type,
      name: s.name,
      category: s.category,
      hourly_rate: s.hourly_rate,
      capacity: s.capacity,
      status: s.status,
      description: s.description ?? "",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    setSaving(true);
    let error;
    if (editing) {
      ({ error } = await supabase.from("services").update(form).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("services").insert([form]));
    }
    setSaving(false);
    if (error) {
      toast.error("Failed to save service");
    } else {
      toast.success(editing ? "Service updated!" : "Service added!");
      setShowModal(false);
      fetchServices();
    }
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("services").update({ status }).eq("id", id);
    fetchServices();
  };

  const filtered = typeFilter === "all" ? services : services.filter((s) => s.type === typeFilter);
  const grouped = {
    karaoke: filtered.filter((s) => s.type === "karaoke"),
    billiards: filtered.filter((s) => s.type === "billiards"),
    dining: filtered.filter((s) => s.type === "dining"),
  };

  return (
    <div className="space-y-5">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Services</h1>
          <p className="text-sm text-gray-400">Manage rooms, tables and their status</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-red-900 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-800 transition-colors"
        >
          <Plus size={16} />
          Add Service
        </button>
      </div>

      {/* Type Filter */}
      <div className="flex gap-2 flex-wrap">
        {["all", "karaoke", "billiards", "dining"].map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold capitalize transition-colors ${
              typeFilter === t ? "bg-red-900 text-white" : "bg-white border border-gray-200 text-gray-500 hover:border-red-200"
            }`}
          >
            {t !== "all" && typeIcon[t]}
            {t}
          </button>
        ))}
      </div>

      {/* Service Groups */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map((i) => (
            <div key={i} className="h-36 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {(["karaoke", "billiards", "dining"] as const).map((type) => {
            const group = grouped[type];
            if (!group.length) return null;
            return (
              <div key={type}>
                <div className="flex items-center gap-2 mb-3">
                  {typeIcon[type]}
                  <h2 className="text-sm font-bold text-gray-700 capitalize">{type} Rooms & Tables</h2>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{group.length}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.map((s) => {
                    const sc = statusConfig[s.status];
                    return (
                      <div
                        key={s.id}
                        className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow group"
                      >
                        {/* Status + Category */}
                        <div className="flex items-start justify-between mb-3">
                          <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${sc.color}`}>
                            {sc.icon}{sc.label}
                          </span>
                          <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full capitalize">{s.category}</span>
                        </div>

                        {/* Name */}
                        <h3 className="font-bold text-gray-800 text-sm mb-1">{s.name}</h3>
                        {s.description && (
                          <p className="text-[11px] text-gray-400 leading-relaxed mb-3 line-clamp-2">{s.description}</p>
                        )}

                        {/* Details */}
                        <div className="grid grid-cols-2 gap-2 mb-4">
                          <div className="bg-gray-50 rounded-lg p-2">
                            <p className="text-[10px] text-gray-400 flex items-center gap-1 mb-0.5">
                              <PhilippinePeso size={10} />Rate/hr
                            </p>
                            <p className="text-sm font-bold text-gray-700">₱{s.hourly_rate.toLocaleString()}</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-2">
                            <p className="text-[10px] text-gray-400 flex items-center gap-1 mb-0.5">
                              <Users size={10} />Capacity
                            </p>
                            <p className="text-sm font-bold text-gray-700">{s.capacity} pax</p>
                          </div>
                        </div>

                        {/* Status Buttons */}
                        <div className="flex gap-1.5 mb-3">
                          {(["available", "occupied", "maintenance"] as const).map((st) => (
                            <button
                              key={st}
                              onClick={() => updateStatus(s.id, st)}
                              disabled={s.status === st}
                              className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold capitalize transition-colors ${
                                s.status === st
                                  ? "bg-gray-800 text-white"
                                  : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                              }`}
                            >
                              {st}
                            </button>
                          ))}
                        </div>

                        {/* Edit Button */}
                        <button
                          onClick={() => openEdit(s)}
                          className="w-full flex items-center justify-center gap-2 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-500 hover:border-red-300 hover:text-red-700 transition-colors"
                        >
                          <Edit2 size={12} />
                          Edit Details
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">{editing ? "Edit Service" : "Add New Service"}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-300"
                  >
                    {["karaoke", "billiards", "dining"].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-300"
                  >
                    {["vip", "standard", "regular"].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. VIP Karaoke Suite A"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Hourly Rate (₱)</label>
                  <input
                    type="number"
                    value={form.hourly_rate}
                    onChange={(e) => setForm({ ...form, hourly_rate: Number(e.target.value) })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Capacity</label>
                  <input
                    type="number"
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Status</label>
                <div className="flex gap-2">
                  {(["available", "occupied", "maintenance"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setForm({ ...form, status: st })}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold capitalize transition-colors ${
                        form.status === st ? "bg-red-900 text-white" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  placeholder="Optional description…"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-300 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 border border-gray-200 text-gray-500 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-red-900 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-red-800 transition-colors disabled:opacity-60"
              >
                {saving ? "Saving…" : editing ? "Save Changes" : "Add Service"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
