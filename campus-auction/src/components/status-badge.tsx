/**
 * src/components/status-badge.tsx
 *
 * Renders a styled badge for auction/transaction status.
 */
import type { AuctionStatus } from "@/domain/auctions";
import { STATUS_LABELS } from "@/domain/auctions";

const STATUS_CLASS: Record<AuctionStatus, string> = {
  active: "badge-active",
  closed_unsold: "badge-unsold",
  pending_seller_approval: "badge-pending",
  reserved: "badge-reserved",
  rejected: "badge-rejected",
  seller_unresponsive: "badge-rejected",
  failed_pickup: "badge-rejected",
  completed: "badge-completed",
  cancelled_by_seller: "badge-cancelled",
};

interface StatusBadgeProps {
  status: AuctionStatus;
  closingSoon?: boolean;
}

export default function StatusBadge({ status, closingSoon }: StatusBadgeProps) {
  if (status === "active" && closingSoon) {
    return (
      <span className="badge-closing-soon">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
        Closing Soon
      </span>
    );
  }
  return (
    <span className={STATUS_CLASS[status] ?? "badge"}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
