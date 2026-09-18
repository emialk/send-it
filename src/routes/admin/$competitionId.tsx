import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  applyCompetitionTheme,
  createCompetitionTheme,
  competitionThemeAssetUrl,
  deleteCategory,
  deleteCompetition,
  deleteCompetitor,
  deleteCompetitionTheme,
  deleteRoute,
  fetchCompetitionBundle,
  listMyThemes,
  saveAdminResult,
  subscribeToCompetition,
  updateCompetitionTheme,
  updateCompetition,
  uploadCompetitionThemeAsset,
} from "@/lib/data";
import type { CompetitionStatus, Competitor, CompetitionTheme } from "@/lib/db-types";
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

const statusLabels: Record<CompetitionStatus, string> = {
  draft: "Draft",
  registration: "Registration",
  active: "Active",
  finished: "Finished",
  archived: "Archived",
};

const tabLabels: Record<Tab, string> = {
  setup: "Setup",
  routes: "Routes",
  climbers: "Climbers",
  standings: "Standings",
};

function CompetitionAdmin() {
  const { competitionId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session, loading } = useSession();
  const [tab, setTab] = useState<Tab>("setup");
  const [qrFor, setQrFor] = useState<Competitor | null>(null);
  const [selectedThemeId, setSelectedThemeId] = useState("default");
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth", replace: true });
  }, [loading, session, navigate]);

  const bundle = useQuery({
    queryKey: ["competition", competitionId],
    queryFn: () => fetchCompetitionBundle(competitionId),
    enabled: Boolean(session),
  });
  const themes = useQuery({
    queryKey: ["competition-themes", session?.user.id],
    queryFn: () => listMyThemes(session!.user.id),
    enabled: Boolean(session),
  });

  useEffect(() => {
    if (!session) return;
    return subscribeToCompetition(competitionId, () => void bundle.refetch());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitionId, session]);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["competition", competitionId] });

  const now = useServerClock(null);
  useEffect(() => {
    setSelectedThemeId(
      bundle.data?.competition.theme_id ?? bundle.data?.competition.theme_preset ?? "default",
    );
  }, [bundle.data?.competition.theme_id]);

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
  const theme = bundle.data.theme;
  const themeList = themes.data ?? [];
  const selectedTheme = themeList.find((item) => item.id === selectedThemeId) ?? null;
  const ranked = rankCompetitors(competition, routes, competitors, results, categories);
  const cfg = boulderConfig(competition.scoring_config);

  const setStatus = async (status: CompetitionStatus) => {
    const patch: Record<string, unknown> = { status };
    if (status === "active" && !competition.start_time) patch['start_time'] = new Date().toISOString();
    if (status === "finished") patch['end_time'] = new Date().toISOString();
    try {
      await updateCompetition(competitionId, patch);
      refresh();
      toast.success(`Status: ${statusLabels[status]}`);
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

  const saveTheme = async (apply: boolean) => {
    const form = document.getElementById("competition-theme-form");
    if (!(form instanceof HTMLFormElement)) return;
    const formData = new FormData(form);
    const name = String(formData.get("themeName") ?? "").trim();
    if (!name) {
      toast.error("Give the theme a name");
      return;
    }

    try {
      let saved: CompetitionTheme;
      if (selectedThemeId !== "new") {
        if (!selectedTheme) throw new Error("Theme is no longer available");
        saved = { ...selectedTheme, name };
        await updateCompetitionTheme(selectedThemeId, { name });
      } else {
        saved = await createCompetitionTheme(session!.user.id, name);
        setSelectedThemeId(saved.id);
      }

      const assetPatch: {
        favicon_path?: string;
        background_image_path?: string;
      } = {};
      if (faviconFile) {
        assetPatch.favicon_path = await uploadCompetitionThemeAsset(
          session!.user.id,
          saved.id,
          "favicon",
          faviconFile,
        );
      }
      if (backgroundFile) {
        assetPatch.background_image_path = await uploadCompetitionThemeAsset(
          session!.user.id,
          saved.id,
          "background",
          backgroundFile,
        );
      }
      if (Object.keys(assetPatch).length > 0) {
        await updateCompetitionTheme(saved.id, assetPatch);
      }
      if (apply) {
        await applyCompetitionTheme(competitionId, saved.id);
      }
      setFaviconFile(null);
      setBackgroundFile(null);
      await queryClient.invalidateQueries({ queryKey: ["competition-themes", session!.user.id] });
      refresh();
      toast.success(apply ? "Theme applied" : "Theme saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save theme");
    }
  };

  const deleteTheme = async () => {
    if (!selectedThemeId || !selectedTheme) return;
    if (!window.confirm(`Delete the theme “${selectedTheme.name}”?`)) return;
    await run(async () => {
      await deleteCompetitionTheme(selectedTheme.id);
      setSelectedThemeId("default");
      setFaviconFile(null);
      setBackgroundFile(null);
      await queryClient.invalidateQueries({ queryKey: ["competition-themes", session!.user.id] });
    }, "Theme deleted");
  };

  const applySelectedTheme = () => {
    if (selectedThemeId === "default") {
      void run(() => applyCompetitionTheme(competitionId, null, "default"), "Default theme applied");
      return;
    }
    if (selectedThemeId === "lkk") {
      void run(() => applyCompetitionTheme(competitionId, null, "lkk"), "LKK theme applied");
      return;
    }
    if (selectedThemeId === "new") return;
    void run(
      () => applyCompetitionTheme(competitionId, selectedThemeId, "default"),
      "Theme applied",
    );
  };

  const themeIsCustom = selectedThemeId !== "default" && selectedThemeId !== "lkk" && selectedThemeId !== "new";

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
              {statusLabels[status]}
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
            {tabLabels[item]}
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

          <Panel className="lg:col-span-2">
            <h2 className="font-display text-2xl">Competition theme</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Save branding once and reuse it across competitions. Assets are public so scoreboard
              and climber links can load them without sign-in.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Choose a built-in preset, apply a saved theme, or create reusable branding for this
              competition.
            </p>
            <Field label="Reusable theme">
              <Select
                className="mt-3"
                value={selectedThemeId}
                onChange={(event) => {
                  setSelectedThemeId(event.target.value);
                  setFaviconFile(null);
                  setBackgroundFile(null);
                }}
              >
                <option value="default">Default</option>
                <option value="lkk">LKK</option>
                {themeList.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
                <option value="new">Create new theme</option>
              </Select>
            </Field>
            <form
              id="competition-theme-form"
              key={`theme-form-${selectedThemeId}`}
              className="mt-3 grid gap-3 sm:grid-cols-2"
              onSubmit={(event) => event.preventDefault()}
            >
              {selectedThemeId === "new" || themeIsCustom ? (
                <>
                  <Field label="Theme name">
                    <Input
                      name="themeName"
                      defaultValue={selectedTheme?.name ?? ""}
                      placeholder="Summer series"
                      required={selectedThemeId === "new"}
                    />
                  </Field>
                </>
              ) : null}
              {selectedThemeId === "new" || themeIsCustom ? (
                <>
                  <Field label="Favicon" hint="PNG, SVG, ICO or another browser-supported image">
                    <Input
                      name="favicon"
                      type="file"
                      accept="image/*,.ico"
                      onChange={(event) => setFaviconFile(event.target.files?.[0] ?? null)}
                    />
                    {selectedTheme?.favicon_path ? (
                      <img
                        src={competitionThemeAssetUrl(selectedTheme.favicon_path) ?? undefined}
                        alt="Current favicon"
                        className="mt-2 h-8 w-8 rounded object-cover"
                      />
                    ) : null}
                  </Field>
                  <Field
                    label="Background image"
                    hint="A dark overlay is added automatically for contrast"
                  >
                    <Input
                      name="background"
                      type="file"
                      accept="image/*"
                      onChange={(event) => setBackgroundFile(event.target.files?.[0] ?? null)}
                    />
                    {selectedTheme?.background_image_path ? (
                      <img
                        src={competitionThemeAssetUrl(selectedTheme.background_image_path) ?? undefined}
                        alt="Current background"
                        className="mt-2 h-20 w-full rounded object-cover"
                      />
                    ) : null}
                  </Field>
                </>
              ) : null}
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                {selectedThemeId === "new" ? (
                  <Button type="button" variant="secondary" onClick={() => void saveTheme(false)}>
                    Save theme
                  </Button>
                ) : (
                  <Button type="button" onClick={applySelectedTheme}>
                    Apply theme
                  </Button>
                )}
                {themeIsCustom ? (
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => void deleteTheme()}
                  >
                    Delete theme
                  </Button>
                ) : null}
              </div>
            </form>
            {theme ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Currently applied: {theme.name}
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Currently applied: {competition.theme_preset === "lkk" ? "LKK" : "Default"}
              </p>
            )}
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
