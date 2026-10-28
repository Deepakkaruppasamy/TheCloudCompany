"use client";

import { useTransition } from "react";
import { markRead } from "@/actions/notifications";
import { formatRelativeTime } from "@/lib/time";
import type { Database } from "@/types/database";

type Notification = Database["public"]["Tables"]["notifications"]["Row"];

const TYPE_ICONS: Record<string, string> = {
  auction_won: "🏆",
  auction_unsold: "📦",
  seller_approval_needed: "⏳",
  seller_approved: "✅",
  seller_rejected: "❌",
  seller_unresponsive: "⚠️",
  pickup_deadline: "⏰",
  failed_pickup: "🚫",
  handover_completed: "🤝",
  auction_cancelled: "🛑",
  outbid: "⚡",
  closing_soon: "🔔",
};

export default function NotificationItem({
  notification,
}: {
  notification: Notification;
}) {
  const [isPending, startTransition] = useTransition();
  const isUnread = !notification.read_at;

  return (
    <div
      className={`p-4 flex items-start justify-between gap-4 transition-colors ${
        isUnread ? "bg-brand-500/10" : "hover:bg-white/2"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl">
          {TYPE_ICONS[notification.type] ?? "📣"}
        </span>
        <div>
          <p className={`text-sm ${isUnread ? "text-white font-medium" : "text-white/80"}`}>
            {notification.message}
          </p>
          <p className="text-xs text-white/40 mt-1">
            {formatRelativeTime(notification.created_at)}
          </p>
        </div>
      </div>

      {isUnread && (
        <button
          onClick={() => {
            startTransition(async () => {
              await markRead(notification.id);
            });
          }}
          disabled={isPending}
          className="btn btn-ghost btn-sm text-xs text-brand-300 hover:text-brand-200"
        >
          {isPending ? "..." : "Mark Read"}
        </button>
      )}
    </div>
  );
}
