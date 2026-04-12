import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
