"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Save, Store, Settings2, CreditCard, Bot, BellRing } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

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
  const [activeTab, setActiveTab] = useState("general");
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
    const updates = Object.entries(settings).map(([key, value]) => ({ key, value }));
    const { error } = await supabase.from("settings").upsert(updates);
    setSaving(false);
    if (error) toast.error("Failed to save settings");
    else toast.success("Settings saved successfully!");
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
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">QR Code Image URL</label>
                      <input type="text" placeholder="https://..." value={settings.gcash_qr_url} onChange={e => setSettings({...settings, gcash_qr_url: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-300 mb-3" />
                      
                      {settings.gcash_qr_url && (
                        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 flex justify-center">
                          <img src={settings.gcash_qr_url} alt="GCash QR Preview" className="max-w-[200px] h-auto object-contain rounded-lg shadow-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        </div>
                      )}
                      <p className="text-[10px] text-gray-400 mt-2">Paste a direct image URL of your GCash QR code. Customers will scan this to pay.</p>
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
