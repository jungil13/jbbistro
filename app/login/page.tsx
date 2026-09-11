"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, ShieldCheck, Mail, Lock, User as UserIcon, KeyRound, RefreshCw } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

type Tab = "login" | "register";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("login");
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [loading, setLoading] = useState(false);

  // Forgot Password OTP modal states
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetStep, setResetStep] = useState<"email" | "otp" | "success">("email");
  const [resetEmail, setResetEmail] = useState("");
  const [resetSending, setResetSending] = useState(false);
  const [otpValues, setOtpValues] = useState(["", "", "", "", "", ""]);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    // Check for errors in the hash fragment (common with Supabase OAuth/Magic Link)
    let hashErrorMsg = null;
    if (typeof window !== "undefined" && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      if (hashParams.has("error_description")) {
        hashErrorMsg = hashParams.get("error_description");
      } else if (hashParams.has("error")) {
        hashErrorMsg = hashParams.get("error");
      }
    }

    // Check for errors in query parameters
    const queryErrorMsg = searchParams.get("error_description") || searchParams.get("error");
    
    // Display the most specific error message available
    const finalError = hashErrorMsg?.replace(/\+/g, ' ') || queryErrorMsg?.replace(/\+/g, ' ');
    
    if (finalError) {
      // Map common cryptic errors to user-friendly messages
      let displayMessage = finalError;
      if (displayMessage === "auth_callback_failed") {
        displayMessage = "Authentication failed. The link may have expired or is invalid.";
      }
      
      toast.error(displayMessage, { duration: 5000 });
      
      // Clean up the URL so the error doesn't show again on refresh
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.search = '';
        url.hash = '';
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
      const role = profile?.role || "customer";
      
      toast.success("Login successful!");
      setTimeout(() => {
        if (role === "admin") router.push("/admin");
        else if (role === "manager") router.push("/manager");
        else router.push("/profile");
      }, 1000);
    }
  };

  const handleOAuthLogin = async (provider: 'google' | 'facebook') => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      }
    });
    if (error) {
      toast.error(error.message);
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);

    const [first_name, ...last_name_parts] = name.split(" ");
    const last_name = last_name_parts.join(" ");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name,
          last_name,
          phone,
          role: "customer"
        }
      }
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Registration successful! You can now log in.");
      setTab("login");
    }
    setLoading(false);
  };

  const startResendCooldown = () => {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) { toast.error("Please enter your email address."); return; }
    setResetSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail);
      if (error) {
        toast.error(error.message);
      } else {
        setResetStep("otp");
        setOtpValues(["", "", "", "", "", ""]);
        startResendCooldown();
        toast.success("OTP sent! Check your email.");
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      }
    } catch (err: any) {
      toast.error("Failed to send OTP: " + err.message);
    } finally {
      setResetSending(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otpValues];
    newOtp[index] = value.slice(-1);
    setOtpValues(newOtp);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpValues[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setOtpValues(pasted.split(""));
      otpRefs.current[5]?.focus();
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = otpValues.join("");
    if (token.length !== 6) { toast.error("Please enter the full 6-digit OTP."); return; }
    setOtpVerifying(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: resetEmail,
        token,
        type: "recovery",
      });
      if (error) {
        toast.error(error.message);
        setOtpValues(["", "", "", "", "", ""]);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      } else {
        setResetStep("success");
        setTimeout(() => {
          setShowForgotModal(false);
          router.push("/auth/reset-password");
        }, 1500);
      }
    } catch (err: any) {
      toast.error("Verification failed: " + err.message);
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setResetSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail);
      if (error) { toast.error(error.message); }
      else { startResendCooldown(); toast.success("New OTP sent!"); }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setResetSending(false);
    }
  };

  const handleCloseForgotModal = () => {
    setShowForgotModal(false);
    setTimeout(() => { setResetStep("email"); setResetEmail(""); setOtpValues(["", "", "", "", "", ""]); }, 300);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <Toaster position="top-right" />
      
      {/* Blurred background */}
      <div
        className="fixed inset-0 scale-105"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1400&q=80')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(6px) brightness(0.4)",
        }}
      />

      {/* Card */}
      <div className="relative z-10 bg-white rounded-2xl w-full max-w-sm shadow-2xl border-t-4 border-gold overflow-hidden">
        <div className="px-8 pt-8 pb-6">

          {/* Tabs */}
          <div className="grid grid-cols-2 border-b border-gray-200 mb-6">
            {(["login", "register"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`py-2.5 text-sm font-medium capitalize relative transition-colors ${
                  tab === t ? "text-red-900" : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {t}
                {tab === t && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold" />
                )}
              </button>
            ))}
          </div>

          {/* ── LOGIN ── */}
          {tab === "login" && (
            <form className="space-y-4" onSubmit={handleLogin}>
              <div className="flex flex-col items-center mb-6">
                <div className="w-14 h-14 rounded-full bg-red-950 flex items-center justify-center mb-2 shadow-lg">
                  <ShieldCheck size={28} className="text-gold" />
                </div>
                <p className="font-playfair text-xl">
                  <span className="text-red-950 font-bold">Jbenz</span>
                  <span className="text-gold font-semibold"> Bistro</span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-700">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email);
                      setResetStep("email");
                      setShowForgotModal(true);
                    }}
                    className="text-[11px] text-red-900 hover:text-red-700 font-bold hover:underline transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPass ? "text" : "password"}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 focus:bg-white transition-all"
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

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-red-950 text-white py-3 rounded-lg text-sm font-semibold tracking-wide hover:bg-red-900 transition-all shadow-md mt-2 disabled:opacity-70"
              >
                {loading ? "Logging in..." : "Login"}
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-400">Or continue with</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={() => handleOAuthLogin('google')}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 w-full py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-70"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Google
                </button>
              </div>
            </form>
          )}

          {/* ── REGISTER ── */}
          {tab === "register" && (
            <form className="space-y-4" onSubmit={handleRegister}>
              <div className="flex flex-col items-center mb-4">
                <div className="w-12 h-12 rounded-full bg-red-950 flex items-center justify-center mb-2">
                  <UserIcon size={24} className="text-gold" />
                </div>
                <h2 className="font-playfair text-xl font-bold text-red-950">Create Account</h2>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Juan Dela Cruz"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-gold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="juan@example.com"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-gold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="09XX XXX XXXX"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-gold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full pl-3 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-gold"
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

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPass ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    className="w-full pl-3 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-gold"
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

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-red-950 text-white py-3 rounded-lg text-sm font-semibold tracking-wide hover:bg-red-900 transition-all shadow-md mt-2 disabled:opacity-70"
              >
                {loading ? "Creating..." : "Create Account"}
              </button>
              
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-400">Or continue with</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={() => handleOAuthLogin('google')}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 w-full py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-70"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Google
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="px-8 py-3 bg-gray-50 border-t border-gray-100 text-center">
          <Link href="/" className="text-xs text-gray-400 hover:text-gold transition-colors">
            ← Back to Home
          </Link>
        </div>
      </div>

      {/* Forgot Password OTP Modal */}
      {showForgotModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={handleCloseForgotModal}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl relative border-t-4 border-[#c9a84c]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Step 1: Email */}
            {resetStep === "email" && (
              <>
                <div className="text-center mb-5">
                  <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3 shadow-sm">
                    <Lock size={22} className="text-red-950" />
                  </div>
                  <h3 className="text-base font-bold text-gray-800">Forgot Password?</h3>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Enter your email and we&apos;ll send a 6-digit OTP to reset your password.
                  </p>
                </div>
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="email"
                        required
                        placeholder="your.email@example.com"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:border-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/20 focus:bg-white"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={handleCloseForgotModal}
                      className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-xs font-semibold hover:bg-gray-200 transition-colors">
                      Cancel
                    </button>
                    <button type="submit" disabled={resetSending}
                      className="flex-1 bg-red-950 text-white py-2.5 rounded-xl text-xs font-semibold hover:bg-red-900 transition-colors disabled:opacity-60 shadow-sm">
                      {resetSending ? "Sending..." : "Send OTP"}
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* Step 2: OTP Verify */}
            {resetStep === "otp" && (
              <>
                <div className="text-center mb-5">
                  <div className="w-12 h-12 rounded-full bg-[#c9a84c]/10 flex items-center justify-center mx-auto mb-3">
                    <KeyRound size={22} className="text-[#c9a84c]" />
                  </div>
                  <h3 className="text-base font-bold text-gray-800">Enter OTP</h3>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    We sent a 6-digit code to <span className="font-semibold text-gray-700">{resetEmail}</span>.
                    Check your inbox (and spam folder).
                  </p>
                </div>
                <form onSubmit={handleVerifyOtp} className="space-y-5">
                  {/* 6-digit OTP boxes */}
                  <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                    {otpValues.map((val, i) => (
                      <input
                        key={i}
                        ref={(el) => { otpRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={val}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        className="w-11 h-12 text-center text-lg font-bold border-2 rounded-xl bg-gray-50 focus:outline-none focus:border-[#c9a84c] focus:bg-white transition-colors"
                        style={{ borderColor: val ? "#c9a84c" : undefined }}
                      />
                    ))}
                  </div>

                  <button type="submit" disabled={otpVerifying || otpValues.join("").length !== 6}
                    className="w-full bg-red-950 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-red-900 transition-colors disabled:opacity-60 shadow-sm">
                    {otpVerifying ? "Verifying..." : "Verify OTP"}
                  </button>

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <button type="button" onClick={() => setResetStep("email")}
                      className="hover:text-gray-700 transition-colors">
                      ← Change email
                    </button>
                    <button type="button" onClick={handleResendOtp}
                      disabled={resendCooldown > 0 || resetSending}
                      className="flex items-center gap-1 text-red-900 font-semibold hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                      <RefreshCw size={12} />
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* Step 3: Success */}
            {resetStep === "success" && (
              <div className="text-center py-4 space-y-3">
                <div className="w-14 h-14 rounded-full bg-green-50 text-green-600 flex items-center justify-center mx-auto">
                  <ShieldCheck size={28} />
                </div>
                <h3 className="text-base font-bold text-gray-800">OTP Verified!</h3>
                <p className="text-xs text-gray-500">Redirecting you to set your new password...</p>
                <div className="w-6 h-6 border-2 border-t-red-950 rounded-full animate-spin mx-auto"></div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#fdfbf6]">
        <div className="w-8 h-8 rounded-full border-4 border-t-red-950 border-r-red-950 border-b-red-900 border-l-red-900 animate-spin"></div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}