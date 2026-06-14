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
          import_password_hint: string | null
          known_broker_account: boolean
          last_imported_until: string | null
          name: string
          opening_balance: number
          user_id: string
        }
        Insert: {
          account_type?: string
          bank_name?: string | null
          created_at?: string
          id?: string
          import_password_hint?: string | null
          known_broker_account?: boolean
          last_imported_until?: string | null
          name: string
          opening_balance?: number
          user_id: string
        }
        Update: {
          account_type?: string
          bank_name?: string | null
          created_at?: string
          id?: string
          import_password_hint?: string | null
          known_broker_account?: boolean
          last_imported_until?: string | null
          name?: string
          opening_balance?: number
          user_id?: string
        }
        Relationships: []
      }
      broker_connections: {
        Row: {
          broker_name: string
          created_at: string
          encrypted_api_key: string
          encrypted_api_secret: string
          extra_meta: Json | null
          id: string
          last_synced_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          broker_name: string
          created_at?: string
          encrypted_api_key: string
          encrypted_api_secret: string
          extra_meta?: Json | null
          id?: string
          last_synced_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          broker_name?: string
          created_at?: string
          encrypted_api_key?: string
          encrypted_api_secret?: string
          extra_meta?: Json | null
          id?: string
          last_synced_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      broker_transactions: {
        Row: {
          amount: number
          broker_name: string
          created_at: string
          id: string
          is_payout: boolean
          linked_bank_transaction_id: string | null
          price: number | null
          quantity: number | null
          raw_data: Json | null
          segment: string | null
          symbol: string | null
          trade_date: string
          transaction_type: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          broker_name: string
          created_at?: string
          id?: string
          is_payout?: boolean
          linked_bank_transaction_id?: string | null
          price?: number | null
          quantity?: number | null
          raw_data?: Json | null
          segment?: string | null
          symbol?: string | null
          trade_date: string
          transaction_type?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          broker_name?: string
          created_at?: string
          id?: string
          is_payout?: boolean
          linked_bank_transaction_id?: string | null
          price?: number | null
          quantity?: number | null
          raw_data?: Json | null
          segment?: string | null
          symbol?: string | null
          trade_date?: string
          transaction_type?: string | null
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
          tds_expected: number | null
          tds_rate: number | null
          tds_section: string | null
          tds_section_confirmed: boolean
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
          tds_expected?: number | null
          tds_rate?: number | null
          tds_section?: string | null
          tds_section_confirmed?: boolean
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
          tds_expected?: number | null
          tds_rate?: number | null
          tds_section?: string | null
          tds_section_confirmed?: boolean
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
      expense_categories: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          is_default: boolean
          name: string
          sort_order: number
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_default?: boolean
          name: string
          sort_order?: number
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_default?: boolean
          name?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          cheque_number: string | null
          created_at: string
          date: string
          fingerprint_hash: string | null
          gst_number: string | null
          id: string
          import_batch_id: string | null
          is_business_expense: boolean
          is_imported: boolean
          is_recurring: boolean
          member_id: string | null
          note: string | null
          paid_from_account_id: string | null
          paid_to_name: string | null
          payment_method: string | null
          receipt_number: string | null
          receipt_url: string | null
          recurring_end_date: string | null
          recurring_frequency: string | null
          tags: string[] | null
          time: string | null
          upi_id: string | null
          upi_reference: string | null
          user_id: string
        }
        Insert: {
          amount: number
          category: string
          cheque_number?: string | null
          created_at?: string
          date: string
          fingerprint_hash?: string | null
          gst_number?: string | null
          id?: string
          import_batch_id?: string | null
          is_business_expense?: boolean
          is_imported?: boolean
          is_recurring?: boolean
          member_id?: string | null
          note?: string | null
          paid_from_account_id?: string | null
          paid_to_name?: string | null
          payment_method?: string | null
          receipt_number?: string | null
          receipt_url?: string | null
          recurring_end_date?: string | null
          recurring_frequency?: string | null
          tags?: string[] | null
          time?: string | null
          upi_id?: string | null
          upi_reference?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          cheque_number?: string | null
          created_at?: string
          date?: string
          fingerprint_hash?: string | null
          gst_number?: string | null
          id?: string
          import_batch_id?: string | null
          is_business_expense?: boolean
          is_imported?: boolean
          is_recurring?: boolean
          member_id?: string | null
          note?: string | null
          paid_from_account_id?: string | null
          paid_to_name?: string | null
          payment_method?: string | null
          receipt_number?: string | null
          receipt_url?: string | null
          recurring_end_date?: string | null
          recurring_frequency?: string | null
          tags?: string[] | null
          time?: string | null
          upi_id?: string | null
          upi_reference?: string | null
          user_id?: string
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          account_id: string | null
          bank_name: string | null
          coverage_from_date: string | null
          coverage_meta: Json | null
          coverage_to_date: string | null
          id: string
          imported_at: string
          notes: string | null
          source_type: string
          status: string
          transactions_found: number
          transactions_imported: number
          transactions_skipped: number
          user_id: string
        }
        Insert: {
          account_id?: string | null
          bank_name?: string | null
          coverage_from_date?: string | null
          coverage_meta?: Json | null
          coverage_to_date?: string | null
          id?: string
          imported_at?: string
          notes?: string | null
          source_type: string
          status?: string
          transactions_found?: number
          transactions_imported?: number
          transactions_skipped?: number
          user_id: string
        }
        Update: {
          account_id?: string | null
          bank_name?: string | null
          coverage_from_date?: string | null
          coverage_meta?: Json | null
          coverage_to_date?: string | null
          id?: string
          imported_at?: string
          notes?: string | null
          source_type?: string
          status?: string
          transactions_found?: number
          transactions_imported?: number
          transactions_skipped?: number
          user_id?: string
        }
        Relationships: []
      }
      incomes: {
        Row: {
          amount: number
          bank_account_id: string | null
          created_at: string
          date: string
          gross_amount: number | null
          id: string
          income_type: string
          linked_investment_id: string | null
          member_id: string | null
          net_amount: number
          notes: string | null
          tds: number
          tds_rate: number | null
          tds_section: string | null
          tds_section_confirmed: boolean
          user_id: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          created_at?: string
          date: string
          gross_amount?: number | null
          id?: string
          income_type: string
          linked_investment_id?: string | null
          member_id?: string | null
          net_amount: number
          notes?: string | null
          tds?: number
          tds_rate?: number | null
          tds_section?: string | null
          tds_section_confirmed?: boolean
          user_id: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          date?: string
          gross_amount?: number | null
          id?: string
          income_type?: string
          linked_investment_id?: string | null
          member_id?: string | null
          net_amount?: number
          notes?: string | null
          tds?: number
          tds_rate?: number | null
          tds_section?: string | null
          tds_section_confirmed?: boolean
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
          auto_renewal: string | null
          bank_account_id: string | null
          branch_name: string | null
          compounding_type: string | null
          created_at: string
          date: string
          exchange: string | null
          expected_maturity_amount: number | null
          fd_number: string | null
          fd_type: string | null
          folio_number: string | null
          fresh_topup_amount: number | null
          fund_type: string | null
          id: string
          institution: string | null
          investment_type: string
          isin: string | null
          linked_maturity_id: string | null
          matured_date: string | null
          maturity_date: string | null
          member_id: string | null
          nav_at_purchase: number | null
          nomination_details: string | null
          notes: string | null
          purity: string | null
          source_of_funds: string
          status: string
          symbol: string | null
          tenure_months: number | null
          units: number | null
          user_id: string
          weight_grams: number | null
        }
        Insert: {
          amount: number
          auto_renewal?: string | null
          bank_account_id?: string | null
          branch_name?: string | null
          compounding_type?: string | null
          created_at?: string
          date: string
          exchange?: string | null
          expected_maturity_amount?: number | null
          fd_number?: string | null
          fd_type?: string | null
          folio_number?: string | null
          fresh_topup_amount?: number | null
          fund_type?: string | null
          id?: string
          institution?: string | null
          investment_type: string
          isin?: string | null
          linked_maturity_id?: string | null
          matured_date?: string | null
          maturity_date?: string | null
          member_id?: string | null
          nav_at_purchase?: number | null
          nomination_details?: string | null
          notes?: string | null
          purity?: string | null
          source_of_funds?: string
          status?: string
          symbol?: string | null
          tenure_months?: number | null
          units?: number | null
          user_id: string
          weight_grams?: number | null
        }
        Update: {
          amount?: number
          auto_renewal?: string | null
          bank_account_id?: string | null
          branch_name?: string | null
          compounding_type?: string | null
          created_at?: string
          date?: string
          exchange?: string | null
          expected_maturity_amount?: number | null
          fd_number?: string | null
          fd_type?: string | null
          folio_number?: string | null
          fresh_topup_amount?: number | null
          fund_type?: string | null
          id?: string
          institution?: string | null
          investment_type?: string
          isin?: string | null
          linked_maturity_id?: string | null
          matured_date?: string | null
          maturity_date?: string | null
          member_id?: string | null
          nav_at_purchase?: number | null
          nomination_details?: string | null
          notes?: string | null
          purity?: string | null
          source_of_funds?: string
          status?: string
          symbol?: string | null
          tenure_months?: number | null
          units?: number | null
          user_id?: string
          weight_grams?: number | null
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
      master_transactions: {
        Row: {
          balance: number | null
          bank_account_id: string
          created_at: string
          credit: number
          debit: number
          description: string
          fingerprint: string
          fingerprint_hash: string | null
          id: string
          import_batch_id: string | null
          is_broker_payout: boolean
          is_imported: boolean
          linked_broker_txn_id: string | null
          notes: string | null
          reference_no: string | null
          source: string
          txn_date: string
          user_id: string
        }
        Insert: {
          balance?: number | null
          bank_account_id: string
          created_at?: string
          credit?: number
          debit?: number
          description: string
          fingerprint: string
          fingerprint_hash?: string | null
          id?: string
          import_batch_id?: string | null
          is_broker_payout?: boolean
          is_imported?: boolean
          linked_broker_txn_id?: string | null
          notes?: string | null
          reference_no?: string | null
          source?: string
          txn_date: string
          user_id: string
        }
        Update: {
          balance?: number | null
          bank_account_id?: string
          created_at?: string
          credit?: number
          debit?: number
          description?: string
          fingerprint?: string
          fingerprint_hash?: string | null
          id?: string
          import_batch_id?: string | null
          is_broker_payout?: boolean
          is_imported?: boolean
          linked_broker_txn_id?: string | null
          notes?: string | null
          reference_no?: string | null
          source?: string
          txn_date?: string
          user_id?: string
        }
        Relationships: []
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
      sft_entries: {
        Row: {
          amount: number
          counterparty_name: string | null
          created_at: string
          fy: string | null
          id: string
          raw_data: Json | null
          sft_type: string
          source: string
          txn_date: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          counterparty_name?: string | null
          created_at?: string
          fy?: string | null
          id?: string
          raw_data?: Json | null
          sft_type: string
          source?: string
          txn_date?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          counterparty_name?: string | null
          created_at?: string
          fy?: string | null
          id?: string
          raw_data?: Json | null
          sft_type?: string
          source?: string
          txn_date?: string | null
          user_id?: string
        }
        Relationships: []
      }
      transaction_fingerprints: {
        Row: {
          created_at: string
          fingerprint: string
          transaction_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fingerprint: string
          transaction_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          fingerprint?: string
          transaction_id?: string
          user_id?: string
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
      _bank_balance: { Args: { p_user_id: string }; Returns: number }
      get_dashboard_kpis: {
        Args: { p_fy_end: string; p_fy_start: string; p_user_id: string }
        Returns: Json
      }
      get_investment_allocation: {
        Args: { p_user_id: string }
        Returns: {
          investment_type: string
          percentage_of_total: number
          total_amount: number
        }[]
      }
      get_member_summaries: {
        Args: { p_fy_end: string; p_fy_start: string; p_user_id: string }
        Returns: {
          member_id: string
          member_name: string
          member_type: string
          total_bank_balance: number
          total_income_fy: number
          total_invested_fy: number
          total_tds_fy: number
        }[]
      }
      get_monthly_cashflow: {
        Args: { p_months: number; p_user_id: string }
        Returns: {
          month_date: string
          month_label: string
          net_surplus: number
          total_deployed: number
          total_income: number
        }[]
      }
      get_net_worth_timeline: {
        Args: { p_user_id: string }
        Returns: {
          bank_total: number
          investment_total: number
          month_date: string
          net_worth_total: number
        }[]
      }
      get_upcoming_events: {
        Args: { p_days_ahead: number; p_user_id: string }
        Returns: {
          amount: number
          days_until: number
          event_date: string
          event_name: string
          event_type: string
          is_overdue: boolean
          urgency: string
        }[]
      }
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
