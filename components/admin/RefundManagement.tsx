"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  RotateCcw,
  X,
  XCircle,
  ChevronDown,
  User,
  Mail,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  getAdminRefundRequestsAction,
  processApprovedRefundAction,
  reconcilePayMongoRefundStatusAction,
  reviewRefundRequestAction,
} from "@/app/actions/refund";
import { getRefundStatusLabel } from "@/lib/refundStatus";
import { createClient } from "@/lib/supabase/client";

interface RefundRequest {
  id: string;
  reservation_id: string;
  payment_id: string;
  paymongo_payment_id: string;
  amount_centavos: number;
  reason: string;
  notes: string | null;
  status: string;
  admin_notes: string | null;
  failure_reason: string | null;
  provider_refund_id: string | null;
  created_at: string;
  decided_at?: string | null;
  reservations?: {
    reservation_code: string | null;
    customer_name: string | null;
    customer_email: string | null;
  } | null;
  payments?: {
    amount: number;
    status: string;
    reference_number: string | null;
  } | null;
}

type FilterStatus = "all" | "requested" | "approved" | "processing" | "completed" | "rejected" | "failed" | "ambiguous";

const dateTime = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "requested":  return "border-amber-200 bg-amber-50 text-amber-800";
    case "approved":   return "border-blue-200 bg-blue-50 text-blue-800";
    case "processing": return "border-purple-200 bg-purple-50 text-purple-800";
    case "pending":    return "border-indigo-200 bg-indigo-50 text-indigo-800";
    case "ambiguous":  return "border-orange-200 bg-orange-50 text-orange-800";
    case "completed":
    case "succeeded":  return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "failed":
    case "rejected":   return "border-red-200 bg-red-50 text-red-700";
    default:           return "border-gray-200 bg-gray-50 text-gray-700";
  }
}

const FILTER_TABS: { key: FilterStatus; label: string }[] = [
  { key: "all",        label: "All" },
  { key: "requested",  label: "Pending Review" },
  { key: "approved",   label: "Approved" },
  { key: "processing", label: "Processing" },
  { key: "completed",  label: "Completed" },
  { key: "rejected",   label: "Rejected" },
  { key: "failed",     label: "Failed" },
  { key: "ambiguous",  label: "Ambiguous" },
];

