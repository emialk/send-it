import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Download, Monitor, QrCode as QrIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  Button,
  EmptyState,
  Field,
  Input,
  Panel,
  Select,
  Stat,
  StatusPill,
} from "@/components/kit";
import { CompetitionTimer, useServerClock } from "@/components/CompetitionClock";
import { QrCode } from "@/components/QrCode";
import { useSession } from "@/hooks/useSession";
import {
  addCategory,
  addCompetitor,
  addRoute,
  deleteCategory,
  deleteCompetition,
  deleteCompetitor,
  deleteRoute,
  fetchCompetitionBundle,
  saveAdminResult,
  subscribeToCompetition,
  updateCompetition,
} from "@/lib/data";
import type { CompetitionStatus, Competitor } from "@/lib/db-types";
import { rankCompetitors } from "@/lib/ranking";
import { boulderConfig } from "@/lib/scoring";
import { buildCsv, buildJson, downloadFile, slugify } from "@/lib/export";
import { appUrl } from "@/lib/supabase";

export const Route = createFileRoute("/admin/$competitionId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Run competition — Send" },
      {
        name: "description",
        content:
          "Set up categories, routes and climbers, hand out QR codes, run the timer and export results.",
      },
      { property: "og:title", content: "Run competition — Send" },
      {
        property: "og:description",
        content: "Set up routes and climbers, run the timer and export results.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CompetitionAdmin,
});

type Tab = "setup" | "routes" | "climbers" | "standings";

