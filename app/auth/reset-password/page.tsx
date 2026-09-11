"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Lock, Eye, EyeOff, ShieldCheck, CheckCircle2, ArrowRight } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        toast.error(error.message);
      } else {
        setSuccess(true);
        toast.success("Password reset successfully!");
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      }
    } catch (err: any) {
      toast.error("An unexpected error occurred: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#1c0409]">
      <Toaster position="top-right" />

      {/* Background with blur */}
      <div
        className="fixed inset-0 scale-105"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1400&q=80')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(6px) brightness(0.3)",
        }}
      />

      {/* Card */}
      <div className="relative z-10 bg-white rounded-2xl w-full max-w-sm shadow-2xl border-t-4 border-[#c9a84c] overflow-hidden">
        <div className="p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-full bg-[#3d0a14] flex items-center justify-center mx-auto mb-3 shadow-lg">
              <ShieldCheck size={28} className="text-[#c9a84c]" />
            </div>
            <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'Playfair Display', serif" }}>
              Reset Your Password
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Enter and confirm your new password below.
            </p>
          </div>

          {success ? (
            <div className="space-y-4 text-center">
              <div className="w-16 h-16 rounded-full bg-green-50 text-green-600 flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-800">Password Updated!</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Your new password is now active. Redirecting you to the login page...
                </p>
              </div>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 w-full bg-[#3d0a14] text-white py-3 rounded-xl text-xs font-bold hover:bg-[#5c1020] transition-colors"
              >
                Go to Login <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              {/* New Password */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPass ? "text" : "password"}
                    required
                    minLength={6}
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:border-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/20 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showConfirmPass ? "text" : "password"}
                    required
                    minLength={6}
                    placeholder="Re-enter your new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:border-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/20 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#3d0a14] text-white py-3 rounded-xl text-sm font-semibold tracking-wide hover:bg-[#5c1020] transition-all shadow-md mt-2 disabled:opacity-70"
              >
                {loading ? "Updating Password..." : "Update Password"}
              </button>
            </form>
          )}
        </div>

        <div className="px-8 py-3.5 bg-gray-50 border-t border-gray-100 text-center">
          <Link href="/login" className="text-xs text-gray-500 hover:text-[#3d0a14] font-medium transition-colors">
            ← Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
