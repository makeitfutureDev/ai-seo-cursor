import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('Supabase Config Check:');
console.log('URL:', supabaseUrl ? 'Present' : 'Missing');
console.log('Anon Key:', supabaseAnonKey ? 'Present' : 'Missing');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

console.log('Supabase client created successfully');

export type UserProfile = {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  search_optimization_country?: string;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
};

export type Company = {
  id: string;
  name: string;
  domain?: string;
  flag: string;
  country?: string;
  goal?: string;
  created_at: string;
  updated_at: string;
};

export type CompanyUser = {
  id: string;
  company_id: string;
  user_id: string;
  role: 'admin' | 'read_only';
  created_at: string;
}