function CompetitionAdmin() {
  const { competitionId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session, loading } = useSession();
  const [tab, setTab] = useState<Tab>("setup");
  const [qrFor, setQrFor] = useState<Competitor | null>(null);

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth", replace: true });
  }, [loading, session, navigate]);

  const bundle = useQuery({
    queryKey: ["competition", competitionId],
    queryFn: () => fetchCompetitionBundle(competitionId),
    enabled: Boolean(session),
  });

  useEffect(() => {
    if (!session) return;
    return subscribeToCompetition(competitionId, () => void bundle.refetch());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitionId, session]);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["competition", competitionId] });
  const mutate = <T,>(fn: (input: T) => Promise<unknown>, success?: string) =>
    useMutationSafe(fn, refresh, success);

  const now = useServerClock(null);

  if (bundle.isLoading) return <main className="p-6 text-muted-foreground">Loading…</main>;
  if (bundle.error || !bundle.data) {
    return (
      <main className="p-6">
        <h1 className="font-display text-3xl">Competition not found</h1>
        <Link to="/admin" className="mt-3 inline-block text-primary underline">
          Back to dashboard
        </Link>
      </main>
    );
  }

  const { competition, categories, routes, competitors, results } = bundle.data;
  const ranked = rankCompetitors(competition, routes, competitors, results, categories);
  const cfg = boulderConfig(competition.scoring_config);

  const setStatus = async (status: CompetitionStatus) => {
    const patch: Record<string, unknown> = { status };
    if (status === "active" && !competition.start_time) patch['start_time'] = new Date().toISOString();
    if (status === "finished") patch['end_time'] = new Date().toISOString();
    try {
      await updateCompetition(competitionId, patch);
      refresh();
      toast.success(`Status: ${status}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update");
    }
  };

  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      refresh();
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>

      <header className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl leading-none">{competition.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {competition.discipline.replace("_", "-")}
            {competition.date ? ` · ${competition.date}` : ""}
            {competition.location ? ` · ${competition.location}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <CompetitionTimer competition={competition} now={now} />
          <StatusPill status={competition.status} />
        </div>
      </header>

      <div className="mt-4 flex flex-wrap gap-2">
        {(["draft", "registration", "active", "finished", "archived"] as CompetitionStatus[]).map(
          (status) => (
            <Button
              key={status}
              variant={competition.status === status ? "primary" : "outline"}
              size="sm"
              onClick={() => void setStatus(status)}
            >
              {status}
            </Button>
          ),
        )}
        <a
          href={appUrl(`scoreboard/${competition.id}`)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex"
        >
          <Button variant="secondary" size="sm">
            <Monitor className="h-4 w-4" /> Scoreboard
          </Button>
        </a>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Climbers" value={competitors.length} />
        <Stat label="Routes" value={routes.length} />
        <Stat label="Categories" value={categories.length} />
        <Stat label="Logged climbs" value={results.length} />
      </div>

      <nav className="mt-6 flex flex-wrap gap-2">
        {(["setup", "routes", "climbers", "standings"] as Tab[]).map((item) => (
          <Button
            key={item}
            variant={tab === item ? "primary" : "ghost"}
            size="sm"
            onClick={() => setTab(item)}
          >
            {item}
          </Button>
        ))}
      </nav>

      {tab === "setup" ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel>
            <h2 className="font-display text-2xl">Details</h2>
            <form
              className="mt-3 grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void run(
                  () =>
                    updateCompetition(competitionId, {
                      name: String(form.get("name") ?? ""),
                      location: String(form.get("location") ?? "") || null,
                      date: String(form.get("date") ?? "") || null,
                      description: String(form.get("description") ?? "") || null,
                      show_ranking_to_competitors: form.get("showRanking") === "on",
                    }),
                  "Saved",
                );
              }}
            >
              <Field label="Name">
                <Input name="name" defaultValue={competition.name} required />
              </Field>
              <Field label="Location">
                <Input name="location" defaultValue={competition.location ?? ""} />
              </Field>
              <Field label="Date">
                <Input name="date" type="date" defaultValue={competition.date ?? ""} />
              </Field>
              <Field label="Description">
                <Input name="description" defaultValue={competition.description ?? ""} />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="showRanking"
                  defaultChecked={competition.show_ranking_to_competitors}
                />
                Show ranking to climbers
              </label>
              <Button type="submit">Save details</Button>
            </form>
          </Panel>

          <Panel>
            <h2 className="font-display text-2xl">Scoring</h2>
            <form
              className="mt-3 grid gap-3 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const num = (key: string, fallback: number) => {
                  const value = Number(form.get(key));
                  return Number.isFinite(value) ? value : fallback;
                };
                void run(
                  () =>
                    updateCompetition(competitionId, {
                      scoring_config: {
                        ...competition.scoring_config,
                        boulder: {
                          topPoints: num("topPoints", cfg.topPoints),
                          zonePoints: num("zonePoints", cfg.zonePoints),
                          attemptPenalty: num("attemptPenalty", cfg.attemptPenalty),
                          flashBonus: num("flashBonus", cfg.flashBonus),
                          countAttemptsFromFirst: form.get("fromFirst") === "on",
                        },
                        useFlash: form.get("useFlash") === "on",
                      },
                    }),
                  "Scoring saved",
                );
              }}
            >
              <Field label="Top points">
                <Input name="topPoints" type="number" step="0.1" defaultValue={cfg.topPoints} />
              </Field>
              <Field label="Zone points">
                <Input name="zonePoints" type="number" step="0.1" defaultValue={cfg.zonePoints} />
              </Field>
              <Field label="Penalty per extra attempt">
                <Input
                  name="attemptPenalty"
                  type="number"
                  step="0.1"
                  defaultValue={cfg.attemptPenalty}
                />
              </Field>
              <Field label="Flash bonus">
                <Input name="flashBonus" type="number" step="0.1" defaultValue={cfg.flashBonus} />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="fromFirst"
                  defaultChecked={cfg.countAttemptsFromFirst}
                />
                Penalise the first attempt too
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="useFlash"
                  defaultChecked={competition.scoring_config?.useFlash !== false}
                />
                Use flash
              </label>
              <div className="sm:col-span-2">
                <Button type="submit">Save scoring</Button>
              </div>
            </form>
          </Panel>

          <Panel>
            <h2 className="font-display text-2xl">Categories</h2>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const name = String(form.get("name") ?? "").trim();
                if (!name) return;
                event.currentTarget.reset();
                void run(() => addCategory(competitionId, name, categories.length), "Category added");
              }}
            >
              <Input name="name" placeholder="Women advanced" />
              <Button type="submit">Add</Button>
            </form>
            <ul className="mt-3 space-y-2">
              {categories.map((category) => (
                <li
                  key={category.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                >
                  {category.name}
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${category.name}`}
                    onClick={() => void run(() => deleteCategory(category.id), "Removed")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel className="border-destructive/40">
            <h2 className="font-display text-2xl">Danger zone</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Deleting removes every route, climber and result for this competition.
            </p>
            <Button
              variant="danger"
              className="mt-3"
              onClick={() => {
                if (!window.confirm("Delete this competition and all its results?")) return;
                void deleteCompetition(competitionId)
                  .then(() => navigate({ to: "/admin", replace: true }))
                  .catch((error: unknown) =>
                    toast.error(error instanceof Error ? error.message : "Could not delete"),
                  );
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete competition
            </Button>
          </Panel>
        </div>
      ) : null}

      {tab === "routes" ? (
        <Panel className="mt-4">
          <h2 className="font-display text-2xl">Routes</h2>
          <form
            className="mt-3 grid gap-3 sm:grid-cols-5"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const number = Number(form.get("number"));
              const maxHold = Number(form.get("maxHold"));
              event.currentTarget.reset();
              void run(
                () =>
                  addRoute({
                    competitionId,
                    number: Number.isFinite(number) && number > 0 ? number : routes.length + 1,
                    name: String(form.get("name") ?? "") || null,
                    grade: String(form.get("grade") ?? "") || null,
                    hasZone: form.get("hasZone") === "on",
                    maxHold: Number.isFinite(maxHold) && maxHold > 0 ? maxHold : null,
                  }),
                "Route added",
              );
            }}
          >
            <Field label="No.">
              <Input name="number" type="number" min="1" defaultValue={routes.length + 1} />
            </Field>
            <Field label="Name">
              <Input name="name" placeholder="Blue slab" />
            </Field>
            <Field label="Grade">
              <Input name="grade" placeholder="6A" />
            </Field>
            <Field label="Holds (lead/top-rope)">
              <Input name="maxHold" type="number" min="1" placeholder="—" />
            </Field>
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="hasZone" defaultChecked />
                Zone
              </label>
              <Button type="submit">Add</Button>
            </div>
          </form>

          <div className="mt-4 space-y-2">
            {routes.length === 0 ? (
              <EmptyState title="No routes yet" description="Add the boulders or routes above." />
            ) : (
              routes.map((route) => (
                <div
                  key={route.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                >
                  <div>
                    <div className="font-display text-lg">
                      {route.number}
                      {route.name ? ` · ${route.name}` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {route.grade ? `${route.grade} · ` : ""}
                      {route.has_zone ? "zone" : "no zone"}
                      {route.max_hold ? ` · ${route.max_hold} holds` : ""}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove route ${route.number}`}
                    onClick={() => void run(() => deleteRoute(route.id), "Route removed")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </Panel>
      ) : null}

      {tab === "climbers" ? (
        <Panel className="mt-4">
          <h2 className="font-display text-2xl">Climbers</h2>
          <form
            className="mt-3 grid gap-3 sm:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const number = Number(form.get("number"));
              event.currentTarget.reset();
              void run(
                () =>
                  addCompetitor({
                    competitionId,
                    name: String(form.get("name") ?? "").trim(),
                    competitorNumber:
                      Number.isFinite(number) && number > 0 ? number : competitors.length + 1,
                    categoryId: String(form.get("categoryId") ?? "") || null,
                  }),
                "Climber added",
              );
            }}
          >
            <Field label="No.">
              <Input name="number" type="number" min="1" defaultValue={competitors.length + 1} />
            </Field>
            <Field label="Name">
              <Input name="name" required placeholder="Alex Honnold" />
            </Field>
            <Field label="Category">
              <Select name="categoryId" defaultValue="">
                <option value="">No category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-end">
              <Button type="submit">Add climber</Button>
            </div>
          </form>

          <div className="mt-4 space-y-2">
            {competitors.length === 0 ? (
              <EmptyState title="No climbers yet" description="Register climbers above." />
            ) : (
              competitors.map((competitor) => (
                <div
                  key={competitor.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                >
                  <div>
                    <div className="font-display text-lg">
                      #{competitor.competitor_number} {competitor.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {categories.find((c) => c.id === competitor.category_id)?.name ?? "No category"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setQrFor(competitor)}>
                      <QrIcon className="h-4 w-4" /> QR
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${competitor.name}`}
                      onClick={() => void run(() => deleteCompetitor(competitor.id), "Removed")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {qrFor?.access_token ? (
            <Panel className="mt-4">
              <div className="flex flex-wrap items-center gap-4">
                <QrCode
                  value={appUrl(`climb/${qrFor.access_token}`)}
                  alt={`QR code for ${qrFor.name}`}
                />
                <div className="min-w-0">
                  <h3 className="font-display text-xl">
                    #{qrFor.competitor_number} {qrFor.name}
                  </h3>
                  <p className="mt-1 break-all text-xs text-muted-foreground">
                    {appUrl(`climb/${qrFor.access_token}`)}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        void navigator.clipboard.writeText(
                          appUrl(`climb/${qrFor.access_token}`),
                        );
                        toast.success("Link copied");
                      }}
                    >
                      Copy link
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setQrFor(null)}>
                      Close
                    </Button>
                  </div>
                </div>
              </div>
            </Panel>
          ) : null}
        </Panel>
      ) : null}

      {tab === "standings" ? (
        <Panel className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-2xl">Standings</h2>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  downloadFile(
                    `${slugify(competition.name)}.csv`,
                    buildCsv(bundle.data!),
                    "text/csv;charset=utf-8",
                  )
                }
              >
                <Download className="h-4 w-4" /> CSV
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  downloadFile(
                    `${slugify(competition.name)}.json`,
                    buildJson(bundle.data!),
                    "application/json",
                  )
                }
              >
                <Download className="h-4 w-4" /> JSON
              </Button>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-2">#</th>
                  <th className="px-2 py-2">Climber</th>
                  <th className="px-2 py-2">Category</th>
                  <th className="px-2 py-2 text-right">Tops</th>
                  <th className="px-2 py-2 text-right">Zones</th>
                  <th className="px-2 py-2 text-right">Attempts</th>
                  <th className="px-2 py-2 text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((row) => (
                  <tr key={row.competitor.id} className="border-t border-border/70">
                    <td className="px-2 py-2 tabular">{row.rank}</td>
                    <td className="px-2 py-2">
                      #{row.competitor.competitor_number} {row.competitor.name}
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">{row.category?.name ?? "—"}</td>
                    <td className="px-2 py-2 text-right tabular">{row.score.tops}</td>
                    <td className="px-2 py-2 text-right tabular">{row.score.zones}</td>
                    <td className="px-2 py-2 text-right tabular">{row.score.attempts}</td>
                    <td className="px-2 py-2 text-right font-display text-lg tabular">
                      {row.score.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ranked.length === 0 ? (
              <EmptyState title="Nothing to rank yet" description="Add climbers and results." />
            ) : null}
          </div>

          <h3 className="mt-6 font-display text-xl">Judge entry</h3>
          <p className="text-sm text-muted-foreground">
            Record a climb on behalf of a climber, for example from a paper card.
          </p>
          <form
            className="mt-3 grid gap-3 sm:grid-cols-5"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const competitorId = String(form.get("competitorId") ?? "");
              const routeId = String(form.get("routeId") ?? "");
              if (!competitorId || !routeId) return;
              void run(
                () =>
                  saveAdminResult({
                    competitionId,
                    competitorId,
                    routeId,
                    attempts: Number(form.get("attempts") ?? 0),
                    zone: form.get("zone") === "on",
                    top: form.get("top") === "on",
                    flash: form.get("flash") === "on",
                    highestHold: null,
                    timeSeconds: null,
                  }),
                "Result saved",
              );
            }}
          >
            <Field label="Climber">
              <Select name="competitorId" defaultValue="">
                <option value="">Choose…</option>
                {competitors.map((competitor) => (
                  <option key={competitor.id} value={competitor.id}>
                    #{competitor.competitor_number} {competitor.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Route">
              <Select name="routeId" defaultValue="">
                <option value="">Choose…</option>
                {routes.map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.number}
                    {route.name ? ` · ${route.name}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Attempts">
              <Input name="attempts" type="number" min="0" defaultValue={1} />
            </Field>
            <div className="flex items-end gap-3 text-sm">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" name="zone" /> Zone
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" name="top" /> Top
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" name="flash" /> Flash
              </label>
            </div>
            <div className="flex items-end">
              <Button type="submit">Save result</Button>
            </div>
          </form>
        </Panel>
      ) : null}
    </main>
  );
}

/** Placeholder to keep the mutate helper honest without breaking hook rules. */
function useMutationSafe<T>(
  fn: (input: T) => Promise<unknown>,
  onDone: () => void,
  success?: string,
) {
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      onDone();
      if (success) toast.success(success);
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Something went wrong"),
  });
}
