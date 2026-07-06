/**
 * Database types matching supabase/schema.sql (Phase 1).
 *
 * These are shaped like Supabase's generated types so they plug straight into
 * `createClient<Database>()`. Once the Supabase CLI is set up you can regenerate
 * this file with:
 *   npx supabase gen types typescript --project-id <ref> --schema public > src/types/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type FamilyRole = 'owner' | 'member' | 'viewer'
export type AccountType = 'cash' | 'bank' | 'credit_card' | 'wallet'
export type CategoryKind = 'income' | 'expense'
export type TransactionType = 'income' | 'expense' | 'transfer'
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface Database {
  public: {
    Tables: {
      families: {
        Row: {
          id: string
          name: string
          created_by: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          name: string
          created_by: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          created_by?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      family_members: {
        Row: {
          id: string
          family_id: string
          user_id: string
          role: FamilyRole
          display_name: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          family_id: string
          user_id: string
          role?: FamilyRole
          display_name?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          family_id?: string
          user_id?: string
          role?: FamilyRole
          display_name?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'family_members_user_id_profiles_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          id: string
          full_name: string | null
          avatar_url: string | null
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          avatar_url?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          avatar_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      accounts: {
        Row: {
          id: string
          family_id: string
          name: string
          type: AccountType
          opening_balance: number
          currency: string
          owner_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          family_id: string
          name: string
          type: AccountType
          opening_balance?: number
          currency?: string
          owner_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          family_id?: string
          name?: string
          type?: AccountType
          opening_balance?: number
          currency?: string
          owner_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          id: string
          family_id: string
          name: string
          kind: CategoryKind
          icon: string | null
          color: string | null
          is_default: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          family_id: string
          name: string
          kind: CategoryKind
          icon?: string | null
          color?: string | null
          is_default?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          family_id?: string
          name?: string
          kind?: CategoryKind
          icon?: string | null
          color?: string | null
          is_default?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          id: string
          family_id: string
          type: TransactionType
          amount: number
          occurred_at: string
          note: string | null
          account_id: string | null
          category_id: string | null
          from_account_id: string | null
          to_account_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          family_id: string
          type: TransactionType
          amount: number
          occurred_at?: string
          note?: string | null
          account_id?: string | null
          category_id?: string | null
          from_account_id?: string | null
          to_account_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          family_id?: string
          type?: TransactionType
          amount?: number
          occurred_at?: string
          note?: string | null
          account_id?: string | null
          category_id?: string | null
          from_account_id?: string | null
          to_account_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'transactions_created_by_profiles_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      budgets: {
        Row: {
          id: string
          family_id: string
          category_id: string
          amount: number
          period_month: string
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          family_id: string
          category_id: string
          amount: number
          period_month: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          family_id?: string
          category_id?: string
          amount?: number
          period_month?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      recurring_transactions: {
        Row: {
          id: string
          family_id: string
          type: TransactionType
          amount: number
          note: string | null
          account_id: string | null
          category_id: string | null
          from_account_id: string | null
          to_account_id: string | null
          frequency: RecurrenceFrequency
          interval_count: number
          start_date: string
          end_date: string | null
          next_run_date: string
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          family_id: string
          type: TransactionType
          amount: number
          note?: string | null
          account_id?: string | null
          category_id?: string | null
          from_account_id?: string | null
          to_account_id?: string | null
          frequency: RecurrenceFrequency
          interval_count?: number
          start_date: string
          end_date?: string | null
          next_run_date: string
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          family_id?: string
          type?: TransactionType
          amount?: number
          note?: string | null
          account_id?: string | null
          category_id?: string | null
          from_account_id?: string | null
          to_account_id?: string | null
          frequency?: RecurrenceFrequency
          interval_count?: number
          start_date?: string
          end_date?: string | null
          next_run_date?: string
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      family_invites: {
        Row: {
          id: string
          family_id: string
          code: string
          created_by: string | null
          expires_at: string | null
          max_uses: number | null
          used_count: number
          is_active: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          family_id: string
          code: string
          created_by?: string | null
          expires_at?: string | null
          max_uses?: number | null
          used_count?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          family_id?: string
          code?: string
          created_by?: string | null
          expires_at?: string | null
          max_uses?: number | null
          used_count?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      account_balances: {
        Row: {
          account_id: string | null
          family_id: string | null
          owner_id: string | null
          name: string | null
          type: AccountType | null
          opening_balance: number | null
          current_balance: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_family_member: {
        Args: { _family_id: string }
        Returns: boolean
      }
      is_family_owner: {
        Args: { _family_id: string }
        Returns: boolean
      }
      can_edit_family: {
        Args: { _family_id: string }
        Returns: boolean
      }
      create_family_invite: {
        Args: {
          _family_id: string
          _expires_at?: string | null
          _max_uses?: number | null
        }
        Returns: Database['public']['Tables']['family_invites']['Row']
      }
      join_family_with_code: {
        Args: { _code: string }
        Returns: string
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

/* Convenience helpers */
type PublicSchema = Database['public']

export type Tables<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Row']
export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update']
export type Views<T extends keyof PublicSchema['Views']> =
  PublicSchema['Views'][T]['Row']
