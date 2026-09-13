import { supabase } from "./supabase";
import type {
  Category,
  ClimbingRoute,
  Competition,
  Competitor,
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
