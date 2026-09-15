import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { Button, Field, Panel } from "@/components/kit";
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
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const emailValue = useRef<HTMLInputElement>(null);
  const passwordValue = useRef<HTMLInputElement>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!isSupabaseConfigured) {
      setErrorMessage("Supabase is not configured for this deployment.");
      return;
    }

    const email = emailValue.current?.value ?? "";
    const password = passwordValue.current?.value ?? "";
    if (!email || !password) {
      setErrorMessage("Email and password are required.");
      return;
    }
    setBusy(true);
    setErrorMessage("");
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.assign(`${import.meta.env.BASE_URL}admin`);
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setErrorMessage("Account created. If confirmation is required, check your inbox.");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  function updateValue(
    event: React.FormEvent<HTMLDivElement>,
    value: React.RefObject<HTMLInputElement | null>,
  ) {
    if (value.current) value.current.value = event.currentTarget.textContent ?? "";
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <Link to="/" className="text-xs font-bold uppercase tracking-[0.3em] text-primary">
        Send
      </Link>
      <h1 className="mt-3 text-4xl font-bold">
        {mode === "signin" ? "Organiser sign in" : "Create organiser account"}
      </h1>
      <Panel className="mt-6">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email">
            <div
              contentEditable
              role="textbox"
              aria-label="Email"
              tabIndex={0}
              spellCheck={false}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none"
              onInput={(event) => updateValue(event, emailValue)}
            />
            <input ref={emailValue} type="hidden" name="email" />
          </Field>
          <Field label="Password">
            <div
              contentEditable
              role="textbox"
              aria-label="Password"
              tabIndex={0}
              spellCheck={false}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none"
              style={{ WebkitTextSecurity: "disc" } as React.CSSProperties}
              onInput={(event) => updateValue(event, passwordValue)}
            />
            <input ref={passwordValue} type="hidden" name="password" />
          </Field>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>
        {errorMessage ? (
          <p role="status" className="mt-4 text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}
        <button
          type="button"
          className="mt-4 text-sm text-muted-foreground underline"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </Panel>
      <p className="mt-4 text-xs text-muted-foreground">
        Competitors never sign in here — they use their QR code link.
      </p>
    </main>
  );
}
