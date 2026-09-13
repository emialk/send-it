import type {
  BoulderScoringConfig,
  ClimbingRoute,
  Competition,
  HoldScoringConfig,
  RouteResult,
  ScoringConfig,
} from "./db-types";

/**
 * Scoring engine. Pure functions only — no React, no Supabase.
 * Underlying performance data is the source of truth; scores are always derived.
 */

export const DEFAULT_BOULDER_CONFIG: BoulderScoringConfig = {
  topPoints: 25,
  zonePoints: 10,
  attemptPenalty: 0.1,
  flashBonus: 0,
  countAttemptsFromFirst: false,
};

export const DEFAULT_HOLD_CONFIG: HoldScoringConfig = {
  pointsPerHold: 1,
  topPoints: 0,
  attemptPenalty: 0,
  useTime: false,
};

export function boulderConfig(config: ScoringConfig | null | undefined): BoulderScoringConfig {
  return { ...DEFAULT_BOULDER_CONFIG, ...(config?.boulder ?? {}) };
}

export function holdConfig(config: ScoringConfig | null | undefined): HoldScoringConfig {
  return { ...DEFAULT_HOLD_CONFIG, ...(config?.hold ?? {}) };
}

export interface ScoredResult {
  route: ClimbingRoute;
  result: RouteResult | null;
  points: number;
}

export interface CompetitorScore {
  total: number;
  tops: number;
  zones: number;
  flashes: number;
  attempts: number;
  highestHold: number;
  totalTime: number | null;
  perRoute: ScoredResult[];
}

function scoreBoulder(
  result: RouteResult,
  cfg: BoulderScoringConfig,
  route: ClimbingRoute,
): number {
  let points = 0;
  if (result.top_reached) points = cfg.topPoints;
  else if (result.zone_reached && route.has_zone) points = cfg.zonePoints;
  if (points === 0) return 0;

  const penaltyAttempts = cfg.countAttemptsFromFirst
    ? result.attempts
    : Math.max(result.attempts - 1, 0);
  points -= penaltyAttempts * cfg.attemptPenalty;
  if (result.flash) points += cfg.flashBonus;

  const capped = route.maximum_score != null ? Math.min(points, route.maximum_score) : points;
  return Math.max(round2(capped), 0);
}

function scoreHold(result: RouteResult, cfg: HoldScoringConfig, route: ClimbingRoute): number {
  const hold = result.highest_hold ?? 0;
  let points = hold * cfg.pointsPerHold;
  // A top is scored separately from merely reaching the last numbered hold.
  if (result.top_reached) points += cfg.topPoints;
  points -= Math.max(result.attempts - 1, 0) * cfg.attemptPenalty;
  const capped = route.maximum_score != null ? Math.min(points, route.maximum_score) : points;
  return Math.max(round2(capped), 0);
}

/** Score one result, dispatching on the competition's configured scoring format. */
export function scoreResult(
  competition: Pick<Competition, "discipline" | "scoring_format" | "scoring_config">,
  route: ClimbingRoute,
  result: RouteResult | null,
): number {
  if (!result) return 0;
  const format = competition.scoring_format || defaultFormat(competition.discipline);
  switch (format) {
    case "hold_points":
      return scoreHold(result, holdConfig(competition.scoring_config), route);
    case "boulder_points":
    default:
      return scoreBoulder(result, boulderConfig(competition.scoring_config), route);
  }
}

export function defaultFormat(discipline: Competition["discipline"]): string {
  return discipline === "bouldering" ? "boulder_points" : "hold_points";
}

/** Aggregate all of a competitor's results into a score summary. */
export function scoreCompetitor(
  competition: Pick<Competition, "discipline" | "scoring_format" | "scoring_config">,
  routes: ClimbingRoute[],
  results: RouteResult[],
): CompetitorScore {
  const byRoute = new Map(results.map((r) => [r.route_id, r]));
  const perRoute: ScoredResult[] = routes.map((route) => {
    const result = byRoute.get(route.id) ?? null;
    return { route, result, points: scoreResult(competition, route, result) };
  });

  let tops = 0;
  let zones = 0;
  let flashes = 0;
  let attempts = 0;
  let highestHold = 0;
  let timeSum = 0;
  let hasTime = false;

  for (const { result } of perRoute) {
    if (!result) continue;
    if (result.top_reached) tops += 1;
    if (result.zone_reached) zones += 1;
    if (result.flash) flashes += 1;
    attempts += result.attempts;
    highestHold = Math.max(highestHold, result.highest_hold ?? 0);
    if (result.climb_time_seconds != null) {
      timeSum += result.climb_time_seconds;
      hasTime = true;
    }
  }

  return {
    total: round2(perRoute.reduce((sum, r) => sum + r.points, 0)),
    tops,
    zones,
    flashes,
    attempts,
    highestHold,
    totalTime: hasTime ? round2(timeSum) : null,
    perRoute,
  };
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
