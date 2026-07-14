"use client";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number; // positive = up, negative = down, 0 = neutral
  icon: React.ReactNode;
  color?: "red" | "blue" | "green" | "purple" | "orange";
}

const colorMap = {
  red: {
    bg: "bg-red-50",
    icon: "bg-red-100 text-red-700",
    accent: "text-red-700",
    border: "border-red-100",
  },
  blue: {
    bg: "bg-blue-50",
    icon: "bg-blue-100 text-blue-700",
    accent: "text-blue-700",
    border: "border-blue-100",
  },
  green: {
    bg: "bg-emerald-50",
    icon: "bg-emerald-100 text-emerald-700",
    accent: "text-emerald-700",
    border: "border-emerald-100",
  },
  purple: {
    bg: "bg-purple-50",
    icon: "bg-purple-100 text-purple-700",
    accent: "text-purple-700",
    border: "border-purple-100",
  },
  orange: {
    bg: "bg-orange-50",
    icon: "bg-orange-100 text-orange-700",
    accent: "text-orange-700",
    border: "border-orange-100",
  },
};

export default function StatCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  color = "red",
}: StatCardProps) {
  const c = colorMap[color];

  return (
    <div
      className={`bg-white rounded-2xl border ${c.border} p-5 shadow-sm hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl ${c.icon} flex items-center justify-center flex-shrink-0`}>
          {icon}
        </div>
        {trend !== undefined && (
          <div
            className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${
              trend > 0
                ? "bg-green-50 text-green-600"
                : trend < 0
                ? "bg-red-50 text-red-500"
                : "bg-gray-50 text-gray-400"
            }`}
          >
            {trend > 0 ? (
              <TrendingUp size={12} />
            ) : trend < 0 ? (
              <TrendingDown size={12} />
            ) : (
              <Minus size={12} />
            )}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-800 leading-none mb-1">
        {value}
      </p>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {title}
      </p>
      {subtitle && (
        <p className="text-[11px] text-gray-400 mt-1">{subtitle}</p>
      )}
    </div>
  );
}
