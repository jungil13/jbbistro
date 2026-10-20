const refundStatusLabels: Record<string, string> = {
  requested: "Pending review",
  approved: "Approved - not processed",
  processing: "Processing",
  pending: "Awaiting PayMongo",
  ambiguous: "Needs reconciliation",
  completed: "Completed",
  succeeded: "Completed",
  failed: "Failed",
  rejected: "Rejected",
};

export function getRefundStatusLabel(status: string): string {
  return (
    refundStatusLabels[status.toLowerCase()] ??
    status.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase())
  );
}
