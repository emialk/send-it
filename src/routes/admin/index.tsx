import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LogOut, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button, EmptyState, Field, Input, Panel, Select, Stat, StatusPill } from "@/components/kit";
import { useSession } from "@/hooks/useSession";
import { listMyCompetitions } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import type { Discipline } from "@/lib/db-types";
import { defaultFormat } from "@/lib/scoring";

export const Route = createFileRoute("/admin/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Organiser dashboard — Send" },
      { name: "description", content: "Create, run and archive climbing competitions." },
      { property: "og:title", content: "Organiser dashboard — Send" },
      { property: "og:description", content: "Create, run and archive climbing competitions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session, loading, user } = useSession();
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth", replace: true });
  }, [loading, session, navigate]);

  const competitions = useQuery({
    queryKey: ["my-competitions", user?.id],
    queryFn: () => listMyCompetitions(user!.id),
    enabled: Boolean(user?.id),
  });

  const competitorCounts = useQuery({
    queryKey: ["competitor-counts", user?.id],
    enabled: Boolean(competitions.data?.length),
    queryFn: async () => {
      const ids = (competitions.data ?? []).map((c) => c.id);
      const { data, error } = await supabase
        .from("competitors")
        .select("competition_id")
        .in("competition_id", ids);
      if (error) throw new Error(error.message);
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        const key = (row as { competition_id: string }).competition_id;
        counts[key] = (counts[key] ?? 0) + 1;
      }
      return counts;
    },
  });

  const createCompetition = useMutation({
    mutationFn: async (form: { name: string; discipline: Discipline; date: string; location: string }) => {
      const { data, error } = await supabase
        .from("competitions")
        .insert({
          owner_id: user!.id,
          name: form.name,
          discipline: form.discipline,
          date: form.date || null,
          location: form.location || null,
          scoring_format: defaultFormat(form.discipline),
          status: "draft",
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return data as { id: string };
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["my-competitions"] });
      setCreating(false);
      void navigate({ to: "/admin/$competitionId", params: { competitionId: data.id } });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not create"),
  });

  const list = competitions.data ?? [];
  const byStatus = (statuses: string[]) => list.filter((c) => statuses.includes(c.status));
  const totalCompetitors = Object.values(competitorCounts.data ?? {}).reduce((a, b) => a + b, 0);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">Send</p>
          <h1 className="text-4xl font-bold">Organiser dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={() => setCreating((v) => !v)}>
            <Plus className="h-4 w-4" /> New competition
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sign out"
            onClick={async () => {
              queryClient.clear();
              await supabase.auth.signOut();
              void navigate({ to: "/auth", replace: true });
            }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Live" value={byStatus(["active"]).length} />
        <Stat label="Upcoming" value={byStatus(["draft", "registration"]).length} />
        <Stat label="Finished" value={byStatus(["finished", "archived"]).length} />
        <Stat label="Competitors" value={totalCompetitors} />
      </div>

      {creating ? (
        <Panel className="mt-6">
          <h2 className="font-display text-2xl">New competition</h2>
          <form
            className="mt-4 grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              createCompetition.mutate({
                name: String(form.get("name") ?? ""),
                discipline: String(form.get("discipline") ?? "bouldering") as Discipline,
                date: String(form.get("date") ?? ""),
                location: String(form.get("location") ?? ""),
              });
            }}
          >
            <Field label="Name">
              <Input name="name" required placeholder="Autumn Boulder Jam" />
            </Field>
            <Field label="Discipline">
              <Select name="discipline" defaultValue="bouldering">
                <option value="bouldering">Bouldering</option>
                <option value="lead">Lead</option>
                <option value="top_rope">Top-rope</option>
              </Select>
            </Field>
            <Field label="Date">
              <Input name="date" type="date" />
            </Field>
            <Field label="Location">
              <Input name="location" placeholder="Klättercentret" />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit" size="lg" disabled={createCompetition.isPending}>
                {createCompetition.isPending ? "Creating…" : "Create competition"}
              </Button>
            </div>
          </form>
        </Panel>
      ) : null}

      <h2 className="mt-8 font-display text-2xl">Competitions</h2>
      <div className="mt-3 space-y-2">
        {competitions.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : list.length === 0 ? (
          <EmptyState title="No competitions yet" description="Create your first competition above." />
        ) : (
          list.map((competition) => (
            <Link
              key={competition.id}
              to="/admin/$competitionId"
              params={{ competitionId: competition.id }}
              className="panel flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-strong"
            >
              <div>
                <div className="font-display text-lg">{competition.name}</div>
                <div className="text-xs text-muted-foreground">
                  {competition.discipline.replace("_", "-")}
                  {competition.date ? ` · ${competition.date}` : ""} ·{" "}
                  {competitorCounts.data?.[competition.id] ?? 0} competitors
                </div>
              </div>
              <StatusPill status={competition.status} />
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
