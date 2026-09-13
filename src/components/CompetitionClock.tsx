import { useEffect, useState } from "react";

import type { Competition } from "@/lib/db-types";

/**
 * Clock driven by the database/server time: we take the server timestamp once and
 * advance it locally, so a competitor's phone clock never affects the competition.
 */
export function useServerClock(serverTime: string | null | undefined) {
  const [now, setNow] = useState<number>(() =>
    serverTime ? new Date(serverTime).getTime() : Date.now(),
  );

  useEffect(() => {
    const base = serverTime ? new Date(serverTime).getTime() : Date.now();
    const localStart = Date.now();
    setNow(base);
    const id = window.setInterval(() => setNow(base + (Date.now() - localStart)), 1000);
    return () => window.clearInterval(id);
  }, [serverTime]);

  return now;
}

export function formatDuration(ms: number): string {
  const total = Math.max(Math.floor(ms / 1000), 0);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

export function CompetitionTimer({
  competition,
  now,
  className,
}: {
  competition: Pick<Competition, "status" | "start_time" | "end_time">;
  now: number;
  className?: string;
}) {
  const start = competition.start_time ? new Date(competition.start_time).getTime() : null;
  const end = competition.end_time ? new Date(competition.end_time).getTime() : null;

  let label = "—";
  let caption = "Timer";

  if (competition.status === "active") {
    if (end && now < end) {
      label = formatDuration(end - now);
      caption = "Time remaining";
    } else if (end && now >= end) {
      label = "00:00";
      caption = "Time is up";
    } else if (start) {
      label = formatDuration(now - start);
      caption = "Elapsed";
    }
  } else if (competition.status === "finished") {
    caption = "Competition finished";
    label = "Final";
  } else if (start && now < start) {
    caption = "Starts in";
    label = formatDuration(start - now);
  } else {
    caption = "Not started";
  }

  return (
    <div className={className}>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {caption}
      </div>
      <div className="font-display text-4xl leading-none tabular">{label}</div>
    </div>
  );
}
