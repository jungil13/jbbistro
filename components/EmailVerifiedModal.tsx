"use client";

import React from "react";
import { CheckCircle2, Sparkles, ArrowRight, ShieldCheck, Calendar, Receipt } from "lucide-react";

interface EmailVerifiedModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string | null;
}

export default function EmailVerifiedModal({
  isOpen,
  onClose,
  userEmail,
}: EmailVerifiedModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-emerald-100 text-center relative overflow-hidden space-y-6 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative background glow */}
        <div className="absolute -top-20 -right-20 w-44 h-44 bg-emerald-100/60 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-44 h-44 bg-amber-100/40 rounded-full blur-3xl pointer-events-none" />

        {/* Top Badge & Icon */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25 ring-8 ring-emerald-50">
              <CheckCircle2 size={40} className="stroke-[2.5]" />
            </div>
            <div className="absolute -top-1 -right-1 bg-amber-400 text-amber-950 p-1.5 rounded-full shadow-md animate-bounce">
              <Sparkles size={14} />
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <ShieldCheck size={14} />
            Email Verified & Active
          </div>
        </div>

        {/* Heading & description */}
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">
            Email Verified Successfully!
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Welcome to <span className="font-semibold text-gray-800">JBENZ Bistro</span>! 
            {userEmail ? (
              <> Your email <span className="font-medium text-emerald-700">{userEmail}</span> has been confirmed.</>
            ) : (
              " Your account is now fully activated and you are automatically signed in."
            )}
          </p>
        </div>

        {/* Perks / features */}
        <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100 text-left space-y-2.5">
          <div className="flex items-center gap-2.5 text-xs text-gray-700 font-medium">
            <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Calendar size={13} />
            </div>
            <span>Book Karaoke VIP Suites, Billiards & Dining Tables</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-gray-700 font-medium">
            <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Receipt size={13} />
            </div>
            <span>Instant GCash payment tracking & printable receipts</span>
          </div>
        </div>

        {/* Action Button */}
        <div>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3.5 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-emerald-600/25 active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-2"
          >
            <span>Go to My Profile</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
