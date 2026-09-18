// Hand-maintained mirror of the Supabase schema in supabase/migrations.
// Regenerate with `supabase gen types typescript` if you prefer generated types.

export type CompetitionStatus = "draft" | "registration" | "active" | "finished" | "archived";
export type Discipline = "bouldering" | "lead" | "top_rope";
export type CompetitionThemePreset = "default" | "lkk";

export interface BoulderScoringConfig {
  topPoints: number;
  zonePoints: number;
  attemptPenalty: number;
  flashBonus: number;
  countAttemptsFromFirst: boolean;
}

export interface HoldScoringConfig {
  pointsPerHold: number;
  topPoints: number;
  attemptPenalty: number;
  useTime: boolean;
}

export type RankingCriterion =
  | "score"
  | "tops"
  | "zones"
  | "flashes"
  | "attempts"
  | "highest_hold"
  | "time_fastest";

export interface ScoringConfig {
  boulder?: Partial<BoulderScoringConfig>;
  hold?: Partial<HoldScoringConfig>;
  ranking?: RankingCriterion[];
  useFlash?: boolean;
}

export interface Competition {
  id: string;
  owner_id?: string;
  name: string;
  description: string | null;
  location: string | null;
  date: string | null;
  discipline: Discipline;
  registration_open: boolean;
  start_time: string | null;
  end_time: string | null;
  status: CompetitionStatus;
  scoring_format: string;
  scoring_config: ScoringConfig;
  show_ranking_to_competitors: boolean;
  theme_id: string | null;
  theme_preset: CompetitionThemePreset;
  created_at: string;
  updated_at: string;
}

export interface CompetitionTheme {
  id: string;
  owner_id?: string;
  name: string;
  favicon_path: string | null;
  background_image_path: string | null;
  created_at: string;
  updated_at: string;
}

export const LKK_COMPETITION_THEME: CompetitionTheme = {
  id: "builtin-lkk",
  name: "LKK",
  favicon_path: "/lkk/favicon.ico",
  background_image_path: "/lkk/lkk_logo.svg",
  created_at: "",
  updated_at: "",
};

export interface Category {
  id: string;
  competition_id: string;
  name: string;
  sort_order: number;
}

export interface ClimbingRoute {
  id: string;
  competition_id: string;
  number: number;
  name: string | null;
  grade: string | null;
  has_zone: boolean;
  max_hold: number | null;
  time_limit_seconds: number | null;
  maximum_score: number | null;
  metadata: Record<string, unknown>;
  active: boolean;
}

export interface Competitor {
  id: string;
  competition_id: string;
  category_id: string | null;
  name: string;
  competitor_number: number;
  access_token?: string;
  active: boolean;
}

export interface RouteResult {
  id: string;
  competition_id: string;
  competitor_id: string;
  route_id: string;
  attempts: number;
  zone_reached: boolean;
  top_reached: boolean;
  flash: boolean;
  highest_hold: number | null;
  climb_time_seconds: number | null;
  notes?: string | null;
  updated_at?: string;
}

export interface CompetitorContext {
  server_time: string;
  competitor: {
    id: string;
    name: string;
    competitor_number: number;
    category_id: string | null;
    competition_id: string;
  };
  category: { id: string; name: string } | null;
  competition: Competition;
  theme: CompetitionTheme | null;
  routes: ClimbingRoute[];
  results: RouteResult[];
}
