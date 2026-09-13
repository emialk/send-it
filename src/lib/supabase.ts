import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env['VITE_SUPABASE_URL'] as string | undefined;
const anonKey = import.meta.env['VITE_SUPABASE_ANON_KEY'] as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * Browser-only Supabase client. Uses the public anon key: all access control is
 * enforced by Row Level Security and the security-definer competitor RPCs.
 * No service-role key ever reaches this bundle.
 */
export const supabase: SupabaseClient = createClient(
  url ?? "https://placeholder.supabase.co",
  anonKey ?? "public-anon-key-missing",
  {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    realtime: { params: { eventsPerSecond: 10 } },
  },
);

/** Absolute app URL that respects the GitHub Pages sub-path (Vite `base`). */
export function appUrl(path: string): string {
  const base = import.meta.env.BASE_URL || "/";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const configured = import.meta.env['VITE_APP_BASE_URL'] as string | undefined;
  const root = (configured || `${origin}${base}`).replace(/\/+$/, "");
  return `${root}/${path.replace(/^\/+/, "")}`;
}
