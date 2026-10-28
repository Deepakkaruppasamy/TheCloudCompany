/**
 * src/data/notifications.ts
 *
 * Supabase queries for notifications.
 */
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Notification = Database["public"]["Tables"]["notifications"]["Row"];

export async function getNotifications(recipientId: string): Promise<Notification[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("recipient_id", recipientId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("getNotifications error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getUnreadCount(recipientId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("recipient_id", recipientId)
    .is("read_at", null);
  if (error) return 0;
  return count ?? 0;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await (supabase.from("notifications") as any)
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);
  if (error) throw new Error(error.message);
}
