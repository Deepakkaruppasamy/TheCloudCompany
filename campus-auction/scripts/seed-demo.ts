/**
 * scripts/seed-demo.ts
 *
 * Seeds demo data into the demo Supabase project.
 * Repeatable and safe to rerun.
 * Requires all DEMO_* env vars.
 * Never logs passwords or secrets.
 */
import "./load-env";
import { createClient } from "@supabase/supabase-js";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") throw new Error(`[seed-demo] Missing env: "${name}"`);
  return v.trim();
}

function randomUUID(): string {
  return crypto.randomUUID();
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Demo credentials
  const accounts = [
    { email: requireEnv("DEMO_SELLER_1_EMAIL"), password: requireEnv("DEMO_SELLER_1_PASSWORD"), displayName: "Alex Seller" },
    { email: requireEnv("DEMO_SELLER_2_EMAIL"), password: requireEnv("DEMO_SELLER_2_PASSWORD"), displayName: "Sam Seller" },
    { email: requireEnv("DEMO_BIDDER_1_EMAIL"), password: requireEnv("DEMO_BIDDER_1_PASSWORD"), displayName: "Jordan Bidder" },
    { email: requireEnv("DEMO_BIDDER_2_EMAIL"), password: requireEnv("DEMO_BIDDER_2_PASSWORD"), displayName: "Riley Bidder" },
  ];

  const userIds: Record<string, string> = {};

  // Step 1: Create or get demo Auth users
  for (const account of accounts) {
    console.log(`[seed-demo] Ensuring user: ${account.email}`);
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: { display_name: account.displayName },
    });

    if (createErr && !createErr.message.includes("already been registered") && !createErr.message.includes("already exists")) {
      console.error(`[seed-demo] Failed to create ${account.email}:`, createErr.message);
      continue;
    }

    let userId = created?.user?.id;

    if (!userId) {
      const { data: list } = await admin.auth.admin.listUsers();
      const found = list?.users?.find((u) => u.email === account.email);
      userId = found?.id;
    }

    if (!userId) {
      console.error(`[seed-demo] Could not find user ID for ${account.email}`);
      continue;
    }

    userIds[account.email] = userId;

    // Ensure profile is verified and active (service role)
    await admin.from("profiles").upsert({
      id: userId,
      display_name: account.displayName,
      is_verified: true,
      account_status: "active",
    });

    console.log(`[seed-demo] User ready: ${account.email} (${userId})`);
  }

  const seller1Id = userIds[requireEnv("DEMO_SELLER_1_EMAIL")];
  const seller2Id = userIds[requireEnv("DEMO_SELLER_2_EMAIL")];
  const bidder1Id = userIds[requireEnv("DEMO_BIDDER_1_EMAIL")];
  const bidder2Id = userIds[requireEnv("DEMO_BIDDER_2_EMAIL")];

  if (!seller1Id || !seller2Id || !bidder1Id || !bidder2Id) {
    throw new Error("[seed-demo] Not all user IDs are available. Aborting.");
  }

  async function clientFor(email: string, password: string) {
    const c = createClient(url, anonKey);
    const { error } = await c.auth.signInWithPassword({ email, password });
    if (error) throw new Error(`[seed-demo] Sign-in failed for ${email}: ${error.message}`);
    return c;
  }

  const now = new Date();
  const inMin = (m: number) => new Date(now.getTime() + m * 60_000).toISOString();
  const agoMin = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();

  // Step 2: Create listings as sellers
  const seller1Client = await clientFor(requireEnv("DEMO_SELLER_1_EMAIL"), requireEnv("DEMO_SELLER_1_PASSWORD"));
  const seller2Client = await clientFor(requireEnv("DEMO_SELLER_2_EMAIL"), requireEnv("DEMO_SELLER_2_PASSWORD"));

  async function createAuction(client: any, params: Record<string, unknown>) {
    const { data, error } = await (client.rpc as any)("create_auction", params);
    if (error) {
      console.warn(`[seed-demo] create_auction warning: ${error.message}`);
      return null;
    }
    return data as string;
  }

  console.log("[seed-demo] Creating auctions...");

  // Auction 1: closing soon (5 min), no bids
  const a1 = await createAuction(seller1Client, {
    title: "Scientific Calculator TI-84",
    description: "Texas Instruments TI-84 Plus graphing calculator. Perfect condition, barely used. Great for engineering courses.",
    category: "calculator",
    condition: "like_new",
    starting_price_paise: 250000,
    minimum_increment_paise: 5000,
    opens_at: agoMin(60),
    closes_at: inMin(5),
    photo_path: null,
  });

  // Auction 2: closing in 2 hours, has bids
  const a2 = await createAuction(seller1Client, {
    title: "Mountain Bike - Trek 3500",
    description: "Trek 3500 mountain bike in good condition. 21-speed Shimano gears, new tires. Perfect for campus commute.",
    category: "cycle",
    condition: "good",
    starting_price_paise: 500000,
    minimum_increment_paise: 10000,
    opens_at: agoMin(120),
    closes_at: inMin(120),
    photo_path: null,
  });

  // Auction 3: closing in 1 hour, competitive bids
  const a3 = await createAuction(seller2Client, {
    title: "Python Programming Book Bundle",
    description: "Set of 4 Python programming books including Python Crash Course, Automate the Boring Stuff, and more. All in excellent condition.",
    category: "books",
    condition: "like_new",
    starting_price_paise: 100000,
    minimum_increment_paise: 2000,
    opens_at: agoMin(180),
    closes_at: inMin(60),
    photo_path: null,
  });

  // Auction 4: closing in 24 hours, no bids
  const a4 = await createAuction(seller2Client, {
    title: "Laptop Stand & USB Hub Combo",
    description: "Adjustable aluminum laptop stand with a 4-port USB 3.0 hub. Compatible with most laptops. Barely used.",
    category: "electronics",
    condition: "like_new",
    starting_price_paise: 150000,
    minimum_increment_paise: 5000,
    opens_at: agoMin(30),
    closes_at: inMin(1440),
    photo_path: null,
  });

  // Auction 5: closing in 3 days
  const a5 = await createAuction(seller1Client, {
    title: "Engineering Drawing Set",
    description: "Complete set of engineering drawing instruments including compass, set squares, protractor, and more. Never used.",
    category: "other",
    condition: "new",
    starting_price_paise: 80000,
    minimum_increment_paise: 1000,
    opens_at: agoMin(60),
    closes_at: inMin(4320),
    photo_path: null,
  });

  // Auction 6: closing in 5 days
  const a6 = await createAuction(seller2Client, {
    title: "Data Structures Textbook",
    description: "Introduction to Algorithms by CLRS, 3rd Edition. Some highlighting in first 3 chapters, otherwise clean.",
    category: "books",
    condition: "good",
    starting_price_paise: 120000,
    minimum_increment_paise: 2000,
    opens_at: agoMin(60),
    closes_at: inMin(7200),
    photo_path: null,
  });

  console.log("[seed-demo] Auctions created:", { a1, a2, a3, a4, a5, a6 });

  // Step 3: Place bids
  const bidder1Client = await clientFor(requireEnv("DEMO_BIDDER_1_EMAIL"), requireEnv("DEMO_BIDDER_1_PASSWORD"));
  const bidder2Client = await clientFor(requireEnv("DEMO_BIDDER_2_EMAIL"), requireEnv("DEMO_BIDDER_2_PASSWORD"));

  async function placeBid(client: any, auctionId: string, amountPaise: number) {
    if (!auctionId) return;
    const { data, error } = await (client.rpc as any)("place_bid", {
      auction_id: auctionId,
      amount_paise: amountPaise,
      idempotency_key: randomUUID(),
    });
    if (error) console.warn(`[seed-demo] place_bid warning: ${error.message}`);
    return data;
  }

  if (a2) {
    await placeBid(bidder1Client, a2, 510000);
    await placeBid(bidder2Client, a2, 620000);
    console.log("[seed-demo] Bids placed on auction a2");
  }

  if (a3) {
    await placeBid(bidder1Client, a3, 105000);
    await placeBid(bidder2Client, a3, 130000);
    await placeBid(bidder1Client, a3, 160000);
    console.log("[seed-demo] Bids placed on auction a3");
  }

  console.log("[seed-demo] Seeding complete!");
}

main().catch((err) => {
  console.error("[seed-demo] Fatal:", err.message);
  process.exit(1);
});
