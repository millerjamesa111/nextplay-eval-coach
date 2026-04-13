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
}
