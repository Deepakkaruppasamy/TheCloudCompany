import { requireUser } from "@/lib/auth/session";
import { getNotifications } from "@/data/notifications";
import NotificationItem from "./_notification-item";

export const metadata = {
  title: "Notifications",
};

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await getNotifications(user.id);

  return (
    <div className="page-container max-w-4xl space-y-6">
      <div>
        <h1 className="section-title">Notifications</h1>
        <p className="section-subtitle">
          Auction updates, outbid alerts, and transaction milestones
        </p>
      </div>

      {notifications.length === 0 ? (
        <div className="glass p-12 text-center text-white/40">
          <span className="text-4xl block mb-2">🔔</span>
          <p>No notifications yet.</p>
        </div>
      ) : (
        <div className="glass overflow-hidden divide-y divide-white/5">
          {notifications.map((notif) => (
            <NotificationItem key={notif.id} notification={notif} />
          ))}
        </div>
      )}
    </div>
  );
}
