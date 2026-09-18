import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Minus, Plus, Zap } from "lucide-react";
import { toast } from "sonner";

import { Button, Panel, StatusPill } from "@/components/kit";
import { CompetitionTimer, useServerClock } from "@/components/CompetitionClock";
import { DEFAULT_COMPETITION_THEME, useCompetitionTheme } from "@/components/CompetitionTheme";
import { useCompetitionTheme } from "@/components/CompetitionTheme";
import { fetchCompetitorContext, saveCompetitorResult } from "@/lib/data";
import type { ClimbingRoute, RouteResult } from "@/lib/db-types";
import { scoreCompetitor, scoreResult } from "@/lib/scoring";

export const Route = createFileRoute("/climb/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "My climbs — Send" },
      {
        name: "description",
        content: "Log your attempts, zones and tops from your phone during the competition.",
      },
      { property: "og:title", content: "My climbs — Send" },
      { property: "og:description", content: "Log your climbs from your phone." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CompetitorScoring,
});

function CompetitorScoring() {
  const { token } = Route.useParams();
  const queryClient = useQueryClient();

  const context = useQuery({
    queryKey: ["competitor", token],
    queryFn: () => fetchCompetitorContext(token),
    refetchInterval: 20_000,
  });

  const save = useMutation({
    mutationFn: saveCompetitorResult,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["competitor", token] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save"),
  });

  const now = useServerClock(context.data?.server_time ?? null);
  useCompetitionTheme(context.data?.theme ?? DEFAULT_COMPETITION_THEME);

  if (context.isLoading) {
    return <main className="p-6 text-muted-foreground">Loading your card…</main>;
  }
  if (context.error || !context.data) {
    return (
      <main className="p-6">
        <h1 className="font-display text-3xl">Link not valid</h1>
        <p className="mt-2 text-muted-foreground">
          Ask the organiser for a new QR code or link.
        </p>
      </main>
    );
  }

  const { competitor, category, competition, routes, results, theme } = context.data;
  const byRoute = new Map(results.map((r) => [r.route_id, r]));
  const summary = scoreCompetitor(competition, routes, results);
  const locked = competition.status !== "active";

  return (
    <main
      className="mx-auto max-w-xl px-4 pb-24 pt-6"
      data-theme={theme ? "custom" : "default"}
    >
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">
          {competition.name}
        </p>
        <h1 className="mt-1 font-display text-4xl leading-none">{competitor.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          #{competitor.competitor_number}
          {category ? ` · ${category.name}` : ""}
        </p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <CompetitionTimer competition={competition} now={now} />
          <StatusPill status={competition.status} />
        </div>
      </header>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <SmallStat label="Tops" value={summary.tops} />
        <SmallStat label="Zones" value={summary.zones} />
        <SmallStat label="Score" value={summary.total} />
      </div>

      {locked ? (
        <Panel className="mt-4 border-destructive/40">
          <p className="text-sm text-muted-foreground">
            Scoring is closed right now. You can look at your card, but not change it.
          </p>
        </Panel>
      ) : null}

      <div className="mt-5 space-y-3">
        {routes.map((route) => (
          <RouteCard
            key={route.id}
            route={route}
            result={byRoute.get(route.id) ?? null}
            locked={locked || save.isPending}
            points={scoreResult(competition, route, byRoute.get(route.id) ?? null)}
            useFlash={competition.scoring_config?.useFlash !== false}
            onSave={(next) => save.mutate({ token, routeId: route.id, ...next })}
          />
        ))}
        {routes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No routes have been added yet.</p>
        ) : null}
      </div>
    </main>
  );
}

function SmallStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="panel px-2 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="font-display text-2xl tabular">{value}</div>
    </div>
  );
}

function RouteCard({
  route,
  result,
  locked,
  points,
  useFlash,
  onSave,
}: {
  route: ClimbingRoute;
  result: RouteResult | null;
  locked: boolean;
  points: number;
  useFlash: boolean;
  onSave: (next: {
    attempts: number;
    zone: boolean;
    top: boolean;
    flash: boolean;
    highestHold?: number | null;
  }) => void;
}) {
  const [attempts, setAttempts] = useState(result?.attempts ?? 0);
  const [zone, setZone] = useState(result?.zone_reached ?? false);
  const [top, setTop] = useState(result?.top_reached ?? false);
  const [flash, setFlash] = useState(result?.flash ?? false);
  const [hold, setHold] = useState<number | null>(result?.highest_hold ?? null);
  const holdBased = route.max_hold != null;

  const commit = (next: Partial<{
    attempts: number;
    zone: boolean;
    top: boolean;
    flash: boolean;
    hold: number | null;
  }>) => {
    const merged = { attempts, zone, top, flash, hold, ...next };
    setAttempts(merged.attempts);
    setZone(merged.zone);
    setTop(merged.top);
    setFlash(merged.flash);
    setHold(merged.hold);
    onSave({
      attempts: merged.attempts,
      zone: merged.zone,
      top: merged.top,
      flash: merged.flash,
      highestHold: merged.hold,
    });
  };

  return (
    <Panel>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-display text-2xl">
            {route.number}
            {route.name ? ` · ${route.name}` : ""}
          </div>
          <div className="text-xs text-muted-foreground">
            {route.grade ? `${route.grade} · ` : ""}
            {attempts} {attempts === 1 ? "attempt" : "attempts"}
          </div>
        </div>
        <div className="font-display text-3xl tabular text-primary">{points}</div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button
          variant="outline"
          size="touch"
          className="flex-1"
          disabled={locked || attempts === 0}
          aria-label="One attempt fewer"
          onClick={() => commit({ attempts: Math.max(attempts - 1, 0) })}
        >
          <Minus className="h-5 w-5" />
        </Button>
        <Button
          variant="secondary"
          size="touch"
          className="flex-[2]"
          disabled={locked}
          onClick={() => commit({ attempts: attempts + 1 })}
        >
          <Plus className="h-5 w-5" /> Attempt
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {route.has_zone ? (
          <Button
            variant={zone || top ? "zone" : "outline"}
            size="touch"
            className="flex-1"
            disabled={locked || top}
            onClick={() => commit({ zone: !zone, attempts: Math.max(attempts, 1) })}
          >
            Zone
          </Button>
        ) : null}
        <Button
          variant={top ? "top" : "outline"}
          size="touch"
          className="flex-1"
          disabled={locked}
          onClick={() =>
            commit({
              top: !top,
              zone: !top ? true : zone,
              flash: !top ? flash : false,
              attempts: Math.max(attempts, 1),
            })
          }
        >
          <Check className="h-5 w-5" /> Top
        </Button>
        {useFlash ? (
          <Button
            variant={flash ? "primary" : "outline"}
            size="touch"
            className="flex-1"
            disabled={locked || !top}
            onClick={() => commit({ flash: !flash, attempts: 1 })}
          >
            <Zap className="h-5 w-5" /> Flash
          </Button>
        ) : null}
      </div>

      {holdBased ? (
        <div className="mt-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Highest hold (max {route.max_hold})
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Array.from({ length: route.max_hold ?? 0 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                disabled={locked}
                onClick={() => commit({ hold: n, attempts: Math.max(attempts, 1) })}
                className={
                  hold === n
                    ? "h-10 w-10 rounded-lg bg-primary font-bold text-primary-foreground"
                    : "h-10 w-10 rounded-lg border border-border font-semibold text-muted-foreground"
                }
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
