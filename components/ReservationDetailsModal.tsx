"use client";
import { X, Calendar, Clock, User, Phone, Mail, FileText, Tag, Banknote, CalendarDays } from "lucide-react";
import { formatDate, formatTime } from "@/lib/dateUtils";

export interface ReservationModalData {
  id: string;
  reservation_code?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  date: string;
  time_start: string;
  guests: number;
  status: string;
  total_amount: number;
  notes?: string | null;
  services?: { name: string; type: string } | null;
  payments?: any[];
  created_at?: string;
  [key: string]: any;
}

interface Props {
  reservation: ReservationModalData;
  onClose: () => void;
  isAdmin?: boolean;
}

const statusColors: Record<string, string> = {
  pending:   "bg-amber-100 text-amber-700 border-amber-200",
  confirmed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-100 text-red-600 border-red-200",
};

export default function ReservationDetailsModal({ reservation, onClose, isAdmin = false }: Props) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div>
            <h3 className="font-bold text-gray-800 text-lg" style={{ fontFamily: "'Playfair Display', serif" }}>
              Reservation Details
            </h3>
            {reservation.reservation_code && (
              <p className="text-xs font-mono text-gray-500 mt-0.5">
                {reservation.reservation_code}
              </p>
            )}
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Status and Service */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <Tag size={16} className="text-red-800" />
                {reservation.services?.name ?? "Unknown Service"}
              </p>
              <p className="text-xs text-gray-500 capitalize mt-1 ml-6">
                {reservation.services?.type ?? "Service"}
              </p>
            </div>
            <span className={`text-xs font-bold px-3 py-1 rounded-full border capitalize ${statusColors[reservation.status] ?? statusColors.pending}`}>
              {reservation.status}
            </span>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <CalendarDays size={12} /> Date
              </p>
              <p className="text-sm font-semibold text-gray-800">
                {formatDate(reservation.date)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Clock size={12} /> Time
              </p>
              <p className="text-sm font-semibold text-gray-800">
                {formatTime(reservation.time_start)}
              </p>
            </div>
          </div>

          {/* Additional Info */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <span className="text-sm text-gray-500 flex items-center gap-2">
                <User size={16} /> Guests
              </span>
              <span className="text-sm font-semibold text-gray-800">
                {reservation.guests} {reservation.guests === 1 ? "person" : "people"}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <span className="text-sm text-gray-500 flex items-center gap-2">
                <Banknote size={16} /> Total Amount
              </span>
              <span className="text-sm font-semibold text-gray-800">
                ₱{reservation.total_amount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Customer Details (Admin view) */}
          {isAdmin && (reservation.customer_name || reservation.customer_email || reservation.customer_phone) && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Customer Information</h4>
              <div className="space-y-3">
                {reservation.customer_name && (
                  <div className="flex items-center gap-3 text-sm">
                    <User size={14} className="text-gray-400" />
                    <span className="text-gray-800">{reservation.customer_name}</span>
                  </div>
                )}
                {reservation.customer_email && (
                  <div className="flex items-center gap-3 text-sm">
                    <Mail size={14} className="text-gray-400" />
                    <span className="text-gray-800">{reservation.customer_email}</span>
                  </div>
                )}
                {reservation.customer_phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone size={14} className="text-gray-400" />
                    <span className="text-gray-800">{reservation.customer_phone}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Payment Details */}
          {reservation.payments && reservation.payments.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Payment Information</h4>
              <div className="space-y-4">
                {reservation.payments.map((payment: any, i: number) => (
                  <div key={i} className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-bold text-gray-800 uppercase">{payment.method}</p>
                        <p className="text-xs text-gray-500 capitalize">{payment.status}</p>
                      </div>
                      <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                        Payment #{i + 1}
                      </span>
                    </div>
                    {payment.reference_number && (
                      <p className="text-sm text-gray-700 font-mono">Ref: {payment.reference_number}</p>
                    )}
                    {payment.receipt_url && (
                      <div className="mt-3">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Proof of Payment</p>
                        <a href={payment.receipt_url} target="_blank" rel="noopener noreferrer" className="block hover:opacity-90 transition-opacity">
                          <img src={payment.receipt_url} alt="Receipt Screenshot" className="max-w-full h-32 object-contain rounded-lg border border-gray-200 bg-white shadow-sm" />
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {reservation.notes && (
            <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100">
              <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <FileText size={12} /> Notes
              </p>
              <p className="text-sm text-gray-700 italic">
                {reservation.notes}
              </p>
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
}
