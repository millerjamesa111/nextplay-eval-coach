'use client';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export const getSupabase = () => {
  if (!supabaseInstance && typeof window !== 'undefined') {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (supabaseUrl && supabaseAnonKey) {
      supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
    }
  }
  return supabaseInstance;
};

export const supabase = {
  from: (table: string) => {
    const client = getSupabase();
    if (!client) {
      throw new Error('Supabase client not initialized');
    }
    return client.from(table);
  },
};

// =============================================
// TYPES
// =============================================

export interface Submission {
  id: string;
  rep_name: string;
  athlete_name: string;
  grade: string | null;
  output: string;
  transcript: string;
  interview_date: string | null;
  created_at: string;
  flagged: boolean;
  transcript_header: string | null;  // v7: for duplicate detection
  rep_id: string | null;              // v7: link to reps table
  call_type: string | null;          // v8: Game Plan / Auto Book / Dialer
}

export interface Rep {
  id: string;
  rep_name: string;
  rep_code: string;
  active: boolean;
  created_at: string;
}

export interface Setting {
  id: string;
  key: string;
  value: string;
  updated_at: string;
}
