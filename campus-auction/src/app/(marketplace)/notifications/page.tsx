import { requireUser } from "@/lib/auth/session";
import { getNotifications } from "@/data/notifications";
import NotificationItem from "./_notification-item";
import BrowserNotifications from "@/components/browser-notifications";
import { IconBell } from "@/components/ui/icons";

export const metadata = {
  title: "Notifications | Campus Auction",
};

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await getNotifications(user.id).catch(() => []);
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <div className="page-container max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title">Notifications</h1>
          <p className="section-subtitle">
            Outbid alerts, auction closure notices, and pickup schedules
          </p>
        </div>
        {unreadCount > 0 && (
          <span className="badge badge-active text-xs">
            {unreadCount} unread
          </span>
        )}
      </div>

      <BrowserNotifications userId={user.id} variant="banner" />

      {notifications.length === 0 ? (
        <div className="glass p-16 text-center text-white/40 rounded-3xl border border-white/[0.08]">
          <span className="text-4xl block mb-3 opacity-40">🔔</span>
          <p className="text-white font-medium text-base">You are all caught up!</p>
          <p className="text-xs text-white/40 mt-1">
            Notifications about your bids, listings, and pickups will appear here.
          </p>
        </div>
      ) : (
        <div className="glass overflow-hidden rounded-2xl border border-white/[0.08] divide-y divide-white/[0.06]">
          {notifications.map((notif) => (
            <NotificationItem key={notif.id} notification={notif} />
          ))}
        </div>
      )}
    </div>
  );
}
