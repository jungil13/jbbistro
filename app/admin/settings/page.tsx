"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Save, Store, Settings2, CreditCard, Bot, BellRing, Mail, Send, CheckCircle2 } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { sendTestEmailAction } from "@/app/actions/reservationEmail";

interface SettingsState {
  business_name: string;
  open_time: string;
  close_time: string;
  auto_approve: string;
  ai_enabled: string;
  realtime_notifications: string;
  gcash_number: string;
  gcash_qr_url: string;
  chatbot_name: string;
  chatbot_greeting: string;
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<SettingsState>({
    business_name: "",
    open_time: "",
    close_time: "",
    auto_approve: "false",
    ai_enabled: "true",
    realtime_notifications: "true",
    gcash_number: "",
    gcash_qr_url: "",
    chatbot_name: "",
    chatbot_greeting: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingQR, setUploadingQR] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from("settings").select("*");
      if (data) {
        const s: any = {};
        data.forEach((row) => { s[row.key] = row.value; });
        setSettings((prev) => ({ ...prev, ...s }));
      }
      setLoading(false);
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const updates = Object.entries(settings).map(([key, value]) => ({ key, value: value ?? "" }));
    const { error } = await supabase.from("settings").upsert(updates);
    setSaving(false);
    if (error) toast.error("Failed to save settings");
    else toast.success("Settings saved successfully!");
  };

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingQR(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `gcash-qr/qr_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("uploads").upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("uploads").getPublicUrl(filePath);
      setSettings((prev) => ({ ...prev, gcash_qr_url: publicUrl }));
      toast.success("QR image uploaded!");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingQR(false);
    }
  };

  const tabs = [
    { id: "general", label: "General", icon: <Store size={16} /> },
    { id: "automation", label: "Automation", icon: <Settings2 size={16} /> },
    { id: "payment", label: "Payment & GCash", icon: <CreditCard size={16} /> },
    { id: "ai", label: "AI Chatbot", icon: <Bot size={16} /> },
    { id: "notifications", label: "Notifications", icon: <BellRing size={16} /> },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <Toaster position="top-right" />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">System Settings</h1>
          <p className="text-sm text-gray-400">Configure global application behavior</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="flex items-center gap-2 bg-red-900 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-800 transition-colors disabled:opacity-60 shadow-lg shadow-red-900/20"
        >
          {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={16} />}
          Save Changes
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Tabs Sidebar */}
        <div className="w-full md:w-64 bg-white border border-gray-100 rounded-2xl p-2 shadow-sm flex-shrink-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                activeTab === t.id ? "bg-red-50 text-red-900" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden w-full">
          {loading ? (
            <div className="p-8 space-y-4">
              <div className="h-4 bg-gray-100 rounded w-1/4 animate-pulse" />
              <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
              <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
            </div>
          ) : (
            <div className="p-6 sm:p-8">
              
              {/* General Settings */}
              {activeTab === "general" && (
                <div className="space-y-6 max-w-lg">
                  <div>
                    <h2 className="text-base font-bold text-gray-800 mb-1">Business Identity</h2>
                    <p className="text-xs text-gray-400 mb-4">Displayed on emails and receipts</p>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Business Name</label>
                    <input type="text" value={settings.business_name} onChange={e => setSettings({...settings, business_name: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-300" />
                  </div>
                  <div className="border-t border-gray-100 pt-6">
                    <h2 className="text-base font-bold text-gray-800 mb-1">Operating Hours</h2>
                    <p className="text-xs text-gray-400 mb-4">Used to limit reservation slots</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Opening Time</label>
                        <input type="time" value={settings.open_time} onChange={e => setSettings({...settings, open_time: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-300" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Closing Time</label>
                        <input type="time" value={settings.close_time} onChange={e => setSettings({...settings, close_time: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-300" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Automation */}
              {activeTab === "automation" && (
                <div className="space-y-6 max-w-lg">
                  <div>
                    <h2 className="text-base font-bold text-gray-800 mb-1">Workflow Automation</h2>
                    <p className="text-xs text-gray-400 mb-6">Automate routine tasks</p>
                    
                    <label className="flex items-start gap-4 p-4 border border-gray-200 rounded-xl cursor-pointer hover:border-red-300 transition-colors mb-4">
                      <div className="flex-1">
                        <p className="text-sm font-bold text-gray-800">Auto-Approve Reservations</p>
                        <p className="text-xs text-gray-500 mt-1">Automatically confirm reservations if slot is available (skips pending state).</p>
                      </div>
                      <div className="relative inline-flex items-center h-6 rounded-full w-11 transition-colors">
                        <input type="checkbox" checked={settings.auto_approve === "true"} onChange={e => setSettings({...settings, auto_approve: e.target.checked ? "true" : "false"})} className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-900"></div>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* Payment */}
              {activeTab === "payment" && (
                <div className="space-y-6 max-w-lg">
                  <div>
                    <h2 className="text-base font-bold text-gray-800 mb-1">GCash Integration</h2>
                    <p className="text-xs text-gray-400 mb-6">Payment details shown to customers during booking</p>
                    
                    <div className="mb-5">
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">GCash Mobile Number</label>
                      <input type="text" placeholder="09XX XXX XXXX" value={settings.gcash_number} onChange={e => setSettings({...settings, gcash_number: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-300 font-mono" />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">GCash QR Code Image</label>
                      
                      {/* File upload button */}
                      <label className={`flex items-center gap-3 w-full border-2 border-dashed rounded-xl px-4 py-3 cursor-pointer transition-colors ${
                        uploadingQR ? "border-gray-200 bg-gray-50" : "border-gray-200 hover:border-red-300 hover:bg-red-50/30"
                      }`}>
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          disabled={uploadingQR}
                          onChange={handleQrUpload}
                        />
                        {uploadingQR ? (
                          <>
                            <div className="w-4 h-4 border-2 border-red-300 border-t-red-700 rounded-full animate-spin flex-shrink-0" />
                            <span className="text-xs text-gray-500">Uploading…</span>
                          </>
                        ) : (
                          <>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" className="text-gray-400 flex-shrink-0">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                              <polyline points="17 8 12 3 7 8"/>
                              <line x1="12" y1="3" x2="12" y2="15"/>
                            </svg>
                            <div>
                              <p className="text-xs font-semibold text-gray-700">
                                {settings.gcash_qr_url ? "Replace QR Image" : "Upload QR Image"}
                              </p>
                              <p className="text-[10px] text-gray-400">PNG, JPG, WEBP supported</p>
                            </div>
                          </>
                        )}
                      </label>

                      {/* Preview */}
                      {settings.gcash_qr_url && (
                        <div className="mt-3 border border-gray-200 rounded-xl p-4 bg-gray-50 flex flex-col items-center gap-2">
                          <img src={settings.gcash_qr_url} alt="GCash QR Preview" className="max-w-[180px] h-auto object-contain rounded-lg shadow-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          <button
                            type="button"
                            onClick={() => setSettings((prev) => ({ ...prev, gcash_qr_url: "" }))}
                            className="text-[10px] text-red-400 hover:text-red-600 font-medium"
                          >
                            Remove image
                          </button>
                        </div>
                      )}
                      <p className="text-[10px] text-gray-400 mt-2">Customers will scan this QR to pay via GCash.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* AI Chatbot */}
              {activeTab === "ai" && (
                <div className="space-y-6 max-w-lg">
                  <div>
                    <h2 className="text-base font-bold text-gray-800 mb-1">Chatbot Configuration</h2>
                    <p className="text-xs text-gray-400 mb-6">Manage the floating assistant on public pages</p>
                    
                    <label className="flex items-center justify-between p-4 border border-gray-200 rounded-xl cursor-pointer hover:border-red-300 transition-colors mb-6">
                      <div>
                        <p className="text-sm font-bold text-gray-800">Enable AI Widget</p>
                        <p className="text-xs text-gray-500">Show the chatbot button on the website</p>
                      </div>
                      <div className="relative inline-flex items-center h-6 rounded-full w-11 transition-colors">
                        <input type="checkbox" checked={settings.ai_enabled === "true"} onChange={e => setSettings({...settings, ai_enabled: e.target.checked ? "true" : "false"})} className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-900"></div>
                      </div>
                    </label>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Chatbot Name</label>
                        <input type="text" value={settings.chatbot_name} onChange={e => setSettings({...settings, chatbot_name: e.target.value})} placeholder="e.g. JB Assistant" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-300" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Greeting Message</label>
                        <textarea value={settings.chatbot_greeting} onChange={e => setSettings({...settings, chatbot_greeting: e.target.value})} rows={3} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-300 resize-none" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Notifications */}
              {activeTab === "notifications" && (
                <div className="space-y-6 max-w-lg">
                  <div>
                    <h2 className="text-base font-bold text-gray-800 mb-1">System Alerts</h2>
                    <p className="text-xs text-gray-400 mb-6">Manage how you receive updates</p>
                    
                    <label className="flex items-start gap-4 p-4 border border-gray-200 rounded-xl cursor-pointer hover:border-red-300 transition-colors">
                      <div className="flex-1">
                        <p className="text-sm font-bold text-gray-800">In-App Toast Notifications</p>
                        <p className="text-xs text-gray-500 mt-1">Show floating popup alerts when new reservations or payments arrive.</p>
                      </div>
                      <div className="relative inline-flex items-center h-6 rounded-full w-11 transition-colors">
                        <input type="checkbox" checked={settings.realtime_notifications === "true"} onChange={e => setSettings({...settings, realtime_notifications: e.target.checked ? "true" : "false"})} className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-900"></div>
                      </div>
                    </label>

                    {/* Email / Gmail SMTP Diagnostics */}
                    <div className="border border-gray-200 rounded-2xl p-5 bg-gradient-to-br from-white to-gray-50/50 space-y-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-red-50 text-red-900 flex items-center justify-center font-bold">
                          <Mail size={16} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-gray-800">Gmail SMTP &amp; Vercel Notifications</h3>
                          <p className="text-[11px] text-gray-400">Booking confirmations &amp; receipts sent to guests</p>
                        </div>
                      </div>

                      <div className="bg-white border border-gray-200 rounded-xl p-3 text-xs space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Sender Account:</span>
                          <span className="font-semibold text-gray-800">bernardrubia@gmail.com</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Status:</span>
                          <span className="text-emerald-700 font-bold flex items-center gap-1">
                            <CheckCircle2 size={12} /> Active (Gmail Cloud Ready)
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-gray-700">
                          Send Test Email (Verify Vercel Delivery)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="email"
                            placeholder="Enter email to test (e.g. your email)"
                            value={testEmailAddress}
                            onChange={(e) => setTestEmailAddress(e.target.value)}
                            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-red-300"
                          />
                          <button
                            type="button"
                            disabled={sendingTestEmail}
                            onClick={async () => {
                              setSendingTestEmail(true);
                              const toastId = toast.loading("Sending test email via Gmail SMTP...");
                              try {
                                const res = await sendTestEmailAction(testEmailAddress || undefined);
                                if (res.success) {
                                  toast.success("Test email sent! Check your inbox.", { id: toastId });
                                } else {
                                  toast.error(res.error || "Failed to send test email", { id: toastId });
                                }
                              } catch (err: any) {
                                toast.error(err.message || "Failed to send test email", { id: toastId });
                              } finally {
                                setSendingTestEmail(false);
                              }
                            }}
                            className="bg-red-900 hover:bg-red-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-60 flex items-center gap-1.5 whitespace-nowrap shadow-sm"
                          >
                            {sendingTestEmail ? (
                              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <Send size={12} />
                            )}
                            <span>Send Test</span>
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-400">
                          Dispatches a real email to verify that your Vercel serverless functions can connect to Gmail.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
