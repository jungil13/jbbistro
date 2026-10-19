"use client";

import React from "react";
import { LogOut, AlertTriangle } from "lucide-react";

interface LogoutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export default function LogoutConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: LogoutConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 space-y-4 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
            <LogOut size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Sign Out</h3>
            <p className="text-xs text-gray-500">Account session</p>
          </div>
        </div>

        <p className="text-sm text-gray-600 leading-relaxed">
          Are you sure you want to log out? You will need to sign in again to access your reservations and account details.
        </p>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition duration-150 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className="px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 active:scale-95 rounded-xl shadow-md transition duration-150 flex items-center gap-2 disabled:opacity-50"
          >
            {isLoading && (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {isLoading ? "Signing out..." : "Yes, Log Out"}
          </button>
        </div>
      </div>
    </div>
  );
}
