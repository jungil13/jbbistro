"use client";

import React from "react";
import { Check, X } from "lucide-react";
import { validatePasswordStrength } from "@/lib/passwordValidation";

interface PasswordRequirementsIndicatorProps {
  password: string;
  className?: string;
}

export default function PasswordRequirementsIndicator({
  password,
  className = "",
}: PasswordRequirementsIndicatorProps) {
  if (!password) {
    return (
      <div className={`text-xs text-gray-500 space-y-1 mt-1.5 ${className}`}>
        <p className="font-medium text-gray-600">Password must contain:</p>
        <p className="text-gray-400">At least 8 characters with uppercase, lowercase, number, and symbol.</p>
      </div>
    );
  }

  const { requirements } = validatePasswordStrength(password);

  return (
    <div className={`mt-2 p-2.5 bg-gray-50/80 rounded-xl border border-gray-100 text-xs space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between font-semibold text-gray-700">
        <span>Password Requirements</span>
        <span className="text-[10px] text-gray-400 font-normal">
          {requirements.filter((r) => r.met).length} of {requirements.length} met
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
        {requirements.map((req) => (
          <div
            key={req.id}
            className={`flex items-center gap-1.5 transition-colors duration-150 ${
              req.met ? "text-emerald-600 font-medium" : "text-gray-400"
            }`}
          >
            {req.met ? (
              <span className="w-3.5 h-3.5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <Check size={10} strokeWidth={3} />
              </span>
            ) : (
              <span className="w-3.5 h-3.5 rounded-full bg-gray-200 text-gray-400 flex items-center justify-center shrink-0">
                <span className="w-1 h-1 rounded-full bg-gray-400"></span>
              </span>
            )}
            <span className="truncate">{req.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
