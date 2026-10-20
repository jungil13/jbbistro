"use client";
import { useState, useEffect } from "react";
import {
  X,
  Clock,
  User,
  Phone,
  Mail,
  FileText,
  Tag,
  Banknote,
  CalendarDays,
  CheckCircle,
  XCircle,
  Printer,
  RotateCcw,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import { formatDate, formatTime } from "@/lib/dateUtils";
import {
  getReservationRefundsAction,
  reconcilePayMongoRefundStatusAction,
} from "@/app/actions/refund";
import { getRefundStatusLabel } from "@/lib/refundStatus";
import toast from "react-hot-toast";

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
  services?: { name: string; type: string; description?: string | null; hourly_rate?: number | null } | null;
  reservation_menu?: any[];
  payments?: any[];
  created_at?: string;
  [key: string]: any;
}

interface Props {
  reservation: ReservationModalData;
  onClose: () => void;
  isAdmin?: boolean;
  onUpdateStatus?: (id: string, status: string) => Promise<void>;
}

const statusColors: Record<string, string> = {
  pending:   "bg-amber-100 text-amber-700 border-amber-200",
  confirmed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-100 text-red-600 border-red-200",
};

export default function ReservationDetailsModal({ reservation, onClose, isAdmin = false, onUpdateStatus }: Props) {
  const [refunds, setRefunds] = useState<any[]>([]);
  const [refundsLoading, setRefundsLoading] = useState(isAdmin);
  const [reconciling, setReconciling] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(reservation.status);

  useEffect(() => {
    let active = true;
    async function loadRefundData() {
      if (!reservation.id || !isAdmin) {
        setRefundsLoading(false);
        return;
      }
      try {
        const refRes = await getReservationRefundsAction(reservation.id);
        if (!active) return;
        if (refRes.success && refRes.refunds) {
          setRefunds(refRes.refunds);
        }
      } catch (e) {
        console.warn("Could not load refund data:", e);
      } finally {
        if (active) setRefundsLoading(false);
      }
    }
    loadRefundData();
    return () => {
      active = false;
    };
  }, [reservation.id, isAdmin]);

  const handleReconcile = async (refundId?: string) => {
    setReconciling(true);
    const toastId = toast.loading("Reconciling status with PayMongo...");
    try {
      const res = await reconcilePayMongoRefundStatusAction(reservation.id, refundId);
      toast.dismiss(toastId);
      if (res.success) {
        toast.success(res.message || "Reconciliation complete.");
        const refRes = await getReservationRefundsAction(reservation.id);
        if (refRes.success && refRes.refunds) setRefunds(refRes.refunds);
      } else {
        toast.error(res.error || "Reconciliation failed.");
      }
    } catch (e: any) {
      toast.dismiss(toastId);
      toast.error(e.message || "Reconciliation error.");
    } finally {
      setReconciling(false);
    }
  };
  // Extract bundle if present in notes
  const bundleMatch = reservation.notes?.match(/\[Bundle:\s*([^()\]]+?)(?:\s*\(([^)]+)\))?\]/i);
  const bundleName = bundleMatch ? bundleMatch[1].trim() : null;
  const bundlePriceStr = bundleMatch ? bundleMatch[2]?.trim() : null;

  // Compute menu total from pre-ordered items
  const menuTotal = reservation.reservation_menu && reservation.reservation_menu.length > 0
    ? reservation.reservation_menu.reduce((sum: number, rm: any) => sum + (rm.menu_items?.price ?? 0) * (rm.quantity ?? 1), 0)
    : 0;
  // Always use the DB total_amount which correctly stores service + menu total
  const displayTotal = reservation.total_amount ?? 0;
  // Service fee: prioritize the service's defined hourly_rate if available
  const serviceAmount = reservation.services?.hourly_rate !== undefined && reservation.services?.hourly_rate !== null
    ? Number(reservation.services.hourly_rate)
    : (menuTotal > 0 && displayTotal >= menuTotal ? displayTotal - menuTotal : displayTotal);
  const discountAmount = Math.max(0, (serviceAmount + menuTotal) - displayTotal);
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
          <div className="flex items-center gap-2">
            <a
              href={`/receipt/${reservation.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg transition-colors shadow-sm"
              title="Print Official Customer Receipt"
            >
              <Printer size={13} /> Print Receipt
            </a>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
            >
              <X size={18} />
            </button>
          </div>
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
              {reservation.services?.description && (
                <p className="text-[11px] text-gray-500 mt-2 ml-6 leading-relaxed bg-gray-50 p-2 rounded-lg border border-gray-100">
                  {reservation.services.description}
                </p>
              )}
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

            {/* Service Fee row — always shown */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <span className="text-sm text-gray-500 flex items-center gap-2">
                <Tag size={16} /> Service Fee
              </span>
              <span className="text-sm font-semibold text-gray-800">
                ₱{serviceAmount.toLocaleString()}
              </span>
            </div>

            {/* Meal Bundle row — if bundle was selected */}
            {bundleName && (
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 text-amber-900 bg-amber-50/70 px-3 py-2 rounded-xl">
                <span className="text-sm font-semibold flex items-center gap-2">
                  <Tag size={16} className="text-amber-600" /> Meal Bundle: {bundleName}
                </span>
                <span className="text-sm font-bold text-amber-900">
                  {bundlePriceStr || "Included"}
                </span>
              </div>
            )}

            {/* Menu subtotal row — only when items exist */}
            {menuTotal > 0 && (
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <span className="text-sm text-gray-500 flex items-center gap-2">
                  <Banknote size={16} /> Menu Subtotal
                </span>
                <span className="text-sm font-semibold text-gray-800">
                  ₱{menuTotal.toLocaleString()}
                </span>
              </div>
            )}

            {discountAmount > 0 && (
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 text-emerald-700 bg-emerald-50/70 px-3 py-2 rounded-xl">
                <span className="text-sm font-semibold flex items-center gap-2">
                  <Tag size={16} className="text-emerald-600" /> Bundle / Promo Savings
                </span>
                <span className="text-sm font-bold">
                  -₱{discountAmount.toLocaleString()}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between rounded-xl bg-[#3d0a14]/5 border border-[#3d0a14]/10 px-3 py-3">
              <span className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <Banknote size={16} className="text-[#8b1327]" /> Total Amount
              </span>
              <span className="text-base font-black text-[#8b1327]">
                ₱{displayTotal.toLocaleString()}
              </span>
            </div>

            {/* Pre-ordered Menu Items */}
            {reservation.reservation_menu && reservation.reservation_menu.length > 0 && (
              <div className="pt-2">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Pre-ordered Items</h4>
                <div className="bg-gray-50 rounded-xl p-4 space-y-2 border border-gray-100">
                  {reservation.reservation_menu.map((rm: any, i: number) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <span className="text-gray-700">
                        {rm.quantity > 1 && <span className="text-gray-400 mr-2">×{rm.quantity}</span>}
                        {rm.menu_items?.name}
                      </span>
                      <span className="font-semibold text-gray-800">
                        ₱{((rm.menu_items?.price ?? 0) * rm.quantity).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                {reservation.customer_email && reservation.customer_email !== "walkin@jbenzbistro.local" && (
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
                {reservation.payments.map((payment: any, i: number) => {
                  const isPayMongo =
                    payment.reference_number?.startsWith("pay_") ||
                    payment.gcash_number?.toLowerCase().includes("paymongo") ||
                    reservation.notes?.includes("PayMongo");
                  const displayMethod = isPayMongo
                    ? (payment.gcash_number ? payment.gcash_number.toUpperCase() : "PAYMONGO ONLINE GATEWAY")
                    : payment.method?.toUpperCase();

                  // Match the refund to the actual PayMongo payment on this reservation.
                  // Keep this comparison strict so previously processed refunds don't get
                  // confused with unrelated entries while the audit is still loading.
                  const paymentRef = payment.reference_number || payment.id || "";
                  const matchingRefund =
                    refunds.find((r) => {
                      const refundPaymentId = r.payment_id || r.paymongo_payment_id || "";
                      const refundReservationId = r.reservation_id || "";

                      return (
                        (payment.id && refundPaymentId && (refundPaymentId === payment.id || refundPaymentId === paymentRef)) ||
                        (payment.reference_number &&
                          refundPaymentId &&
                          (refundPaymentId === payment.reference_number || r.paymongo_payment_id === payment.reference_number)) ||
                        (refundReservationId === reservation.id && refundPaymentId === paymentRef)
                      );
                    }) || null;

                  const paymentAmountVal = Number(payment.amount || reservation.total_amount || 0);

                  const isRefunded =
                    payment.status === "refunded" ||
                    matchingRefund?.status === "succeeded" ||
                    matchingRefund?.status === "completed" ||
                    reservation.notes?.includes("[PayMongo Refund Succeeded:");

                  return (
                    <div key={i} className="bg-emerald-50/40 p-4 rounded-xl border border-emerald-100 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-bold text-gray-800">{displayMethod}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                                isRefunded
                                  ? "bg-purple-100 text-purple-800 border border-purple-200"
                                  : payment.status === "verified" || payment.status === "paid"
                                  ? "bg-green-100 text-green-800 border border-green-200"
                                  : "bg-amber-100 text-amber-800 border border-amber-200"
                              }`}
                            >
                              {isRefunded ? "Refunded" : payment.status}
                            </span>
                            <span className="text-xs font-black text-gray-900">
                              ₱{paymentAmountVal.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                          {isPayMongo ? "Verified Gateway" : `Payment #${i + 1}`}
                        </span>
                      </div>

                      {payment.reference_number && (
                        <p className="text-xs text-gray-600 font-mono">
                          Ref: <span className="text-gray-900 font-semibold">{payment.reference_number}</span>
                        </p>
                      )}

                      {/* REFUND AUDIT CARD (Requested details) */}
                      {isPayMongo && refundsLoading && (
                        <div className="mt-3 p-3.5 bg-white rounded-xl border border-gray-200 shadow-sm flex items-center justify-between text-xs">
                          <span className="font-bold text-gray-900 flex items-center gap-1.5">
                            <RotateCcw size={13} className="text-[#8b1327]" /> PayMongo Refund Audit
                          </span>
                          <span className="text-[10px] font-bold text-gray-500">
                            Loading refund status...
                          </span>
                        </div>
                      )}
                      {matchingRefund && (
                        <div className="mt-3 p-3.5 bg-white rounded-xl border border-gray-200 shadow-sm space-y-2 text-xs">
                          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                            <span className="font-bold text-gray-900 flex items-center gap-1.5">
                              <RotateCcw size={13} className="text-[#8b1327]" /> PayMongo Refund Audit
                            </span>
                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                ["succeeded", "completed"].includes(matchingRefund.status)
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                  : ["failed", "rejected"].includes(matchingRefund.status)
                                  ? "bg-red-100 text-red-800 border border-red-200"
                                  : "bg-amber-100 text-amber-800 border border-amber-200 animate-pulse"
                              }`}
                            >
                              {getRefundStatusLabel(matchingRefund.status)}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600">
                            <div>
                              <span className="text-gray-400 block text-[10px] uppercase font-bold">Booking Code</span>
                              <strong className="text-gray-800 font-mono">{reservation.reservation_code || "—"}</strong>
                            </div>
                            <div>
                              <span className="text-gray-400 block text-[10px] uppercase font-bold">Customer Name</span>
                              <strong className="text-gray-800 truncate block">{reservation.customer_name || "Guest"}</strong>
                            </div>
                            <div>
                              <span className="text-gray-400 block text-[10px] uppercase font-bold">Original Paid</span>
                              <strong className="text-gray-800">₱{Number(payment.amount || 0).toLocaleString()}</strong>
                            </div>
                            <div>
                              <span className="text-gray-400 block text-[10px] uppercase font-bold">Refund Amount</span>
                              <strong className="text-emerald-700">₱{Number(matchingRefund.amount || payment.amount || 0).toLocaleString()}</strong>
                            </div>
                            <div>
                              <span className="text-gray-400 block text-[10px] uppercase font-bold">Refund Reason</span>
                              <strong className="text-gray-800 capitalize">{(matchingRefund.reason || "requested_by_customer").replace(/_/g, " ")}</strong>
                            </div>
                            <div>
                              <span className="text-gray-400 block text-[10px] uppercase font-bold">Refund Reference</span>
                              <strong className="text-gray-800 font-mono text-[10px] truncate block">{matchingRefund.paymongo_refund_id || "Awaiting Ref"}</strong>
                            </div>
                          </div>

                          {matchingRefund.admin_email && (
                            <div className="text-[10px] text-gray-500 pt-1 border-t border-gray-100">
                              Authorized by: <strong className="text-gray-700">{matchingRefund.admin_email}</strong>
                            </div>
                          )}

                          {/* Reconcile button if pending or processing */}
                          {isAdmin &&
                            ["pending", "processing", "ambiguous"].includes(matchingRefund.status) &&
                            matchingRefund.paymongo_refund_id?.startsWith("ref_") && (
                            <button
                              type="button"
                              onClick={() => handleReconcile(matchingRefund.paymongo_refund_id)}
                              disabled={reconciling}
                              className="mt-1 w-full bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 py-1.5 px-3 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5"
                            >
                              <RefreshCw size={12} className={reconciling ? "animate-spin" : ""} />
                              Sync / Reconcile with PayMongo
                            </button>
                          )}
                        </div>
                      )}

                      {payment.receipt_url && !payment.receipt_url.includes("paymongo") && (
                        <div className="mt-3">
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Proof of Payment</p>
                          <a href={payment.receipt_url} target="_blank" rel="noopener noreferrer" className="block hover:opacity-90 transition-opacity">
                            <img src={payment.receipt_url} alt="Receipt Screenshot" className="max-w-full h-32 object-contain rounded-lg border border-gray-200 bg-white shadow-sm" />
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
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

        {/* Actions Footer (Cashier / Admin / Manager) */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-2">
          <a
            href={`/receipt/${reservation.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-[#3d0a14] hover:bg-[#5c1020] text-white rounded-xl transition-all shadow-sm"
          >
            <Printer size={14} /> Print Customer Receipt
          </a>

          {isAdmin && onUpdateStatus && (
            <div className="flex items-center gap-2">
              {currentStatus !== "confirmed" && currentStatus !== "cancelled" && (
                <button
                  onClick={() => onUpdateStatus(reservation.id, "confirmed")}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors shadow-sm"
                >
                  <CheckCircle size={14} /> Confirm
                </button>
              )}
              {currentStatus !== "cancelled" && (
                <button
                  onClick={() => onUpdateStatus(reservation.id, "cancelled")}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors shadow-sm"
                >
                  <XCircle size={14} /> Cancel
                </button>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
