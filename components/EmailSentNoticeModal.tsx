"use client";

import React, { useState } from "react";
import { Mail, CheckCircle2, RefreshCw, X, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

interface EmailSentNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
}

export default function EmailSentNoticeModal({
  isOpen,
  onClose,
  email,
}: EmailSentNoticeModalProps) {
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const supabase = createClient();

  if (!isOpen) return null;

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?type=signup`,
        },
      });

      if (error) {
        toast.error(error.message || "Failed to resend email.");
      } else {
        toast.success("Verification email resent! Please check your inbox.");
        setCooldown(60);
        const timer = setInterval(() => {
          setCooldown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-gray-100 text-center relative overflow-hidden space-y-5 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition"
        >
          <X size={18} />
        </button>

        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-red-600/20 ring-8 ring-red-50">
            <Mail size={32} />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h3 className="text-xl font-black text-gray-900">
            Check Your Email
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            We’ve sent a confirmation link to:
          </p>
          <div className="inline-block bg-gray-50 border border-gray-200 text-gray-900 font-semibold px-3 py-1.5 rounded-xl text-xs sm:text-sm max-w-full truncate">
            {email}
          </div>
        </div>

        <p className="text-xs text-gray-500 leading-relaxed bg-amber-50/70 text-amber-900 p-3 rounded-xl border border-amber-200/60">
          💡 Click the link in the email to activate your account. You will be automatically logged in and redirected to your profile!
        </p>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 bg-red-700 hover:bg-red-800 text-white font-bold text-sm rounded-xl shadow-md transition active:scale-[0.98]"
          >
            I'll Check My Email
          </button>

          <button
            type="button"
            onClick={handleResend}
            disabled={resending || cooldown > 0}
            className="w-full py-2.5 text-xs font-semibold text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw size={14} className={resending ? "animate-spin" : ""} />
            {cooldown > 0
              ? `Resend in ${cooldown}s`
              : resending
              ? "Resending..."
              : "Didn't receive email? Resend"}
          </button>
        </div>
      </div>
    </div>
  );
}
