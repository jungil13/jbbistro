"use client";

import { useState } from "react";
import {
  X,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  Banknote,
  FileText,
  Clock,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  processPayMongoRefundAction,
  type RefundReason,
} from "@/app/actions/refund";

interface RefundModalProps {
  reservationId: string;
  reservationCode: string;
  customerName: string;
  paymentAmount: number;
  paymentId?: string;
  paymongoPaymentId: string;
  isTestMode?: boolean;
  onClose: () => void;
  onSuccess: (refundResult: any) => void;
}

export default function RefundModal({
  reservationId,
  reservationCode,
  customerName,
  paymentAmount,
  paymentId,
  paymongoPaymentId,
  isTestMode = true,
  onClose,
  onSuccess,
}: RefundModalProps) {
  const [reason, setReason] = useState<RefundReason>("requested_by_customer");
  const [notes, setNotes] = useState("");
  const [confirmUnderstood, setConfirmUnderstood] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [resultState, setResultState] = useState<{
    status: "succeeded" | "pending" | "processing" | "failed";
    message: string;
    refundId?: string;
  } | null>(null);

  const handleProcessRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (processing) return;

    if (!confirmUnderstood) {
      toast.error("Please check the confirmation box to authorize this refund.");
      return;
    }

    setProcessing(true);
    const toastId = toast.loading("Submitting refund request to PayMongo gateway...");

    try {
      const res = await processPayMongoRefundAction({
        reservationId,
        paymentId,
        reason,
        notes: notes.trim() || undefined,
      });

      toast.dismiss(toastId);

      if (res.success) {
        toast.success(res.message || "Refund successfully authorized!");
        setResultState({
          status: (res.status as any) || "succeeded",
          message: res.message || "Refund successfully authorized.",
          refundId: res.refundId,
        });
        // Notify parent
        onSuccess(res);
      } else {
        toast.error(res.error || "Refund request failed.");
        setResultState({
          status: "failed",
          message: res.error || "PayMongo rejected the refund request.",
        });
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(err.message || "An unexpected error occurred.");
      setResultState({
        status: "failed",
        message: err.message || "An unexpected error occurred.",
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#2a060e] via-[#4d0c1b] to-[#2a060e] text-white px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
              <RotateCcw size={18} />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
                Process PayMongo Refund
                <span
                  className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                    isTestMode
                      ? "bg-amber-400 text-amber-950"
                      : "bg-emerald-400 text-emerald-950"
                  }`}
                >
                  {isTestMode ? "Test Sandbox" : "Live Provider"}
                </span>
              </h3>
              <p className="text-xs text-white/70">
                Official online refund authorization
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={processing}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Post-processing Result View */}
        {resultState ? (
          <div className="p-6 sm:p-8 text-center space-y-4">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-sm ${
                resultState.status === "succeeded"
                  ? "bg-emerald-50 border-2 border-emerald-200 text-emerald-600"
                  : resultState.status === "failed"
                  ? "bg-red-50 border-2 border-red-200 text-red-600"
                  : "bg-amber-50 border-2 border-amber-200 text-amber-600"
              }`}
            >
              {resultState.status === "succeeded" && <CheckCircle2 size={36} />}
              {resultState.status === "failed" && <AlertTriangle size={36} />}
              {(resultState.status === "pending" || resultState.status === "processing") && <Clock size={36} />}
            </div>

            <div>
              <h4 className="text-lg font-bold text-gray-900">
                {resultState.status === "succeeded"
                  ? "Refund Succeeded!"
                  : resultState.status === "failed"
                  ? "Refund Failed"
                  : "Refund Processing"}
              </h4>
              <p className="text-xs text-gray-600 mt-1 max-w-sm mx-auto">
                {resultState.message}
              </p>
              {resultState.refundId && (
                <div className="mt-3 inline-block bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-mono text-gray-700">
                  PayMongo Ref: <strong className="text-emerald-700">{resultState.refundId}</strong>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-center">
              <button
                type="button"
                onClick={onClose}
                className="w-full max-w-xs bg-[#3d0a14] hover:bg-[#5c1020] text-white py-2.5 rounded-xl text-xs font-bold transition-all shadow-md"
              >
                Done &amp; Refresh Booking Details
              </button>
            </div>
          </div>
        ) : (
          /* Form View */
          <form onSubmit={handleProcessRefund} className="p-6 space-y-4 overflow-y-auto">
            {/* Booking & Payment Summary Card */}
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200/80 space-y-2 text-xs">
              <div className="flex justify-between items-center text-gray-600">
                <span>Booking Reference:</span>
                <span className="font-mono font-bold text-gray-900 bg-white px-2 py-0.5 rounded border border-gray-200">
                  {reservationCode}
                </span>
              </div>
              <div className="flex justify-between items-center text-gray-600">
                <span>Customer Name:</span>
                <span className="font-bold text-gray-900">{customerName}</span>
              </div>
              <div className="flex justify-between items-center text-gray-600">
                <span>PayMongo Payment ID:</span>
                <span className="font-mono text-gray-700">{paymongoPaymentId}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-200 text-sm font-extrabold text-[#3d0a14]">
                <span>Total Refund Amount:</span>
                <span className="text-[#8b1327] text-base">₱{paymentAmount.toLocaleString()}</span>
              </div>
            </div>

            {/* Refund Reason Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <FileText size={14} className="text-[#8b1327]" /> Refund Reason (Required by PayMongo)
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as RefundReason)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-medium bg-white focus:outline-none focus:border-[#8b1327] focus:ring-1 focus:ring-[#8b1327]"
              >
                <option value="requested_by_customer">
                  Customer Requested Cancellation
                </option>
                <option value="duplicate">
                  Duplicate Payment
                </option>
                <option value="fraudulent">
                  Fraudulent Activity
                </option>
                <option value="others">
                  Other / Manager Discretion
                </option>
              </select>
            </div>

            {/* Admin Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">
                Admin Audit Remarks / Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Customer rescheduled to next month, authorized by manager on duty"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-medium bg-white focus:outline-none focus:border-[#8b1327] focus:ring-1 focus:ring-[#8b1327]"
              />
            </div>

            {/* Warning Box */}
            <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3.5 flex items-start gap-2.5 text-[11px] text-amber-900 leading-relaxed">
              <ShieldAlert size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Permanent Return of Funds</p>
                <p className="mt-0.5 text-amber-800">
                  This issues a full refund of <strong>₱{paymentAmount.toLocaleString()}</strong> back to the customer's payment source. The reservation status will be updated to <strong>Cancelled</strong>.
                </p>
              </div>
            </div>

            {/* Confirmation Checkbox */}
            <label className="flex items-start gap-2.5 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={confirmUnderstood}
                onChange={(e) => setConfirmUnderstood(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#8b1327] focus:ring-[#8b1327]"
              />
              <span className="text-xs font-medium text-gray-700">
                I confirm that this booking is eligible and authorize PayMongo to refund this payment.
              </span>
            </label>

            {/* Buttons */}
            <div className="pt-3 border-t border-gray-100 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={processing}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={processing || !confirmUnderstood}
                className="flex-1 bg-[#8b1327] hover:bg-[#a1162e] text-white py-2.5 rounded-xl text-xs font-bold transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {processing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Processing Refund...
                  </>
                ) : (
                  <>
                    <RotateCcw size={14} /> Process Full Refund
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
