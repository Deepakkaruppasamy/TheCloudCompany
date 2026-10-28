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
      className={`p-4 sm:p-5 flex items-start justify-between gap-4 transition-colors ${
        isUnread
          ? "bg-brand-500/[0.08] hover:bg-brand-500/[0.12]"
          : "hover:bg-white/[0.02]"
      }`}
    >
      <div className="flex items-start gap-3.5">
        <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-lg shrink-0">
          {TYPE_ICONS[notification.type] ?? "📣"}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className={`text-sm ${isUnread ? "text-white font-semibold" : "text-white/80"}`}>
              {notification.message}
            </p>
            {isUnread && (
              <span className="w-2 h-2 rounded-full bg-brand-400 shrink-0" />
            )}
          </div>
          <p className="text-xs text-white/40 mt-1 font-mono">
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
          className="btn btn-ghost btn-sm text-xs text-brand-300 hover:text-white shrink-0"
        >
          {isPending ? "..." : "Mark Read"}
        </button>
      )}
    </div>
  );
}
