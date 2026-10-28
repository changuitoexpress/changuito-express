import { createClient } from '@supabase/supabase-js';
import { normalizeSupabaseUrl } from './supabaseUrl';

const SUPABASE_URL: string = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
