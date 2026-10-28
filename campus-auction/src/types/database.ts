/**
 * src/types/database.ts
 *
 * Supabase database type definitions.
 * Generated from the schema; keep in sync with migrations.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          role: "student" | "admin";
          is_verified: boolean;
          account_status: "active" | "suspended";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          role?: "student" | "admin";
          is_verified?: boolean;
          account_status?: "active" | "suspended";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string;
        };
      };
      system_config: {
        Row: {
          key: "seller_response_seconds" | "pickup_seconds";
          value_seconds: number;
          updated_at: string;
        };
        Insert: {
          key: "seller_response_seconds" | "pickup_seconds";
          value_seconds: number;
          updated_at?: string;
        };
        Update: {
          value_seconds?: number;
          updated_at?: string;
        };
      };
      auctions: {
        Row: {
          id: string;
          seller_id: string;
          title: string;
          description: string;
          category: "cycle" | "calculator" | "books" | "electronics" | "other";
          condition: "new" | "like_new" | "good" | "fair" | "for_parts";
          photo_path: string | null;
          starting_price_paise: number;
          minimum_increment_paise: number;
          current_price_paise: number | null;
          opens_at: string;
          closes_at: string;
          status:
            | "active"
            | "closed_unsold"
            | "pending_seller_approval"
            | "reserved"
            | "rejected"
            | "seller_unresponsive"
            | "failed_pickup"
            | "completed"
            | "cancelled_by_seller";
          first_bid_at: string | null;
          cancelled_at: string | null;
          cancellation_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never; // Use create_auction RPC
        Update: never; // Use edit_auction RPC
      };
      bids: {
        Row: {
          id: string;
          auction_id: string;
          bidder_id: string;
          amount_paise: number;
          placed_at: string;
          idempotency_key: string;
        };
        Insert: never; // Use place_bid RPC
        Update: never;
      };
      transactions: {
        Row: {
          id: string;
          auction_id: string;
          winner_id: string;
          winning_bid_id: string;
          final_amount_paise: number;
          status:
            | "pending_seller_approval"
            | "reserved"
            | "rejected"
            | "seller_unresponsive"
            | "failed_pickup"
            | "completed";
          seller_response_deadline_at: string;
          pickup_deadline_at: string | null;
          seller_decision: "approved" | "rejected" | null;
          seller_decided_at: string | null;
          seller_confirmed_at: string | null;
          winner_confirmed_at: string | null;
          outcome_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never; // Created by close_auction RPC
        Update: never;
      };
      notifications: {
        Row: {
          id: string;
          recipient_id: string;
          type:
            | "auction_won"
            | "auction_unsold"
            | "seller_approval_needed"
            | "seller_approved"
            | "seller_rejected"
            | "seller_unresponsive"
            | "pickup_deadline"
            | "failed_pickup"
            | "handover_completed"
            | "auction_cancelled"
            | "outbid"
            | "closing_soon";
          auction_id: string | null;
          transaction_id: string | null;
          bid_id: string | null;
          message: string;
          created_at: string;
          read_at: string | null;
        };
        Insert: never; // Created by DB functions only
        Update: {
          read_at?: string;
        };
      };
      expiry_runs: {
        Row: {
          id: string;
          started_at: string;
          finished_at: string | null;
          status: "ok" | "error";
          processed_count: number;
          error_count: number;
          error_summary: string | null;
        };
        Insert: never;
        Update: never;
      };
      reconcile_rate_limits: {
        Row: {
          window_start: string;
          count: number;
        };
        Insert: never;
        Update: never;
      };
    };
    Views: {
      public_profiles: {
        Row: {
          id: string;
          display_name: string;
        };
      };
      bid_history: {
        Row: {
          auction_id: string;
          display_name: string;
          amount_paise: number;
          placed_at: string;
        };
      };
    };
    Functions: {
      create_auction: {
        Args: {
          title: string;
          description: string;
          category: string;
          condition: string;
          starting_price_paise: number;
          minimum_increment_paise: number;
          opens_at: string;
          closes_at: string;
          photo_path?: string | null;
        };
        Returns: string; // UUID
      };
      edit_auction: {
        Args: {
          auction_id: string;
          title: string;
          description: string;
          category: string;
          condition: string;
          photo_path?: string | null;
        };
        Returns: void;
      };
      place_bid: {
        Args: {
          auction_id: string;
          amount_paise: number;
          idempotency_key: string;
        };
        Returns: Json;
      };
      close_auction: {
        Args: { auction_id: string };
        Returns: Json;
      };
      approve_auction: {
        Args: { transaction_id: string };
        Returns: Json;
      };
      reject_auction: {
        Args: { transaction_id: string; reason: string };
        Returns: Json;
      };
      confirm_handover: {
        Args: { transaction_id: string };
        Returns: Json;
      };
      cancel_auction: {
        Args: { auction_id: string; reason: string };
        Returns: Json;
      };
      process_expired: {
        Args: { batch_size?: number };
        Returns: Json;
      };
      reconcile_rate_check: {
        Args: { max_per_minute: number };
        Returns: boolean;
      };
      public_stats: {
        Args: Record<string, never>;
        Returns: Json;
      };
      is_eligible_user: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
