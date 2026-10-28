import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/server/admin";
import { checkReconcileRateLimit } from "@/lib/rate-limit";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  // Constant-time secret comparison
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const expected = process.env.RECONCILE_SECRET ?? "";

  let authorized = false;
  if (token.length > 0 && expected.length > 0 && token.length === expected.length) {
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    authorized = a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await checkReconcileRateLimit(10);
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a minute." },
      { status: 429 }
    );
  }

  try {
    const admin = getAdminClient();
    const { data, error } = await admin.rpc("process_expired", {
      batch_size: 50,
    } as any);

    if (error) {
      console.error("[reconcile] process_expired error:", error.message);
      return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, result: data });
  } catch (err) {
    console.error(
      "[reconcile] unexpected error:",
      err instanceof Error ? err.message : "unknown"
    );
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
