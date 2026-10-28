"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type ProfileActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateProfile(params: {
  displayName: string;
  role: "buyer" | "seller" | "student";
}): Promise<ProfileActionResult> {
  const user = await requireUser();

  if (!params.displayName || params.displayName.trim().length < 2) {
    return { ok: false, error: "Display name must be at least 2 characters." };
  }
  if (params.displayName.trim().length > 60) {
    return { ok: false, error: "Display name cannot exceed 60 characters." };
  }

  const supabase = await createClient();
  const { error } = await (supabase.from("profiles") as any)
    .update({
      display_name: params.displayName.trim(),
      role: params.role,
    })
    .eq("id", user.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard/seller");
  revalidatePath("/dashboard/winner");
  return { ok: true };
}
