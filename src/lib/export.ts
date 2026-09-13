import type {
  Category,
  ClimbingRoute,
  Competition,
  Competitor,
  RouteResult,
} from "./db-types";
import { rankCompetitors } from "./ranking";

function csvCell(value: unknown): string {
  if (value == null) return "";
  const text = String(value);
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export interface ExportInput {
  competition: Competition;
  categories: Category[];
  routes: ClimbingRoute[];
  competitors: Competitor[];
  results: RouteResult[];
}

/** Full CSV: raw performance data per route plus derived points, total and rank. */
export function buildCsv({
  competition,
  categories,
  routes,
  competitors,
  results,
}: ExportInput): string {
  const ranked = rankCompetitors(competition, routes, competitors, results, categories);

  const header = ["rank", "number", "name", "category", "discipline"];
  for (const route of routes) {
    const label = route.name ? `${route.number} ${route.name}` : `${route.number}`;
    header.push(
      `R${label} attempts`,
      `R${label} zone`,
      `R${label} top`,
      `R${label} flash`,
      `R${label} highest_hold`,
      `R${label} time_s`,
      `R${label} points`,
    );
  }
  header.push("tops", "zones", "flashes", "total_attempts", "total_score");

  const lines = [header.map(csvCell).join(",")];

  for (const row of ranked) {
    const cells: unknown[] = [
      row.rank,
      row.competitor.competitor_number,
      row.competitor.name,
      row.category?.name ?? "",
      competition.discipline,
    ];
    for (const scored of row.score.perRoute) {
      const r = scored.result;
      cells.push(
        r?.attempts ?? 0,
        r?.zone_reached ? 1 : 0,
        r?.top_reached ? 1 : 0,
        r?.flash ? 1 : 0,
        r?.highest_hold ?? "",
        r?.climb_time_seconds ?? "",
        scored.points,
      );
    }
    cells.push(
      row.score.tops,
      row.score.zones,
      row.score.flashes,
      row.score.attempts,
      row.score.total,
    );
    lines.push(cells.map(csvCell).join(","));
  }

  return lines.join("\n");
}

/** Complete competition archive, including raw results and calculated standings. */
export function buildJson(input: ExportInput): string {
  const ranked = rankCompetitors(
    input.competition,
    input.routes,
    input.competitors,
    input.results,
    input.categories,
  );
  return JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      competition: input.competition,
      categories: input.categories,
      routes: input.routes,
      competitors: input.competitors.map(({ access_token: _token, ...rest }) => rest),
      results: input.results,
      standings: ranked.map((row) => ({
        rank: row.rank,
        competitor_id: row.competitor.id,
        competitor_number: row.competitor.competitor_number,
        name: row.competitor.name,
        category: row.category?.name ?? null,
        total: row.score.total,
        tops: row.score.tops,
        zones: row.score.zones,
        flashes: row.score.flashes,
        attempts: row.score.attempts,
      })),
    },
    null,
    2,
  );
}

export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "competition"
  );
}
