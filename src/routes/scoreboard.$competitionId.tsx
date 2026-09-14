import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { StatusPill } from "@/components/kit";
import { CompetitionTimer, useServerClock } from "@/components/CompetitionClock";
import { fetchCompetitionBundle, subscribeToCompetition } from "@/lib/data";
import { rankCompetitors } from "@/lib/ranking";

export const Route = createFileRoute("/scoreboard/$competitionId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Live scoreboard — Send" },
      {
        name: "description",
        content: "Real-time climbing competition standings for the big screen — no login needed.",
      },
      { property: "og:title", content: "Live scoreboard — Send" },
      {
        property: "og:description",
        content: "Real-time climbing competition standings, updated as climbers log their climbs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Scoreboard,
});

function Scoreboard() {
  const { competitionId } = Route.useParams();
  const [categoryId, setCategoryId] = useState<string | "all">("all");

  const bundle = useQuery({
    queryKey: ["scoreboard", competitionId],
    queryFn: () => fetchCompetitionBundle(competitionId),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    return subscribeToCompetition(competitionId, () => void bundle.refetch());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitionId]);

  const now = useServerClock(null);

  if (bundle.isLoading) {
    return <main className="p-8 text-muted-foreground">Loading scoreboard…</main>;
  }
  if (bundle.error || !bundle.data) {
    return (
      <main className="p-8">
        <h1 className="font-display text-3xl">Scoreboard unavailable</h1>
        <p className="mt-2 text-muted-foreground">
          This competition is not public yet, or the link is wrong.
        </p>
      </main>
    );
  }

  const { competition, categories, routes, competitors, results } = bundle.data;
  const visibleCompetitors =
    categoryId === "all" ? competitors : competitors.filter((c) => c.category_id === categoryId);
  const ranked = rankCompetitors(competition, routes, visibleCompetitors, results, categories);

  return (
    <main className="min-h-screen px-4 py-6 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">Live standings</p>
          <h1 className="font-display text-4xl leading-none sm:text-6xl">{competition.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {competition.discipline.replace("_", "-")}
            {competition.location ? ` · ${competition.location}` : ""} · {routes.length} routes
          </p>
        </div>
        <div className="flex items-center gap-6">
          <CompetitionTimer competition={competition} now={now} />
          <StatusPill status={competition.status} />
        </div>
      </header>

      {categories.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-2">
          <CategoryChip active={categoryId === "all"} onClick={() => setCategoryId("all")}>
            All
          </CategoryChip>
          {categories.map((category) => (
            <CategoryChip
              key={category.id}
              active={categoryId === category.id}
              onClick={() => setCategoryId(category.id)}
            >
              {category.name}
            </CategoryChip>
          ))}
        </div>
      ) : null}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Climber</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2 text-right">Tops</th>
              <th className="px-3 py-2 text-right">Zones</th>
              <th className="px-3 py-2 text-right">Attempts</th>
              <th className="px-3 py-2 text-right">Score</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((row) => (
              <tr key={row.competitor.id} className="border-t border-border/70">
                <td className="px-3 py-3 font-display text-2xl tabular">{row.rank}</td>
                <td className="px-3 py-3">
                  <div className="font-display text-xl sm:text-2xl">{row.competitor.name}</div>
                  <div className="text-xs text-muted-foreground">
                    #{row.competitor.competitor_number}
                  </div>
                </td>
                <td className="px-3 py-3 text-sm text-muted-foreground">
                  {row.category?.name ?? "—"}
                </td>
                <td className="px-3 py-3 text-right tabular text-top">{row.score.tops}</td>
                <td className="px-3 py-3 text-right tabular text-zone">{row.score.zones}</td>
                <td className="px-3 py-3 text-right tabular">{row.score.attempts}</td>
                <td className="px-3 py-3 text-right font-display text-2xl tabular sm:text-3xl">
                  {row.score.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {ranked.length === 0 ? (
          <p className="mt-6 text-center text-muted-foreground">No climbers registered yet.</p>
        ) : null}
      </div>
    </main>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? "rounded-full bg-primary px-4 py-1.5 text-sm font-bold text-primary-foreground"
          : "rounded-full border border-border px-4 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-accent"
      }
    >
      {children}
    </button>
  );
}
