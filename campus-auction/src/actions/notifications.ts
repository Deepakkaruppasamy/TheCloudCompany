"use server";
/**
 * src/actions/notifications.ts
 *
 * Server Action for marking notifications as read.
 */
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { markNotificationRead } from "@/data/notifications";

export async function markRead(notificationId: string): Promise<void> {
  await requireUser();
  await markNotificationRead(notificationId);
  revalidatePath("/notifications");
}
