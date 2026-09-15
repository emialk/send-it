import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowRight, Monitor, ShieldCheck } from "lucide-react";

import { Button, EmptyState, Panel, StatusPill } from "@/components/kit";
import { listPublicCompetitions } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Send — Climbing Competition Scoring" },
      {
        name: "description",
        content:
          "Run bouldering, lead and top-rope competitions: live scoring from competitors' phones and a real-time public scoreboard.",
      },
      { property: "og:title", content: "Send — Climbing Competition Scoring" },
      {
        property: "og:description",
        content:
          "Live climbing competition scoring: QR access for competitors, real-time scoreboard, CSV and JSON export.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const competitions = useQuery({
    queryKey: ["public-competitions"],
    queryFn: listPublicCompetitions,
    enabled: isSupabaseConfigured,
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:py-16">
      <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">Send</p>
      <h1 className="mt-3 text-5xl font-bold leading-[0.95] sm:text-7xl">
        Climbing competition
        <br />
        scoring, live.
      </h1>
      <p className="mt-4 max-w-xl text-muted-foreground">
        Bouldering, lead and top-rope. Competitors record their climbs on their phone with a QR
        code, and the scoreboard updates instantly on the big screen.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/auth">
          <Button size="lg">
            Organiser sign in <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {!isSupabaseConfigured ? (
        <Panel className="mt-10 border-destructive/50">
          <h2 className="font-display text-2xl">Finish the setup</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Add your database address and publishable key as <code>VITE_SUPABASE_URL</code> and{" "}
            <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>, then reload this page.
          </p>
        </Panel>
      ) : null}

      <div className="mt-12 grid gap-3 sm:grid-cols-3">
        {[
          { icon: Activity, title: "Phone scoring", text: "Big one-hand buttons, instant saving." },
          { icon: Monitor, title: "TV scoreboard", text: "Full screen, no login, real-time." },
          { icon: ShieldCheck, title: "Locked down", text: "Each climber only sees their own card." },
        ].map(({ icon: Icon, title, text }) => (
          <Panel key={title}>
            <Icon className="h-5 w-5 text-primary" />
            <h2 className="mt-3 font-display text-xl">{title}</h2>
            <p className="text-sm text-muted-foreground">{text}</p>
          </Panel>
        ))}
      </div>

      <h2 className="mt-14 font-display text-2xl">Public scoreboards</h2>
      <div className="mt-3 space-y-2">
        {competitions.data?.length ? (
          competitions.data.map((competition) => (
            <Link
              key={competition.id}
              to="/scoreboard/$competitionId"
              params={{ competitionId: competition.id }}
              className="panel flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-strong"
            >
              <div>
                <div className="font-display text-lg">{competition.name}</div>
                <div className="text-xs text-muted-foreground">
                  {competition.discipline.replace("_", "-")}
                  {competition.location ? ` · ${competition.location}` : ""}
                  {competition.date ? ` · ${competition.date}` : ""}
                </div>
              </div>
              <StatusPill status={competition.status} />
            </Link>
          ))
        ) : (
          <EmptyState
            title="No public competitions yet"
            description="Competitions appear here once an organiser opens registration."
          />
        )}
      </div>
    </main>
  );
}
