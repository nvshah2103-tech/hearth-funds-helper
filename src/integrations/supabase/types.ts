export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bank_accounts: {
        Row: {
          account_type: string
          bank_name: string | null
          created_at: string
          id: string
          name: string
          opening_balance: number
          user_id: string
        }
        Insert: {
          account_type?: string
          bank_name?: string | null
          created_at?: string
          id?: string
          name: string
          opening_balance?: number
          user_id: string
        }
        Update: {
          account_type?: string
          bank_name?: string | null
          created_at?: string
          id?: string
          name?: string
          opening_balance?: number
          user_id?: string
        }
        Relationships: []
      }
      business_incomes: {
        Row: {
          bank_account_id: string | null
          client_name: string
          created_at: string
          date: string
          id: string
          invoice_amount: number
          member_id: string | null
          net_received: number
          notes: string | null
          tds: number
          user_id: string
        }
        Insert: {
          bank_account_id?: string | null
          client_name: string
          created_at?: string
          date: string
          id?: string
          invoice_amount: number
          member_id?: string | null
          net_received: number
          notes?: string | null
          tds?: number
          user_id: string
        }
        Update: {
          bank_account_id?: string | null
          client_name?: string
          created_at?: string
          date?: string
          id?: string
          invoice_amount?: number
          member_id?: string | null
          net_received?: number
          notes?: string | null
          tds?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_incomes_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_incomes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_card_bills: {
        Row: {
          bank_account_id: string | null
          billing_month: string
          card_id: string
          created_at: string
          id: string
          notes: string | null
          payment_amount: number
          payment_date: string | null
          total_bill: number
          user_id: string
        }
        Insert: {
          bank_account_id?: string | null
          billing_month: string
          card_id: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_amount?: number
          payment_date?: string | null
          total_bill: number
          user_id: string
        }
        Update: {
          bank_account_id?: string | null
          billing_month?: string
          card_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_amount?: number
          payment_date?: string | null
          total_bill?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_card_bills_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_card_bills_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_cards: {
        Row: {
          bank_name: string | null
          created_at: string
          id: string
          member_id: string | null
          name: string
          user_id: string
        }
        Insert: {
          bank_name?: string | null
          created_at?: string
          id?: string
          member_id?: string | null
          name: string
          user_id: string
        }
        Update: {
          bank_name?: string | null
          created_at?: string
          id?: string
          member_id?: string | null
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_cards_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      emi_payments: {
        Row: {
          amount: number
          bank_account_id: string | null
          created_at: string
          emi_id: string
          id: string
          notes: string | null
          paid_date: string
          user_id: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          created_at?: string
          emi_id: string
          id?: string
          notes?: string | null
          paid_date: string
          user_id: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          emi_id?: string
          id?: string
          notes?: string | null
          paid_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emi_payments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emi_payments_emi_id_fkey"
            columns: ["emi_id"]
            isOneToOne: false
            referencedRelation: "emis"
            referencedColumns: ["id"]
          },
        ]
      }
      emis: {
        Row: {
          bank_account_id: string | null
          created_at: string
          due_day: number
          emi_amount: number
          end_date: string | null
          id: string
          lender: string | null
          name: string
          notes: string | null
          start_date: string | null
          status: string
          total_loan_amount: number
          user_id: string
        }
        Insert: {
          bank_account_id?: string | null
          created_at?: string
          due_day?: number
          emi_amount?: number
          end_date?: string | null
          id?: string
          lender?: string | null
          name: string
          notes?: string | null
          start_date?: string | null
          status?: string
          total_loan_amount?: number
          user_id: string
        }
        Update: {
          bank_account_id?: string | null
          created_at?: string
          due_day?: number
          emi_amount?: number
          end_date?: string | null
          id?: string
          lender?: string | null
          name?: string
          notes?: string | null
          start_date?: string | null
          status?: string
          total_loan_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emis_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      incomes: {
        Row: {
          amount: number
          bank_account_id: string | null
          created_at: string
          date: string
          id: string
          income_type: string
          linked_investment_id: string | null
          member_id: string | null
          net_amount: number
          notes: string | null
          tds: number
          user_id: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          created_at?: string
          date: string
          id?: string
          income_type: string
          linked_investment_id?: string | null
          member_id?: string | null
          net_amount: number
          notes?: string | null
          tds?: number
          user_id: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          date?: string
          id?: string
          income_type?: string
          linked_investment_id?: string | null
          member_id?: string | null
          net_amount?: number
          notes?: string | null
          tds?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incomes_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incomes_linked_investment_id_fkey"
            columns: ["linked_investment_id"]
            isOneToOne: false
            referencedRelation: "investments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incomes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      investments: {
        Row: {
          amount: number
          bank_account_id: string | null
          created_at: string
          date: string
          expected_maturity_amount: number | null
          fresh_topup_amount: number | null
          id: string
          institution: string | null
          investment_type: string
          linked_maturity_id: string | null
          maturity_date: string | null
          member_id: string | null
          notes: string | null
          source_of_funds: string
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          created_at?: string
          date: string
          expected_maturity_amount?: number | null
          fresh_topup_amount?: number | null
          id?: string
          institution?: string | null
          investment_type: string
          linked_maturity_id?: string | null
          maturity_date?: string | null
          member_id?: string | null
          notes?: string | null
          source_of_funds?: string
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          date?: string
          expected_maturity_amount?: number | null
          fresh_topup_amount?: number | null
          id?: string
          institution?: string | null
          investment_type?: string
          linked_maturity_id?: string | null
          maturity_date?: string | null
          member_id?: string | null
          notes?: string | null
          source_of_funds?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investments_linked_maturity_id_fkey"
            columns: ["linked_maturity_id"]
            isOneToOne: false
            referencedRelation: "investments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          created_at: string
          id: string
          is_business: boolean
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_business?: boolean
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_business?: boolean
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          family_name: string | null
          id: string
          onboarded: boolean
        }
        Insert: {
          created_at?: string
          family_name?: string | null
          id: string
          onboarded?: boolean
        }
        Update: {
          created_at?: string
          family_name?: string | null
          id?: string
          onboarded?: boolean
        }
        Relationships: []
      }
      transfers: {
        Row: {
          amount: number
          created_at: string
          date: string
          from_account_id: string
          id: string
          reason: string | null
          to_account_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          date: string
          from_account_id: string
          id?: string
          reason?: string | null
          to_account_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          from_account_id?: string
          id?: string
          reason?: string | null
          to_account_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfers_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
