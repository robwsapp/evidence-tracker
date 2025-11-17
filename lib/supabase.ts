import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      evidence_logs: {
        Row: {
          id: string
          created_at: string
          client_name: string
          case_number: string
          date_received: string
          num_pieces: number
          evidence_type: string
          source: string
          notes: string | null
          staff_email: string
          mycase_client_id: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          client_name: string
          case_number: string
          date_received: string
          num_pieces: number
          evidence_type: string
          source: string
          notes?: string | null
          staff_email: string
          mycase_client_id?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          client_name?: string
          case_number?: string
          date_received?: string
          num_pieces?: number
          evidence_type?: string
          source?: string
          notes?: string | null
          staff_email?: string
          mycase_client_id?: string | null
        }
      }
      evidence_files: {
        Row: {
          id: string
          created_at: string
          evidence_log_id: string
          file_name: string
          file_path: string
          file_size: number
          original_name: string
        }
        Insert: {
          id?: string
          created_at?: string
          evidence_log_id: string
          file_name: string
          file_path: string
          file_size: number
          original_name: string
        }
        Update: {
          id?: string
          created_at?: string
          evidence_log_id?: string
          file_name?: string
          file_path?: string
          file_size?: number
          original_name?: string
        }
      }
    }
  }
}
