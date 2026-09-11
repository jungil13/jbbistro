"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  X,
  Plus,
  Minus,
  Search,
  ShoppingCart,
  DollarSign,
  Utensils,
  Layers,
  Printer,
  CheckCircle2,
  Receipt,
  CreditCard,
  Banknote,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import { createWalkInSaleAction } from "@/app/actions/reservation";
import { getMenuImages } from "@/app/actions/menu";
import Link from "next/link";

interface RecordWalkInModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function RecordWalkInModal({ onClose, onSuccess }: RecordWalkInModalProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [completedId, setCompletedId] = useState<string | null>(null);
  const [completedCode, setCompletedCode] = useState<string | null>(null);

  // Form states
  const [customerName, setCustomerName] = useState("Walk-in Guest");
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [serviceFee, setServiceFee] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "gcash">("cash");
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [gcashRef, setGcashRef] = useState("");

  // Data
  const [services, setServices] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [filteredMenu, setFilteredMenu] = useState<any[]>([]);
  const [menuSearch, setMenuSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Cart: menuItemId -> quantity
  const [cart, setCart] = useState<Record<string, number>>({});

  // Left panel active tab
  const [activeTab, setActiveTab] = useState<"service" | "menu">("service");

  useEffect(() => {
    async function loadData() {
      try {
        const [servicesRes, menuRes, imagesMap] = await Promise.all([
          supabase.from("services").select("*").order("name"),
          supabase.from("menu_items").select("*").eq("available", true).order("sort_order"),
          getMenuImages(),
        ]);

        if (servicesRes.data) {
          setServices(servicesRes.data);
        }

        if (menuRes.data) {
          const merged = menuRes.data.map((m: any) => ({
            ...m,
            image_url: m.image_url || imagesMap[m.id] || "",
          }));
          setMenuItems(merged);
          setFilteredMenu(merged);
        }
      } catch (err) {
        console.error("Error loading walk-in modal data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Filter menu
  useEffect(() => {
    let result = menuItems;
    if (selectedCategory !== "All") {
      result = result.filter((m) => m.category === selectedCategory);
    }
    if (menuSearch) {
      const q = menuSearch.toLowerCase();
      result = result.filter(
        (m) => m.name.toLowerCase().includes(q) || (m.category && m.category.toLowerCase().includes(q))
      );
    }
    setFilteredMenu(result);
  }, [menuItems, selectedCategory, menuSearch]);

  const categories = ["All", ...Array.from(new Set(menuItems.map((m) => m.category || "Other")))];

  // Cart operations
  const updateQty = (id: string, delta: number) => {
    setCart((prev) => {
      const current = prev[id] || 0;
      const next = current + delta;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return { ...prev, [id]: next };
    });
  };

  // Service change handler
  const handleServiceChange = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    const svc = services.find((s) => s.id === serviceId);
    if (svc && svc.hourly_rate) {
      setServiceFee(Number(svc.hourly_rate));
    } else {
      setServiceFee(0);
    }
  };

  // Calculations
  const menuSubtotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const item = menuItems.find((m) => m.id === id);
    return sum + (item ? Number(item.price) * qty : 0);
  }, 0);

  const grandTotal = menuSubtotal + serviceFee;
  const changeDue = Math.max(0, cashTendered - grandTotal);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (grandTotal <= 0 && !selectedServiceId) {
      toast.error("Please add at least one menu item or select a service.");
      return;
    }

    if (paymentMethod === "cash" && cashTendered > 0 && cashTendered < grandTotal) {
      toast.error(`Cash tendered (₱${cashTendered.toLocaleString()}) is less than the total amount (₱${grandTotal.toLocaleString()}).`);
      return;
    }

    setSubmitting(true);

    const itemsPayload = Object.entries(cart).map(([id, qty]) => {
      const item = menuItems.find((m) => m.id === id);
      return {
        menu_item_id: id,
        quantity: qty,
        price: Number(item?.price || 0),
      };
    });

    const res = await createWalkInSaleAction({
      customer_name: customerName.trim() || "Walk-in Guest",
      customer_phone: customerPhone.trim(),
      service_id: selectedServiceId || null,
      total_amount: grandTotal,
      notes: notes.trim(),
      payment_method: paymentMethod,
      payment_reference: paymentMethod === "cash" ? `CASH-TENDERED-${cashTendered || grandTotal}` : gcashRef,
      items: itemsPayload,
    });

    setSubmitting(false);

    if (res.success && res.reservationId) {
      toast.success("Walk-in sale recorded successfully!");
      setCompletedId(res.reservationId);
      setCompletedCode(res.reservationCode || "");
      onSuccess();
    } else {
      toast.error("Failed to record walk-in sale: " + (res.error || "Unknown error"));
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col border border-gray-100 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#3d0a14] via-[#5c1020] to-[#3d0a14] text-white px-6 py-4 flex items-center justify-between shadow-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#c9a84c]/20 border border-[#c9a84c]/40 flex items-center justify-center text-[#c9a84c]">
              <Banknote size={20} />
            </div>
            <div>
              <h2 className="font-bold text-base sm:text-lg flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
                Record Walk-In Customer Sale
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#c9a84c] text-[#3d0a14]">
                  POS Sale
                </span>
              </h2>
              <p className="text-xs text-white/70">Ring up walk-in food, drinks, or service orders directly into revenue</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Success Confirmation View */}
        {completedId ? (
          <div className="p-8 sm:p-12 text-center space-y-5 my-auto">
            <div className="w-16 h-16 rounded-full bg-green-50 border-2 border-green-200 text-green-600 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 size={36} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Sale Recorded Successfully!</h3>
              <p className="text-xs text-gray-500 mt-1">
                Order code: <strong className="text-red-950 font-mono text-sm">{completedCode}</strong> • Total: <strong className="text-gray-900">₱{grandTotal.toLocaleString()}</strong>
              </p>
              {paymentMethod === "cash" && cashTendered > 0 && (
                <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-xl inline-block text-xs">
                  <span>Tendered: ₱{cashTendered.toLocaleString()}</span> •{" "}
                  <span className="font-bold text-green-700">Change Due: ₱{changeDue.toLocaleString()}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-center max-w-sm mx-auto pt-4">
              <Link
                href={`/receipt/${completedId}`}
                target="_blank"
                className="flex-1 flex items-center justify-center gap-2 bg-[#3d0a14] hover:bg-[#5c1020] text-white py-3 rounded-xl text-xs font-bold transition-all shadow-md"
              >
                <Printer size={15} />
                View & Print Receipt
              </Link>
              <button
                onClick={onClose}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl text-xs font-bold transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Form View */
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Left: Service + Menu Picker */}
            <div className="flex-1 p-5 border-b md:border-b-0 md:border-r border-gray-100 flex flex-col overflow-hidden">

              {/* Tab switcher */}
              <div className="flex items-center bg-gray-100 rounded-xl p-1 mb-4 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab("service")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === "service"
                      ? "bg-[#3d0a14] text-white shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Layers size={13} />
                  Select Service
                  {selectedServiceId && (
                    <span className="w-4 h-4 rounded-full bg-[#c9a84c] text-[#3d0a14] flex items-center justify-center text-[9px] font-extrabold ml-0.5">✓</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("menu")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === "menu"
                      ? "bg-[#3d0a14] text-white shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Utensils size={13} />
                  Food &amp; Drinks
                  {Object.values(cart).some(q => q > 0) && (
                    <span className="w-4 h-4 rounded-full bg-[#c9a84c] text-[#3d0a14] flex items-center justify-center text-[9px] font-extrabold ml-0.5">
                      {Object.values(cart).reduce((a, b) => a + b, 0)}
                    </span>
                  )}
                </button>
              </div>

              {/* SERVICE TAB */}
              {activeTab === "service" && (
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {/* No service option */}
                  <div
                    onClick={() => handleServiceChange("")}
                    className={`cursor-pointer p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                      !selectedServiceId
                        ? "border-[#c9a84c] bg-amber-50/60 shadow-sm"
                        : "border-gray-100 bg-white hover:border-gray-200"
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${!selectedServiceId ? "bg-[#c9a84c]/20 text-[#3d0a14]" : "bg-gray-100 text-gray-400"}`}>
                      <DollarSign size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-800">Counter / Food Only</p>
                      <p className="text-[11px] text-gray-400">No room or service fee added</p>
                    </div>
                    {!selectedServiceId && (
                      <CheckCircle2 size={16} className="text-[#c9a84c] flex-shrink-0" />
                    )}
                  </div>

                  {loading ? (
                    <div className="p-8 text-center text-gray-400 text-xs flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin" /> Loading services...
                    </div>
                  ) : (
                    services.map((svc) => {
                      const isSelected = selectedServiceId === svc.id;
                      return (
                        <div
                          key={svc.id}
                          onClick={() => handleServiceChange(svc.id)}
                          className={`cursor-pointer p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                            isSelected
                              ? "border-[#c9a84c] bg-amber-50/60 shadow-sm"
                              : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm"
                          }`}
                        >
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isSelected ? "bg-[#3d0a14] text-[#c9a84c]" : "bg-gray-100 text-gray-500"}`}>
                            <Layers size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-xs font-bold text-gray-800 truncate">{svc.name}</p>
                              {svc.type && (
                                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 capitalize">
                                  {svc.type}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              {svc.capacity && (
                                <span className="text-[11px] text-gray-400">Up to {svc.capacity} pax</span>
                              )}
                              <span className="text-[11px] font-extrabold text-[#3d0a14]">
                                ₱{Number(svc.hourly_rate || 0).toLocaleString()}/hr
                              </span>
                            </div>
                          </div>
                          {isSelected && (
                            <CheckCircle2 size={16} className="text-[#c9a84c] flex-shrink-0" />
                          )}
                        </div>
                      );
                    })
                  )}

                  <p className="text-[10px] text-gray-400 text-center pt-2">
                    Select a service/room to include its fee in the bill, or keep "Counter / Food Only".
                  </p>
                </div>
              )}

              {/* MENU TAB */}
              {activeTab === "menu" && (
                <>
                  <div className="flex items-center justify-between mb-3 flex-shrink-0">
                    <span className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Utensils size={14} className="text-[#3d0a14]" /> Food &amp; Drinks
                    </span>
                    <span className="text-[11px] text-gray-400 font-medium">
                      {Object.values(cart).reduce((a, b) => a + b, 0)} items in cart
                    </span>
                  </div>

                  {/* Search & Category Pills */}
                  <div className="space-y-2 mb-3 flex-shrink-0">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search menu items..."
                        value={menuSearch}
                        onChange={(e) => setMenuSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-red-300"
                      />
                    </div>

                    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors ${
                            selectedCategory === cat
                              ? "bg-[#3d0a14] text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[200px]">
                    {loading ? (
                      <div className="p-8 text-center text-gray-400 text-xs flex items-center justify-center gap-2">
                        <Loader2 size={16} className="animate-spin" /> Loading menu items...
                      </div>
                    ) : filteredMenu.length === 0 ? (
                      <div className="p-8 text-center text-gray-400 text-xs">No items match your filter.</div>
                    ) : (
                      filteredMenu.map((item) => {
                        const qty = cart[item.id] || 0;
                        return (
                          <div
                            key={item.id}
                            className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                              qty > 0
                                ? "border-[#c9a84c] bg-amber-50/40 shadow-sm"
                                : "border-gray-100 hover:border-gray-200 bg-white"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                                {item.image_url ? (
                                  <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                                ) : (
                                  <Utensils size={14} className="text-gray-400" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-gray-800 truncate">{item.name}</p>
                                <span className="text-xs font-extrabold text-[#3d0a14]">₱{Number(item.price).toLocaleString()}</span>
                              </div>
                            </div>

                            {/* Quantity selector */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {qty > 0 ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => updateQty(item.id, -1)}
                                    className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center font-bold"
                                  >
                                    <Minus size={12} />
                                  </button>
                                  <span className="w-6 text-center text-xs font-extrabold text-[#3d0a14]">{qty}</span>
                                  <button
                                    type="button"
                                    onClick={() => updateQty(item.id, 1)}
                                    className="w-7 h-7 rounded-lg bg-[#3d0a14] hover:bg-[#5c1020] text-white flex items-center justify-center font-bold shadow-sm"
                                  >
                                    <Plus size={12} />
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => updateQty(item.id, 1)}
                                  className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-[#3d0a14] hover:text-white text-gray-700 text-xs font-semibold transition-colors flex items-center gap-1"
                                >
                                  <Plus size={12} /> Add
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>


            {/* Right: Customer & Checkout Info */}
            <div className="w-full md:w-96 p-5 flex flex-col justify-between bg-gray-50/50 overflow-y-auto">
              <div className="space-y-4">
                {/* Customer Details */}
                <div>
                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-2">Customer & Service</h3>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">Customer Name</label>
                      <input
                        type="text"
                        required
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="e.g. Walk-in Guest / Mark"
                        className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none focus:border-red-300"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">Phone (Optional)</label>
                      <input
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="09XX XXX XXXX"
                        className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none focus:border-red-300"
                      />
                    </div>

                    {/* Selected Service Summary */}
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">Selected Service</label>
                      <div
                        onClick={() => setActiveTab("service")}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white cursor-pointer hover:border-[#c9a84c] transition-colors flex items-center justify-between gap-2"
                      >
                        {selectedServiceId ? (
                          <>
                            <span className="font-bold text-[#3d0a14] truncate">
                              {services.find(s => s.id === selectedServiceId)?.name ?? "Selected"}
                            </span>
                            <span className="text-[#c9a84c] font-bold flex-shrink-0">₱{serviceFee.toLocaleString()}</span>
                          </>
                        ) : (
                          <span className="text-gray-400">Counter / Food Only — tap to change</span>
                        )}
                        <Layers size={12} className="text-gray-400 flex-shrink-0" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">Notes (Optional)</label>
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="e.g. Table 3, Extra Ice"
                        className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none focus:border-red-300"
                      />
                    </div>
                  </div>
                </div>

                {/* Payment Method */}
                <div>
                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-2">Payment Method</h3>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("cash")}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                        paymentMethod === "cash"
                          ? "bg-[#3d0a14] text-white border-[#3d0a14] shadow-sm"
                          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <Banknote size={15} /> Cash
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("gcash")}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                        paymentMethod === "gcash"
                          ? "bg-[#3d0a14] text-white border-[#3d0a14] shadow-sm"
                          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <CreditCard size={15} /> GCash
                    </button>
                  </div>

                  {paymentMethod === "cash" ? (
                    <div className="space-y-1 bg-white p-2.5 rounded-xl border border-gray-100">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-gray-600">Cash Tendered (₱)</label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={cashTendered || ""}
                          onChange={(e) => setCashTendered(parseFloat(e.target.value) || 0)}
                          placeholder={grandTotal.toString()}
                          className="w-24 text-right px-2 py-1 border border-gray-200 rounded-lg text-xs font-bold focus:outline-none focus:border-red-300"
                        />
                      </div>
                      {cashTendered > 0 && (
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-100 font-bold">
                          <span className="text-gray-500">Change Due:</span>
                          <span className={changeDue >= 0 ? "text-green-700" : "text-red-600"}>
                            ₱{changeDue.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <input
                        type="text"
                        value={gcashRef}
                        onChange={(e) => setGcashRef(e.target.value)}
                        placeholder="GCash Reference Number"
                        className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none focus:border-red-300"
                      />
                    </div>
                  )}
                </div>

                {/* Bill Summary */}
                <div className="p-3 bg-white rounded-2xl border border-gray-200 space-y-1 text-xs">
                  <div className="flex justify-between text-gray-500">
                    <span>Menu Items ({Object.values(cart).reduce((a, b) => a + b, 0)}):</span>
                    <span>₱{menuSubtotal.toLocaleString()}</span>
                  </div>
                  {serviceFee > 0 && (
                    <div className="flex justify-between text-gray-500">
                      <span>Service / Hourly Rate:</span>
                      <span>₱{serviceFee.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-extrabold text-[#3d0a14] pt-2 border-t border-gray-100">
                    <span>Total Revenue:</span>
                    <span>₱{grandTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Submit / Action */}
              <div className="pt-4 border-t border-gray-200 mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-[#3d0a14] hover:bg-[#5c1020] text-white py-3 rounded-xl text-xs font-bold transition-all shadow-md disabled:opacity-60 flex items-center justify-center gap-1.5"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Recording...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={15} /> Complete Sale
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
