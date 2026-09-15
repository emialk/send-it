import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Organiser sign in — Send" },
      { name: "description", content: "Sign in to create and run climbing competitions." },
      { property: "og:title", content: "Organiser sign in — Send" },
      { property: "og:description", content: "Sign in to create and run climbing competitions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!isSupabaseConfigured) {
      toast.error("Supabase is not configured for this deployment.");
      return;
    }

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await navigate({ to: "/admin", replace: true });
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success("Account created. If confirmation is required, check your inbox.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ margin: "0 auto", maxWidth: "28rem", padding: "2.5rem 1rem" }}>
      <Link to="/" style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.3em" }}>
        Send
      </Link>
      <h1 style={{ marginTop: "0.75rem", fontSize: "2.25rem", fontWeight: 700 }}>
        {mode === "signin" ? "Organiser sign in" : "Create organiser account"}
      </h1>
      <section style={{ marginTop: "1.5rem", padding: "1.25rem", border: "1px solid #444", borderRadius: "0.75rem" }}>
        <form onSubmit={submit}>
          <label style={{ display: "block", marginBottom: "1rem" }}>
            <span style={{ display: "block", marginBottom: "0.375rem", fontSize: "0.75rem" }}>Email</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              onInputCapture={(event) => event.stopPropagation()}
              style={{ display: "block", width: "100%", boxSizing: "border-box", padding: "0.5rem" }}
            />
          </label>
          <label style={{ display: "block", marginBottom: "1rem" }}>
            <span style={{ display: "block", marginBottom: "0.375rem", fontSize: "0.75rem" }}>Password</span>
            <input
              type="password"
              name="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              minLength={6}
              onInputCapture={(event) => event.stopPropagation()}
              style={{ display: "block", width: "100%", boxSizing: "border-box", padding: "0.5rem" }}
            />
          </label>
          <button type="submit" disabled={busy} style={{ width: "100%", padding: "0.75rem", fontWeight: 600 }}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
        <button
          type="button"
          style={{ marginTop: "1rem", fontSize: "0.875rem", textDecoration: "underline" }}
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </section>
      <p style={{ marginTop: "1rem", fontSize: "0.75rem" }}>
        Competitors never sign in here — they use their QR code link.
      </p>
    </main>
  );
}
