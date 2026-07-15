"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  Utensils,
  Mic2,
  Circle,
  CalendarDays,
  Clock,
  Users,
  CheckCircle2,
  CreditCard,
  Banknote,
  Upload,
  ChevronRight,
  Info,
  Loader2,
  X
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast, { Toaster } from "react-hot-toast";

type PaymentMethod = "cash" | "gcash";
type Step = "form" | "checking" | "slots" | "payment" | "success";

export default function ReservePage() {
  const router = useRouter();
  const supabase = createClient();
  const [settings, setSettings] = useState<any>({});
  const [services, setServices] = useState<any[]>([]);

  // Form states
  const [selectedType, setSelectedType] = useState("dining");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [guests, setGuests] = useState(2);
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [pickedServiceId, setPickedServiceId] = useState<string>("");
  const [reservationId, setReservationId] = useState<string>("");

  // Payment states
  const [payment, setPayment] = useState<PaymentMethod>("gcash");
  const [gcashNumber, setGcashNumber] = useState("");
  const [refNumber, setRefNumber] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState("");
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const todayStr = new Date().toISOString().split("T")[0];

  useEffect(() => {
    const fetchData = async () => {
      const { data: setts } = await supabase.from("settings").select("*");
      if (setts) {
        const s: any = {};
        setts.forEach(r => s[r.key] = r.value);
        setSettings(s);
      }

      const { data: svcs } = await supabase.from("services").select("*").eq("status", "available");
      if (svcs) setServices(svcs);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCustomerId(user.id);
        const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        if (profile) {
          setName(`${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim());
          setEmail(profile.email ?? "");
          setPhone(profile.phone ?? "");
        }
      }
    };
    fetchData();
  }, []);

  const serviceOptions = [
    { id: "dining", label: "Fine Dining", icon: <Utensils size={24} />, desc: "Reserve a table for an elegant meal" },
    { id: "karaoke", label: "Karaoke Room", icon: <Mic2 size={24} />, desc: "Book a private karaoke suite" },
    { id: "billiards", label: "Billiard Table", icon: <Circle size={24} />, desc: "Reserve a premium billiard table" },
  ];
  const selectedServiceType = serviceOptions.find(s => s.id === selectedType);
  const availableSlots = services.filter(s => s.type === selectedType && s.capacity >= guests);
  const pickedService = services.find(s => s.id === pickedServiceId);

  const decGuests = () => setGuests(g => Math.max(1, g - 1));
  const incGuests = () => setGuests(g => Math.min(99, g + 1));

  const handleCheckAvailability = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !name || !email) return;

    setStep("checking");
    setTimeout(() => {
      setStep("slots");
      setTimeout(() => document.getElementById("slots-section")?.scrollIntoView({ behavior: "smooth" }), 100);
    }, 1000);
  };

  const handleSelectSlot = (serviceId: string, slotTime: string) => {
    setPickedServiceId(serviceId);
    setTime(slotTime || "19:00"); 
    setStep("payment");
    setTimeout(() => document.getElementById("payment-section")?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleMakePayment = async () => {
    if (payment === "gcash" && !refNumber) {
      toast.error("Please enter the GCash reference number.");
      return;
    }

    try {
      const newResId = crypto.randomUUID();
      const { error: resError } = await supabase.from("reservations").insert([{
        id: newResId,
        customer_id: customerId,
        customer_name: name,
        customer_email: email,
        customer_phone: phone,
        service_id: pickedServiceId,
        date,
        time_start: time,
        guests,
        status: settings.auto_approve === "true" ? "confirmed" : "pending",
        total_amount: pickedService?.hourly_rate || 0,
      }]);

      if (resError) throw resError;

      await supabase.from("payments").insert([{
        reservation_id: newResId,
        method: payment,
        gcash_number: gcashNumber,
        reference_number: refNumber,
        receipt_url: receiptUrl,
        amount: pickedService?.hourly_rate || 0,
        status: payment === "cash" ? "pending" : "verified"
      }]);

      setReservationId(newResId);
      setStep("success");
    } catch (err: any) {
      toast.error(err.message || "Failed to make reservation");
    }
  };

  const handleCancel = () => {
    setStep("form");
    setPickedServiceId("");
    setRefNumber("");
    setGcashNumber("");
    setReceiptUrl("");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
    const filePath = `receipts/${fileName}`;

    setUploadingReceipt(true);

    try {
      const { error: uploadError } = await supabase.storage
        .from("uploads")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("uploads")
        .getPublicUrl(filePath);

      setReceiptUrl(publicUrl);
    } catch (err: any) {
      toast.error("Failed to upload screenshot: " + err.message);
    } finally {
      setUploadingReceipt(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf8f5]">
      <Navbar />
      <Toaster position="top-right" />

      {/* Hero */}
      <div className="relative pt-[68px] overflow-hidden bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1600&q=80')" }}>
        <div className="absolute inset-0 bg-gradient-to-br from-[rgba(61,10,20,0.93)] via-[rgba(107,16,32,0.85)] to-[rgba(30,5,10,0.95)]" />
        <div className="relative z-10 max-w-4xl mx-auto px-6 py-20 text-center">
          <p className="text-[0.78rem] tracking-[0.2em] uppercase text-gold font-semibold mb-3">Limited Seats Available</p>
          <h1 className="font-playfair text-[clamp(2.2rem,5vw,3.6rem)] font-bold text-white leading-[1.15] mb-4">Make a Reservation</h1>
          <p className="text-white/70 text-sm max-w-[480px] mx-auto leading-[1.8]">Book your table, karaoke suite, or billiard table in minutes.</p>
        </div>
      </div>

      <div className="max-w-[1060px] mx-auto px-5 py-14 space-y-10">
        
        {/* SUCCESS */}
        {step === "success" && (
          <div className="max-w-[520px] mx-auto text-center py-16">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center text-green-600 mx-auto mb-6 shadow-lg">
              <CheckCircle2 size={40} />
            </div>
            <h2 className="font-playfair text-3xl font-bold text-[#3d0a14] mb-3">Reservation Submitted!</h2>
            <p className="text-gray-500 text-base leading-[1.8] mb-4">
              Thank you, <strong>{name}</strong>! Your <strong>{pickedService?.name}</strong> reservation on <strong>{date}</strong> at <strong>{time}</strong> for <strong>{guests}</strong> guest(s) has been received.
            </p>
            {payment === "cash" && settings.auto_approve !== "true" && (
              <p className="text-amber-700 text-sm font-semibold mb-8 bg-amber-50 p-4 rounded-xl border border-amber-200">
                Since you opted for Pay on Arrival (No Downpayment), your reservation is subject to manager confirmation.
              </p>
            )}
            {payment === "gcash" && (
              <p className="text-green-700 text-sm font-semibold mb-8 bg-green-50 p-4 rounded-xl border border-green-200">
                Downpayment received! Please screenshot or print your receipt as proof. {settings.auto_approve !== "true" && "We will confirm shortly."}
              </p>
            )}
            <div className="flex gap-4 justify-center flex-wrap">
              <Link href={`/receipt/${reservationId}`} target="_blank" className="bg-[#3d0a14] text-gold px-8 py-3.5 rounded-xl font-semibold text-sm tracking-wide hover:bg-[#6b1020] transition-all">
                View Receipt
              </Link>
              <button onClick={handleCancel} className="border border-[#3d0a14] text-[#3d0a14] px-8 py-3.5 rounded-xl font-semibold text-sm tracking-wide hover:bg-[#3d0a14] hover:text-white transition-all">Make Another Booking</button>
            </div>
          </div>
        )}

        {step !== "success" && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
            
            {/* LEFT COLUMN */}
            <div className="space-y-6">
              
              {/* STEP 1: Main Form */}
              <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(61,10,20,0.08)] border border-gray-100 overflow-hidden">
                <div className="border-b border-gray-100 px-8 pt-8 pb-0">
                  <p className="text-[0.7rem] font-bold tracking-[0.14em] uppercase text-gray-400 mb-3">Select Service</p>
                  <div className="flex gap-0">
                    {serviceOptions.map((s, i) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => { setSelectedType(s.id); setStep("form"); setPickedServiceId(""); }}
                        className={`flex-1 flex flex-col items-center gap-1.5 py-4 text-sm font-semibold border-b-2 transition-all duration-200 ${selectedType === s.id ? "border-gold text-[#3d0a14]" : "border-transparent text-gray-400 hover:text-gray-600"}`}
                      >
                        <div className={selectedType === s.id ? "text-[#3d0a14]" : "text-gray-400"}>{s.icon}</div>
                        <span className="text-[0.72rem]">{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleCheckAvailability} className="px-8 py-7 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-2">Full Name *</label>
                      <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-[#fafafa] focus:border-gold outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-2">Email *</label>
                      <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-[#fafafa] focus:border-gold outline-none" />
                    </div>
                  </div>

                  {!customerId && (
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-sm text-blue-800">
                      <p>
                        <strong>Guest Checkout:</strong> You are booking as a guest. You can <Link href="/login" className="text-blue-600 font-bold underline hover:text-blue-700">log in or sign up</Link> to easily track and manage your reservations.
                      </p>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Select Date *</label>
                    <div className="relative">
                      <CalendarDays size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input type="date" required min={todayStr} value={date} onChange={e => { setDate(e.target.value); setStep("form"); }} className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl text-sm bg-[#fafafa] focus:border-gold outline-none text-gray-600" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Select Time</label>
                    <div className="relative">
                      <Clock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input type="time" required value={time} onChange={e => { setTime(e.target.value); setStep("form"); }} className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl text-sm bg-[#fafafa] focus:border-gold outline-none text-gray-600" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Number of Guests</label>
                    <div className="flex items-center justify-between">
                      <button type="button" onClick={decGuests} className="w-10 h-10 rounded-xl border-2 border-gold text-gold flex items-center justify-center font-bold text-xl hover:bg-gold hover:text-white transition-colors">−</button>
                      <div className="flex items-center gap-3">
                        <Users size={24} className="text-[#6b1020]" />
                        <span className="font-playfair text-3xl font-bold text-[#3d0a14] min-w-[2rem] text-center">{guests}</span>
                      </div>
                      <button type="button" onClick={incGuests} className="w-10 h-10 rounded-xl border-2 border-gold text-gold flex items-center justify-center font-bold text-xl hover:bg-gold hover:text-white transition-colors">+</button>
                    </div>
                  </div>

                  <button type="submit" disabled={step === "checking"} className="w-full bg-gold text-[#3d0a14] font-bold py-3.5 rounded-xl text-sm hover:bg-[#e2c46a] transition-all shadow-[0_3px_14px_rgba(201,168,76,0.3)] disabled:opacity-60">
                    {step === "checking" ? "Checking Availability..." : "✦ Check Availability"}
                  </button>
                </form>
              </div>

              {/* STEP 2: Available Slots */}
              {(step === "slots" || step === "payment") && (
                <div id="slots-section" className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(61,10,20,0.08)] border border-gray-100 p-8">
                  <h2 className="font-playfair text-xl font-bold text-[#3d0a14] mb-4">Available {selectedServiceType?.label}</h2>
                  {availableSlots.length === 0 ? (
                    <p className="text-gray-500 text-sm">Sorry, no available options for this category and capacity right now.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {availableSlots.map(s => (
                        <div key={s.id} onClick={() => handleSelectSlot(s.id, time)} className={`cursor-pointer rounded-xl p-5 border-2 transition-all ${pickedServiceId === s.id ? "bg-green-50 border-green-400 shadow-md" : "bg-white border-gray-100 hover:border-green-300 hover:shadow-md"}`}>
                          <div className="flex justify-between mb-2">
                            <span className="font-bold text-sm text-gray-800">{s.name}</span>
                            {pickedServiceId === s.id && <CheckCircle2 size={18} className="text-green-500" />}
                          </div>
                          <p className="text-xs text-gray-500 mb-1">Capacity: {s.capacity} pax</p>
                          <p className="text-xs font-bold text-[#6b1020]">₱{s.hourly_rate}/hr</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3: GCash Payment */}
              {step === "payment" && (
                <div id="payment-section" className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(61,10,20,0.08)] border border-gray-100 p-8">
                  <h2 className="font-playfair text-xl font-bold text-[#3d0a14] mb-1">Complete Your Booking</h2>
                  <p className="text-gray-400 text-xs mb-6">Securing reservation for {pickedService?.name}</p>

                  <div className="flex gap-4 mb-6">
                    <button onClick={() => setPayment("gcash")} className={`flex-1 py-3 border-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 ${payment === "gcash" ? "border-blue-500 text-blue-600 bg-blue-50" : "border-gray-200 text-gray-500"}`}>
                      <CreditCard size={18} /> GCash
                    </button>
                    <button onClick={() => setPayment("cash")} className={`flex-1 py-3 border-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 ${payment === "cash" ? "border-green-500 text-green-600 bg-green-50" : "border-gray-200 text-gray-500"}`}>
                      <Banknote size={18} /> Pay on Arrival
                    </button>
                  </div>

                  {payment === "gcash" && (
                    <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-5 mb-6 space-y-4">
                      <div className="flex flex-col sm:flex-row gap-6 items-center">
                        {settings.gcash_qr_url ? (
                          <button
                            type="button"
                            onClick={() => setQrOpen(true)}
                            className="flex-shrink-0 block hover:opacity-90 transition-opacity focus:outline-none"
                            title="Click to view full-size QR code"
                          >
                            <img
                              src={settings.gcash_qr_url}
                              alt="GCash QR"
                              className="w-48 h-48 object-contain rounded-xl shadow-md bg-white border border-blue-100 cursor-zoom-in"
                            />
                            <p className="text-[10px] text-blue-500 text-center mt-1">Tap to enlarge</p>
                          </button>
                        ) : (
                          <div className="w-48 h-48 bg-gray-100 rounded-xl flex items-center justify-center text-xs text-gray-400 text-center px-4 border border-dashed border-gray-300">QR Not Configured</div>
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-bold text-gray-800 mb-1">Scan to Pay via GCash</p>
                          <p className="text-xs text-gray-500 mb-2">Account Name: <strong>{settings.business_name || "JBenz Bistro"}</strong></p>
                          <p className="text-sm font-mono bg-white px-3 py-1.5 rounded border border-gray-200 inline-block">{settings.gcash_number || "09XX XXX XXXX"}</p>
                          <p className="text-[10px] text-blue-600 mt-2 flex items-center gap-1"><Info size={12}/> Required Deposit: ₱{pickedService?.hourly_rate}</p>
                        </div>
                      </div>

                      <div className="border-t border-blue-100 pt-4 space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">GCash Mobile Number</label>
                          <input type="text" value={gcashNumber} onChange={e => setGcashNumber(e.target.value)} placeholder="09XX XXX XXXX" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Reference Number *</label>
                          <input type="text" value={refNumber} onChange={e => setRefNumber(e.target.value)} required placeholder="e.g. 1234567890123" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                        </div>
                        <div>
                          {receiptUrl ? (
                            <div className="relative inline-block w-full text-center">
                              <img src={receiptUrl} alt="Receipt Screenshot" className="max-h-48 rounded-lg shadow-sm mx-auto object-contain border border-gray-200" />
                              <button
                                type="button"
                                onClick={() => setReceiptUrl("")}
                                className="absolute -top-2 -right-2 bg-white text-red-500 rounded-full p-1 shadow-md hover:bg-red-50 transition-colors"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ) : (
                            <div 
                              onClick={() => fileInputRef.current?.click()}
                              className="p-4 border border-dashed border-gray-300 rounded-lg text-center bg-white cursor-pointer hover:bg-gray-50 transition-colors flex flex-col items-center justify-center min-h-[100px]"
                            >
                              {uploadingReceipt ? (
                                <>
                                  <Loader2 size={20} className="text-gray-400 mb-2 animate-spin" />
                                  <p className="text-xs font-semibold text-gray-500">Uploading...</p>
                                </>
                              ) : (
                                <>
                                  <Upload size={20} className="text-gray-400 mb-2" />
                                  <p className="text-xs font-semibold text-blue-600">Upload Screenshot (Optional)</p>
                                </>
                              )}
                            </div>
                          )}
                          <input 
                            type="file" 
                            ref={fileInputRef} 
                            accept="image/*" 
                            className="hidden" 
                            onChange={handleFileUpload}
                            disabled={uploadingReceipt}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button onClick={handleMakePayment} className="flex-1 bg-[#3d0a14] text-white font-bold py-3.5 rounded-xl text-sm shadow-[0_3px_14px_rgba(61,10,20,0.25)] hover:bg-[#6b1020]">
                      {payment === "gcash" ? "Confirm Payment" : "Confirm Reservation"}
                    </button>
                    <button onClick={handleCancel} className="px-6 border-2 border-gray-200 text-gray-400 font-semibold rounded-xl text-sm hover:border-red-300 hover:text-red-400">Cancel</button>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT SIDEBAR - Order Summary */}
            <div className="space-y-5">
              <div className="bg-[#3d0a14] rounded-2xl p-6 text-white sticky top-24">
                <h3 className="font-playfair text-lg font-bold mb-4">Booking Summary</h3>
                
                <div className="flex items-center gap-2 mb-6">
                  {["form", "slots", "payment"].map((s, i) => {
                    const active = ["form", "slots", "payment", "success"].indexOf(step) >= i;
                    return (
                      <div key={s} className="flex items-center gap-2 flex-1">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${active ? "bg-gold text-[#3d0a14]" : "bg-white/10 text-white/40"}`}>{i + 1}</div>
                        {i < 2 && <div className={`flex-1 h-0.5 ${["form", "slots", "payment", "success"].indexOf(step) > i ? "bg-gold" : "bg-white/10"}`} />}
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center border-b border-white/10 pb-2.5">
                    <span className="text-white/60 flex items-center gap-2">Category</span>
                    <span className="font-semibold text-gold capitalize">{selectedType}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/10 pb-2.5">
                    <span className="text-white/60">Service</span>
                    <span className="font-semibold">{pickedService?.name || "—"}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/10 pb-2.5">
                    <span className="text-white/60">Date</span>
                    <span className="font-semibold">{date || "—"}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/10 pb-2.5">
                    <span className="text-white/60">Time</span>
                    <span className="font-semibold">{time || "—"}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/10 pb-2.5">
                    <span className="text-white/60">Guests</span>
                    <span className="font-semibold">{guests}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-white/80 font-bold">Total Rate</span>
                    <span className="font-bold text-gold text-lg">₱{pickedService?.hourly_rate || 0}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
      <Footer />

      {/* ── QR Code Lightbox ── */}
      {qrOpen && settings.gcash_qr_url && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          onClick={() => setQrOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          {/* Dialog */}
          <div
            className="relative bg-white rounded-2xl shadow-2xl p-6 flex flex-col items-center gap-4 max-w-xs w-full animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setQrOpen(false)}
              className="absolute top-3 right-3 w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-500 transition-colors"
              aria-label="Close"
            >
              ✕
            </button>

            <p className="text-sm font-bold text-gray-800 text-center">Scan to Pay via GCash</p>
            <img
              src={settings.gcash_qr_url}
              alt="GCash QR Full Size"
              className="w-full max-w-[260px] h-auto object-contain rounded-xl border border-blue-100 shadow-sm bg-white"
            />
            <div className="text-center space-y-1">
              <p className="text-xs text-gray-500">GCash Number</p>
              <p className="text-sm font-mono font-bold text-gray-800">{settings.gcash_number || "09XX XXX XXXX"}</p>
              <p className="text-xs text-gray-400">Account: {settings.business_name || "JBenz Bistro"}</p>
            </div>
            <button
              onClick={() => setQrOpen(false)}
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
