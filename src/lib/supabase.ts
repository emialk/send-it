import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env['VITE_SUPABASE_URL'] as string | undefined;
/** Supabase publishable key (sb_publishable_…). Safe to ship in the browser bundle. */
const publishableKey = (import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] ??
  import.meta.env['VITE_SUPABASE_ANON_KEY']) as string | undefined;

export const isSupabaseConfigured = Boolean(url && publishableKey);

/**
 * Browser-only Supabase client. Uses the public publishable key: all access
 * control is enforced by Row Level Security and the security-definer competitor
 * RPCs. No secret key ever reaches this bundle.
 */
export const supabase: SupabaseClient = createClient(
  url ?? "https://placeholder.supabase.co",
  publishableKey ?? "sb_publishable_missing",
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