export default function RefundManagement() {
  const [requests, setRequests] = useState<RefundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [loadError, setLoadError] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    const result = await getAdminRefundRequestsAction();
    if (!result.success) {
      setLoadError(result.error || "Refund requests could not be loaded.");
      setRequests([]);
    } else {
      setLoadError("");
      setRequests(result.requests as RefundRequest[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadRequests();

    const supabase = createClient();
    const channel = supabase
      .channel("admin-refunds-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "refunds" },
        () => {
          void loadRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadRequests]);

  const reviewRequest = async (requestId: string, approve: boolean) => {
    if (!approve && !rejectionReason.trim()) {
      toast.error("Enter a reason before rejecting this request.");
      return;
    }
    setWorkingId(requestId);
    const result = await reviewRefundRequestAction({
      requestId,
      approve,
      rejectionReason,
    });
    if (!result.success) {
      toast.error(result.error || "Could not update the request.");
    } else {
      toast.success(approve ? "Refund request approved." : "Refund request rejected.");
      setRejectingId(null);
      setRejectionReason("");
      await loadRequests();
    }
    setWorkingId(null);
  };

  const processRefund = async (requestId: string) => {
    if (
      !window.confirm(
        "Process this approved refund through PayMongo now?\n\nThis will initiate the actual refund to the customer. The request will be locked against duplicate processing."
      )
    ) {
      return;
    }
    setWorkingId(requestId);
    const result = await processApprovedRefundAction(requestId, true);
    if (!result.success) {
      toast.error(result.error || "Refund could not be processed.");
    } else {
      toast.success(result.message || "Refund status updated.");
    }
    await loadRequests();
    setWorkingId(null);
  };

  const reconcileRefund = async (request: RefundRequest) => {
    if (!request.provider_refund_id) return;
    setWorkingId(request.id);
    const result = await reconcilePayMongoRefundStatusAction(
      request.reservation_id,
      request.provider_refund_id
    );
    if (!result.success) {
      toast.error(result.error || "Could not reconcile refund status.");
    } else {
      toast.success(result.message || "Refund status reconciled.");
    }
    await loadRequests();
    setWorkingId(null);
  };

  const filtered = requests.filter((r) => {
    if (filterStatus === "all") return true;
    if (filterStatus === "processing") return ["processing", "pending"].includes(r.status);
    if (filterStatus === "completed") return ["completed", "succeeded"].includes(r.status);
    return r.status === filterStatus;
  });

  const counts: Record<FilterStatus, number> = {
    all:        requests.length,
    requested:  requests.filter((r) => r.status === "requested").length,
    approved:   requests.filter((r) => r.status === "approved").length,
    processing: requests.filter((r) => ["processing", "pending"].includes(r.status)).length,
    completed:  requests.filter((r) => ["completed", "succeeded"].includes(r.status)).length,
    rejected:   requests.filter((r) => r.status === "rejected").length,
    failed:     requests.filter((r) => r.status === "failed").length,
    ambiguous:  requests.filter((r) => r.status === "ambiguous").length,
  };

  const pendingCount = counts.requested;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Refund Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review customer requests, approve or reject, then process approved refunds through PayMongo.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadRequests()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Info banner */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
        <AlertTriangle size={15} className="mr-1 inline-block align-[-3px]" />
        <strong>3-step workflow:</strong> (1) Approve or Reject the customer request &rarr; (2) Process the approved refund via PayMongo &rarr; (3) Reconcile if the response is ambiguous.
        Approval alone does <strong>not</strong> issue a refund.
      </div>

      {/* Pending badge */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 border border-amber-300 px-3 py-1 text-xs font-bold text-amber-800">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse inline-block" />
            {pendingCount} request{pendingCount === 1 ? "" : "s"} awaiting review
          </span>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {FILTER_TABS.map(({ key, label }) => {
          const count = counts[key];
          if (key !== "all" && count === 0) return null;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilterStatus(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all border ${
                filterStatus === key
                  ? "bg-[#8b1327] text-white border-[#8b1327] shadow-sm"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              {label}
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                filterStatus === key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white p-12 text-sm text-gray-500">
          <Loader2 size={18} className="animate-spin" /> Loading refund requests...
        </div>
      ) : loadError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {loadError}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-12 text-center text-sm text-gray-500">
          {filterStatus === "all"
            ? "No refund requests have been submitted."
            : `No ${filterStatus === "requested" ? "pending" : filterStatus} refund requests.`}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((request) => {
            const isExpanded = expandedId === request.id;
            const isWorking = workingId === request.id;

            return (
              <article
                key={request.id}
                className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden"
              >
                {/* Card header */}
                <div className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-[#3d0a14]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <User size={16} className="text-[#8b1327]" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="font-bold text-gray-900 text-sm">
                          {request.reservations?.customer_name || "Customer"}
                        </h2>
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <Mail size={11} />
                          {request.reservations?.customer_email || "No email on record"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${getStatusBadgeClass(request.status)}`}>
                        {getRefundStatusLabel(request.status)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : request.id)}
                        className="rounded-lg border border-gray-200 bg-gray-50 p-1.5 text-gray-500 hover:bg-gray-100 transition-colors"
                        aria-label={isExpanded ? "Collapse details" : "Expand details"}
                      >
                        <ChevronDown size={14} className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                      </button>
                    </div>
                  </div>

                  {/* Summary grid */}
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="bg-gray-50 rounded-lg p-2.5 text-xs">
                      <p className="text-gray-400 font-medium text-[10px] uppercase tracking-wide">Reservation</p>
                      <p className="font-mono font-bold text-gray-800 mt-0.5 truncate">
                        {request.reservations?.reservation_code || request.reservation_id.slice(0, 8).toUpperCase()}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5 text-xs">
                      <p className="text-gray-400 font-medium text-[10px] uppercase tracking-wide">Amount</p>
                      <p className="font-bold text-[#8b1327] mt-0.5">
                        {String.fromCharCode(8369)}{(Number(request.amount_centavos) / 100).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5 text-xs">
                      <p className="text-gray-400 font-medium text-[10px] uppercase tracking-wide">Reason</p>
                      <p className="capitalize text-gray-800 mt-0.5">
                        {request.reason.replace(/_/g, " ")}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5 text-xs">
                      <p className="text-gray-400 font-medium text-[10px] uppercase tracking-wide">Requested</p>
                      <p className="text-gray-800 mt-0.5">{dateTime(request.created_at)}</p>
                    </div>
                  </div>
                </div>

                {/* Expanded detail section */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50/60 p-4 sm:p-5 space-y-3">
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <dt className="text-gray-400 font-medium">PayMongo Payment ID</dt>
                        <dd className="mt-0.5 font-mono text-gray-700 break-all">
                          {request.paymongo_payment_id || "Not available"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-gray-400 font-medium">Payment Status</dt>
                        <dd className="mt-0.5 capitalize text-gray-800 font-semibold">
                          {request.payments?.status || "unknown"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-gray-400 font-medium">Payment Reference</dt>
                        <dd className="mt-0.5 font-mono text-gray-700 text-[11px]">
                          {request.payments?.reference_number || "—"}
                        </dd>
                      </div>
                      {request.decided_at && (
                        <div>
                          <dt className="text-gray-400 font-medium">Decision Date</dt>
                          <dd className="mt-0.5 text-gray-800">{dateTime(request.decided_at)}</dd>
                        </div>
                      )}
                      {request.provider_refund_id && (
                        <div className="sm:col-span-2 lg:col-span-3">
                          <dt className="text-gray-400 font-medium">PayMongo Refund ID</dt>
                          <dd className="mt-0.5 break-all font-mono text-emerald-700 font-semibold">
                            {request.provider_refund_id}
                          </dd>
                        </div>
                      )}
                    </dl>
                    {request.notes && (
                      <div className="rounded-lg bg-white border border-gray-200 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Customer Notes</p>
                        <p className="text-xs text-gray-700">{request.notes}</p>
                      </div>
                    )}
                    {request.admin_notes && (
                      <div className="rounded-lg bg-red-50 border border-red-100 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-red-400 mb-1">Admin Decision Reason</p>
                        <p className="text-xs text-red-700">{request.admin_notes}</p>
                      </div>
                    )}
                    {request.failure_reason && (
                      <div className="rounded-lg bg-orange-50 border border-orange-100 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-orange-400 mb-1">Provider Update</p>
                        <p className="text-xs text-orange-800">{request.failure_reason}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Action bar */}
                <div className="border-t border-gray-100 px-4 py-3 sm:px-5 flex flex-wrap gap-2 items-center bg-white">
                  {/* Step 1: Approve or Reject */}
                  {request.status === "requested" && (
                    <>
                      <button
                        type="button"
                        disabled={isWorking}
                        onClick={() => void reviewRequest(request.id, true)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50 shadow-sm"
                      >
                        <Check size={14} /> Approve
                      </button>
                      {rejectingId === request.id ? (
                        <form
                          className="flex w-full flex-wrap items-start gap-2 pt-1"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void reviewRequest(request.id, false);
                          }}
                        >
                          <textarea
                            value={rejectionReason}
                            onChange={(event) => setRejectionReason(event.target.value)}
                            maxLength={500}
                            required
                            rows={2}
                            placeholder="Required: rejection reason (will be shown to the customer)"
                            className="min-w-[240px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-100"
                          />
                          <button
                            type="submit"
                            disabled={isWorking || !rejectionReason.trim()}
                            className="inline-flex items-center gap-1 rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50 hover:bg-red-800"
                          >
                            <X size={13} /> Confirm Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRejectingId(null);
                              setRejectionReason("");
                            }}
                            className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setRejectingId(request.id);
                            setExpandedId(request.id);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
                        >
                          <X size={14} /> Reject
                        </button>
                      )}
                    </>
                  )}

                  {/* Step 2: Process via PayMongo */}
                  {request.status === "approved" && (
                    <button
                      type="button"
                      disabled={isWorking}
                      onClick={() => void processRefund(request.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#8b1327] px-3 py-2 text-xs font-bold text-white hover:bg-[#a1162e] disabled:opacity-50 shadow-sm"
                    >
                      <RotateCcw size={14} /> Process Refund via PayMongo
                    </button>
                  )}

                  {/* Step 3: Reconcile */}
                  {["pending", "ambiguous", "processing"].includes(request.status) &&
                    request.provider_refund_id && (
                      <button
                        type="button"
                        disabled={isWorking}
                        onClick={() => void reconcileRefund(request)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                      >
                        <Clock size={14} /> Reconcile with PayMongo
                      </button>
                    )}

                  {/* Ambiguous - no provider refund ID */}
                  {request.status === "ambiguous" && !request.provider_refund_id && (
                    <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                      <AlertTriangle size={13} />
                      No provider refund ID received — verify in PayMongo dashboard before further action.
                    </p>
                  )}

                  {/* Terminal state labels */}
                  {(request.status === "completed" || request.status === "succeeded") && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 size={14} /> Refund completed
                    </span>
                  )}
                  {request.status === "rejected" && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600">
                      <XCircle size={14} /> Request was rejected
                    </span>
                  )}
                  {request.status === "failed" && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600">
                      <XCircle size={14} /> PayMongo rejected this refund
                    </span>
                  )}

                  {/* Loading spinner */}
                  {isWorking && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 ml-auto">
                      <Loader2 size={13} className="animate-spin" /> Updating...
                    </span>
                  )}

                  {/* View / hide details link */}
                  {!isWorking && (
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : request.id)}
                      className="ml-auto text-xs text-gray-400 hover:text-gray-600 hover:underline underline-offset-2 transition-colors"
                    >
                      {isExpanded ? "Hide details" : "View details"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
