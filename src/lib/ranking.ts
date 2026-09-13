import type {
  Category,
  ClimbingRoute,
  Competition,
  Competitor,
  RankingCriterion,
  RouteResult,
} from "./db-types";
import { scoreCompetitor, type CompetitorScore } from "./scoring";

/** Modular ranking: criteria are applied in order as tie-breakers. */

export const DEFAULT_RANKING: RankingCriterion[] = ["score", "tops", "zones", "attempts"];

export interface RankedCompetitor {
  competitor: Competitor;
  category: Category | null;
  score: CompetitorScore;
  rank: number;
}

type Direction = 1 | -1;

const CRITERIA: Record<RankingCriterion, { value: (s: CompetitorScore) => number; dir: Direction }> =
  {
    score: { value: (s) => s.total, dir: -1 },
    tops: { value: (s) => s.tops, dir: -1 },
    zones: { value: (s) => s.zones, dir: -1 },
    flashes: { value: (s) => s.flashes, dir: -1 },
    attempts: { value: (s) => s.attempts, dir: 1 },
    highest_hold: { value: (s) => s.highestHold, dir: -1 },
    time_fastest: { value: (s) => s.totalTime ?? Number.POSITIVE_INFINITY, dir: 1 },
  };

export function rankCompetitors(
  competition: Pick<Competition, "discipline" | "scoring_format" | "scoring_config">,
  routes: ClimbingRoute[],
  competitors: Competitor[],
  results: RouteResult[],
  categories: Category[] = [],
): RankedCompetitor[] {
  const criteria = (competition.scoring_config?.ranking?.length
    ? competition.scoring_config.ranking
    : DEFAULT_RANKING) as RankingCriterion[];

  const resultsByCompetitor = new Map<string, RouteResult[]>();
  for (const r of results) {
    const list = resultsByCompetitor.get(r.competitor_id) ?? [];
    list.push(r);
    resultsByCompetitor.set(r.competitor_id, list);
  }
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const rows = competitors.map((competitor) => ({
    competitor,
    category: competitor.category_id ? categoryById.get(competitor.category_id) ?? null : null,
    score: scoreCompetitor(competition, routes, resultsByCompetitor.get(competitor.id) ?? []),
    rank: 0,
  }));

  rows.sort((a, b) => {
    for (const key of criteria) {
      const crit = CRITERIA[key];
      if (!crit) continue;
      const diff = (crit.value(a.score) - crit.value(b.score)) * crit.dir;
      if (diff !== 0) return diff;
    }
    return a.competitor.competitor_number - b.competitor.competitor_number;
  });

  // Shared ranks for exact ties across all criteria.
  let lastKey = "";
  let lastRank = 0;
  rows.forEach((row, index) => {
    const key = criteria.map((c) => CRITERIA[c]?.value(row.score) ?? 0).join("|");
    if (key === lastKey && index > 0) {
      row.rank = lastRank;
    } else {
      row.rank = index + 1;
      lastRank = row.rank;
      lastKey = key;
    }
  });

  return rows;
}
