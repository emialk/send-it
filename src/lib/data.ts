import { supabase } from "./supabase";
import type {
  Category,
  ClimbingRoute,
  Competition,
  Competitor,
  CompetitorContext,
  RouteResult,
} from "./db-types";

export interface CompetitionBundle {
  competition: Competition;
  categories: Category[];
  routes: ClimbingRoute[];
  competitors: Competitor[];
  results: RouteResult[];
}

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export async function fetchCompetitionBundle(competitionId: string): Promise<CompetitionBundle> {
  const [competition, categories, routes, competitors, results] = await Promise.all([
    supabase.from("competitions").select("*").eq("id", competitionId).single(),
    supabase
      .from("categories")
      .select("*")
      .eq("competition_id", competitionId)
      .order("sort_order")
      .order("name"),
    supabase.from("routes").select("*").eq("competition_id", competitionId).order("number"),
    supabase
      .from("competitors")
      .select("*")
      .eq("competition_id", competitionId)
      .order("competitor_number"),
    supabase.from("route_results").select("*").eq("competition_id", competitionId),
  ]);

  return {
    competition: unwrap(competition) as Competition,
    categories: (unwrap(categories) ?? []) as Category[],
    routes: (unwrap(routes) ?? []) as ClimbingRoute[],
    competitors: (unwrap(competitors) ?? []) as Competitor[],
    results: (unwrap(results) ?? []) as RouteResult[],
  };
}

export async function listMyCompetitions(userId: string): Promise<Competition[]> {
  const res = await supabase
    .from("competitions")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });
  return (unwrap(res) ?? []) as Competition[];
}

export async function listPublicCompetitions(): Promise<Competition[]> {
  const res = await supabase
    .from("competitions")
    .select("*")
    .neq("status", "draft")
    .order("date", { ascending: false })
    .limit(30);
  return (unwrap(res) ?? []) as Competition[];
}

/** Subscribe to every table that can change a live scoreboard. */
export function subscribeToCompetition(competitionId: string, onChange: () => void) {
  const channel = supabase
    .channel(`competition-${competitionId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "route_results", filter: `competition_id=eq.${competitionId}` },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "competitors", filter: `competition_id=eq.${competitionId}` },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "competitions", filter: `id=eq.${competitionId}` },
      onChange,
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function saveAdminResult(input: {
  competitionId: string;
  competitorId: string;
  routeId: string;
  attempts: number;
  zone: boolean;
  top: boolean;
  flash: boolean;
  highestHold: number | null;
  timeSeconds: number | null;
}): Promise<void> {
  const res = await supabase.from("route_results").upsert(
    {
      competition_id: input.competitionId,
      competitor_id: input.competitorId,
      route_id: input.routeId,
      attempts: Math.max(input.attempts, 0),
      zone_reached: input.zone || input.top,
      top_reached: input.top,
      flash: input.flash && input.top,
      highest_hold: input.highestHold,
      climb_time_seconds: input.timeSeconds,
    },
    { onConflict: "competitor_id,route_id" },
  );
  if (res.error) throw new Error(res.error.message);
}

/* ------------------------------------------------------------------ */
/* Admin mutations (RLS: only the owning organiser can run these)      */
/* ------------------------------------------------------------------ */

export async function updateCompetition(
  competitionId: string,
  patch: Partial<Competition>,
): Promise<void> {
  const res = await supabase.from("competitions").update(patch).eq("id", competitionId);
  if (res.error) throw new Error(res.error.message);
}

export async function deleteCompetition(competitionId: string): Promise<void> {
  const res = await supabase.from("competitions").delete().eq("id", competitionId);
  if (res.error) throw new Error(res.error.message);
}

export async function addCategory(competitionId: string, name: string, sortOrder: number) {
  const res = await supabase
    .from("categories")
    .insert({ competition_id: competitionId, name, sort_order: sortOrder });
  if (res.error) throw new Error(res.error.message);
}

export async function deleteCategory(id: string) {
  const res = await supabase.from("categories").delete().eq("id", id);
  if (res.error) throw new Error(res.error.message);
}

export async function addRoute(input: {
  competitionId: string;
  number: number;
  name: string | null;
  grade: string | null;
  hasZone: boolean;
  maxHold: number | null;
}) {
  const res = await supabase.from("routes").insert({
    competition_id: input.competitionId,
    number: input.number,
    name: input.name,
    grade: input.grade,
    has_zone: input.hasZone,
    max_hold: input.maxHold,
  });
  if (res.error) throw new Error(res.error.message);
}

export async function deleteRoute(id: string) {
  const res = await supabase.from("routes").delete().eq("id", id);
  if (res.error) throw new Error(res.error.message);
}

export async function addCompetitor(input: {
  competitionId: string;
  name: string;
  competitorNumber: number;
  categoryId: string | null;
}) {
  const res = await supabase.from("competitors").insert({
    competition_id: input.competitionId,
    name: input.name,
    competitor_number: input.competitorNumber,
    category_id: input.categoryId,
  });
  if (res.error) throw new Error(res.error.message);
}

export async function deleteCompetitor(id: string) {
  const res = await supabase.from("competitors").delete().eq("id", id);
  if (res.error) throw new Error(res.error.message);
}

/* ------------------------------------------------------------------ */
/* Competitor access — token only ever goes to security-definer RPCs   */
/* ------------------------------------------------------------------ */

export async function fetchCompetitorContext(token: string): Promise<CompetitorContext> {
  const { data, error } = await supabase.rpc("competitor_context", { p_token: token });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Invalid or expired link");
  return data as unknown as CompetitorContext;
}

export async function saveCompetitorResult(input: {
  token: string;
  routeId: string;
  attempts: number;
  zone: boolean;
  top: boolean;
  flash: boolean;
  highestHold?: number | null;
  timeSeconds?: number | null;
}): Promise<void> {
  const { error } = await supabase.rpc("competitor_save_result", {
    p_token: input.token,
    p_route_id: input.routeId,
    p_attempts: Math.max(input.attempts, 0),
    p_zone: input.zone || input.top,
    p_top: input.top,
    p_flash: input.flash && input.top,
    p_highest_hold: input.highestHold ?? null,
    p_time_seconds: input.timeSeconds ?? null,
  });
  if (error) throw new Error(error.message);
}
