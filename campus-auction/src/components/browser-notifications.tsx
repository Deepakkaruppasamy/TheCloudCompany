"use client";
/**
 * src/components/browser-notifications.tsx
 *
 * Browser Web Notifications manager.
 * - Requests browser notification permission.
 * - Listens for new notification events via Supabase Realtime & background sync.
 * - Fires native browser Notification pop-ups when tab is in the background.
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { IconBell, IconCheck } from "./ui/icons";

interface BrowserNotificationsProps {
  userId?: string | null;
  variant?: "banner" | "listener";
}

export default function BrowserNotifications({
  userId,
  variant = "banner",
}: BrowserNotificationsProps) {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [supported, setSupported] = useState(false);
  const lastNotifiedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!supported) return;
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted") {
        new Notification("Campus Auction Alerts Active", {
          body: "You will now receive instant pop-up alerts when outbid or when an auction closes!",
          icon: "🏛️",
        });
      }
    } catch (err) {
      console.error("Failed to request notification permission", err);
    }
  }, [supported]);

  const showPopup = useCallback((message: string, type?: string) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    // Only fire pop-up if document is in background or tab is hidden
    try {
      const n = new Notification("Campus Auction Alert 🔔", {
        body: message,
        icon: "🏛️",
        tag: "campus-auction-" + Date.now(),
      });

      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch (err) {
      console.error("Error displaying notification popup", err);
    }
  }, []);

  // Subscribe to real-time notifications for the signed-in student
  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();

    // 1. Supabase Realtime Channel
    const channel = supabase
      .channel(`user-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        (payload: any) => {
          const newNotif = payload.new;
          if (newNotif && newNotif.id !== lastNotifiedIdRef.current) {
            lastNotifiedIdRef.current = newNotif.id;
            if (document.hidden) {
              showPopup(newNotif.message, newNotif.type);
            }
          }
        }
      )
      .subscribe();

    // 2. Fallback polling check every 20 seconds for background tabs
    const interval = setInterval(async () => {
      if (!document.hidden || Notification.permission !== "granted") return;

      const { data } = await supabase
        .from("notifications")
        .select("id, message, type, created_at")
        .eq("recipient_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);

      const items = data as Array<{ id: string; message: string; type: string; created_at: string }> | null;
      if (items && items.length > 0) {
        const latest = items[0];
        // If newer than 30 seconds and not already popped
        const ageMs = Date.now() - new Date(latest.created_at).getTime();
        if (ageMs < 30_000 && latest.id !== lastNotifiedIdRef.current) {
          lastNotifiedIdRef.current = latest.id;
          showPopup(latest.message, latest.type);
        }
      }
    }, 20_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [userId, showPopup]);

  if (!supported || !userId || variant === "listener") {
    return null;
  }

  // Render a subtle permission banner on notification / profile pages
  return (
    <div className="glass p-4 rounded-2xl border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-300">
          <IconBell className="w-4 h-4" />
        </div>
        <div>
          <p className="text-xs font-semibold text-white">Browser Pop-up Notifications</p>
          <p className="text-[11px] text-white/50 mt-0.5">
            {permission === "granted"
              ? "Enabled — You will receive instant desktop alerts even when browsing in another tab."
              : permission === "denied"
              ? "Blocked in browser permissions. Enable notifications in your site settings to receive pop-up alerts."
              : "Allow desktop notifications so you never miss an outbid or closing deadline."}
          </p>
        </div>
      </div>

      <div>
        {permission === "granted" ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/15 text-emerald-300 text-xs font-semibold border border-emerald-500/30">
            <IconCheck className="w-3.5 h-3.5" />
            <span>Alerts Active</span>
          </span>
        ) : permission === "denied" ? (
          <span className="text-xs text-white/40 italic">Blocked</span>
        ) : (
          <button
            type="button"
            onClick={requestPermission}
            className="btn btn-primary btn-sm font-semibold whitespace-nowrap"
          >
            Allow Notifications
          </button>
        )}
      </div>
    </div>
  );
}
