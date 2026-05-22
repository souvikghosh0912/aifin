/**
 * Hand-typed Database stub. Replace with output of
 *   supabase gen types typescript --linked > src/types/database.ts
 * once your Supabase project is set up.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Exchange = "NSE" | "BSE";
export type TxnSide = "BUY" | "SELL";
export type AiReportKind = "weekly" | "monthly" | "forecast";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          base_currency: string;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          base_currency?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      portfolios: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          is_default: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          is_default?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["portfolios"]["Insert"]>;
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          portfolio_id: string;
          symbol: string;
          exchange: Exchange;
          side: TxnSide;
          quantity: number;
          price: number;
          fees: number;
          traded_at: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          portfolio_id: string;
          symbol: string;
          exchange: Exchange;
          side: TxnSide;
          quantity: number;
          price: number;
          fees?: number;
          traded_at: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["transactions"]["Insert"]>;
        Relationships: [];
      };
      watchlist_items: {
        Row: {
          id: string;
          user_id: string;
          symbol: string;
          exchange: Exchange;
          added_at: string;
          notes: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          symbol: string;
          exchange: Exchange;
          added_at?: string;
          notes?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["watchlist_items"]["Insert"]
        >;
        Relationships: [];
      };
      quote_cache: {
        Row: {
          symbol: string;
          exchange: Exchange;
          payload: Json;
          fetched_at: string;
        };
        Insert: {
          symbol: string;
          exchange: Exchange;
          payload: Json;
          fetched_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["quote_cache"]["Insert"]>;
        Relationships: [];
      };
      ai_conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["ai_conversations"]["Insert"]
        >;
        Relationships: [];
      };
      ai_messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: "user" | "assistant" | "system";
          content: string;
          tokens: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: "user" | "assistant" | "system";
          content: string;
          tokens?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ai_messages"]["Insert"]>;
        Relationships: [];
      };
      ai_reports: {
        Row: {
          id: string;
          user_id: string;
          kind: AiReportKind;
          content: string;
          period_start: string;
          period_end: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          kind: AiReportKind;
          content: string;
          period_start: string;
          period_end: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ai_reports"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      holdings_view: {
        Row: {
          user_id: string;
          portfolio_id: string;
          symbol: string;
          exchange: Exchange;
          quantity: number;
          avg_cost: number;
          invested_value: number;
          realized_pnl: number;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: {
      exchange: Exchange;
      txn_side: TxnSide;
      ai_report_kind: AiReportKind;
    };
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Inserts<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type Views<T extends keyof Database["public"]["Views"]> =
  Database["public"]["Views"][T]["Row"];
