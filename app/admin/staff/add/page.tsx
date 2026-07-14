"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  Camera,
  ArrowLeft,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";

export default function AddStaff() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Form State
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    dob: "",
    username: "",
    password: "",
    role: "staff", // default
  });

  // Permissions State
  const [permissions, setPermissions] = useState({
    can_dashboard: false,
    can_reservations: false,
    can_services: false,
    can_billing: false,
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPhotoPreview(url);
      // In a real app, you would upload this to Supabase Storage
      // and save the returned URL to the profile.
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Create User in Supabase Auth (simulated since we're using client-side)
      // Note: Supabase admin API requires service_role key to bypass email confirmation.
      // For this demo, we'll insert directly into profiles table (assuming triggers handle it or we just mock auth)
      // In production, you'd use a server action or edge function with admin client.
      
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            first_name: form.first_name,
            last_name: form.last_name,
            role: form.role,
          }
        }
      });

      if (signUpError) throw signUpError;

      // Ensure profile is created (trigger usually does this, but we can update it)
      if (data.user) {
        await supabase.from("profiles").update({
          first_name: form.first_name,
          last_name: form.last_name,
          phone: form.phone,
          dob: form.dob,
          username: form.username,
          role: form.role,
        }).eq("id", data.user.id);

        // 2. Update Permissions (row is now auto-created by the SQL trigger)
        await supabase.from("staff_permissions").update(permissions).eq("staff_id", data.user.id);
      }

      toast.success("Staff member added successfully!");
      setTimeout(() => router.push("/admin/staff"), 1500);

    } catch (error: any) {
      toast.error(error.message || "Failed to add staff member");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Toaster position="top-right" />
      
      <div className="flex items-center gap-4">
        <Link href="/admin/staff" className="p-2 border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Add New Staff</h1>
          <p className="text-sm text-gray-400">Create a new account and set permissions</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column - Form */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Personal Details */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-sm font-bold text-gray-800 mb-5 pb-3 border-b border-gray-50">Personal Information</h2>
            
            <div className="flex flex-col sm:flex-row gap-6 mb-6">
              {/* Photo Upload */}
              <div className="flex flex-col items-center gap-3">
                <div className="w-24 h-24 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 overflow-hidden relative group">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Camera size={24} className="text-gray-400" />
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <span className="text-white text-[10px] font-bold">Upload</span>
                  </div>
                  <input type="file" accept="image/*" onChange={handlePhotoChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                </div>
                <p className="text-[10px] text-gray-400">Profile Picture</p>
              </div>

              {/* Names */}
              <div className="flex-1 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">First Name *</label>
                  <input required type="text" value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-300" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Last Name *</label>
                  <input required type="text" value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-300" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email Address *</label>
                  <input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-300" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Phone Number</label>
                <input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-300" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date of Birth</label>
                <input type="date" value={form.dob} onChange={e => setForm({...form, dob: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-300" />
              </div>
            </div>
          </div>

          {/* Account Credentials */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-sm font-bold text-gray-800 mb-5 pb-3 border-b border-gray-50">Account Credentials</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Username *</label>
                <input required type="text" value={form.username} onChange={e => setForm({...form, username: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-300" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Temporary Password *</label>
                <input required type="text" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-300" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Roles & Permissions */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-sm font-bold text-gray-800 mb-5 pb-3 border-b border-gray-50">Role & Access</h2>
            
            <div className="mb-6">
              <label className="block text-xs font-semibold text-gray-600 mb-2">Assign Role</label>
              <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-300">
                <option value="staff">Staff (Limited Access)</option>
                <option value="manager">Manager (Broad Access)</option>
                <option value="admin">Admin (Full Access)</option>
              </select>
            </div>

            {form.role === "staff" && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-3">Specific Permissions</label>
                <div className="space-y-3">
                  {[
                    { id: "can_dashboard", label: "View Dashboard Analytics" },
                    { id: "can_reservations", label: "Manage Reservations" },
                    { id: "can_services", label: "Services & Inventory" },
                    { id: "can_billing", label: "Billing & Payment" },
                  ].map((p) => (
                    <label key={p.id} className="flex items-center gap-3 cursor-pointer group">
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${permissions[p.id as keyof typeof permissions] ? "bg-red-900 border-red-900" : "border-gray-300 bg-white group-hover:border-red-300"}`}>
                        {permissions[p.id as keyof typeof permissions] && <CheckCircle size={12} className="text-white" />}
                      </div>
                      <span className="text-sm text-gray-600">{p.label}</span>
                      <input 
                        type="checkbox" 
                        className="hidden" 
                        checked={permissions[p.id as keyof typeof permissions]} 
                        onChange={(e) => setPermissions({...permissions, [p.id]: e.target.checked})} 
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}
            
            {form.role !== "staff" && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                <p className="text-xs text-blue-700 leading-relaxed">
                  <strong>{form.role.toUpperCase()}</strong> role overrides specific permissions and grants broader system access automatically.
                </p>
              </div>
            )}
          </div>

          <button type="submit" disabled={loading} className="w-full bg-red-900 text-white font-bold py-3.5 rounded-xl text-sm tracking-wide hover:bg-red-800 transition-colors disabled:opacity-60 flex justify-center items-center gap-2 shadow-lg shadow-red-900/20">
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <><CheckCircle size={16} /> Create Staff Account</>
            )}
          </button>
        </div>

      </form>
    </div>
  );
}
