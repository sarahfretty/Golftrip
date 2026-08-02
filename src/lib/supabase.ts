import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The browser client uses the ANON (public) key. Row Level Security in schema.sql is what
// protects the data — never ship the service-role key to the client.
//
// When these env vars are absent, the app runs on the local/offline adapter (see store.tsx)
// so development and demos work with zero backend. Set them to point at your Supabase project.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;
