-- Climbing Competition Scoring App — initial schema
-- Applied to your own Supabase project via the Supabase GitHub integration.

create extension if not exists pgcrypto;

do $$ begin
  create type public.competition_status as enum ('draft','registration','active','finished','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.climbing_discipline as enum ('bouldering','lead','top_rope');
exception when duplicate_object then null; end $$;

create table if not exists public.competitions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  location text,
  date date,
  discipline public.climbing_discipline not null default 'bouldering',
  registration_open boolean not null default true,
  start_time timestamptz,
  end_time timestamptz,
  status public.competition_status not null default 'draft',
  scoring_format text not null default 'boulder_points',
  scoring_config jsonb not null default '{}'::jsonb,
  show_ranking_to_competitors boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (competition_id, name)
);

create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  number integer not null,
  name text,
  grade text,
  has_zone boolean not null default true,
  max_hold integer,
  time_limit_seconds integer,
  maximum_score numeric,
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (competition_id, number)
);

create table if not exists public.competitors (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  competitor_number integer not null,
  access_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (competition_id, competitor_number)
);

create table if not exists public.route_results (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  competitor_id uuid not null references public.competitors(id) on delete cascade,
  route_id uuid not null references public.routes(id) on delete cascade,
  attempts integer not null default 0 check (attempts >= 0),
  zone_reached boolean not null default false,
  top_reached boolean not null default false,
  flash boolean not null default false,
  highest_hold integer check (highest_hold is null or highest_hold >= 0),
  climb_time_seconds numeric check (climb_time_seconds is null or climb_time_seconds >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (competitor_id, route_id)
);

create index if not exists route_results_competition_idx on public.route_results (competition_id);
create index if not exists competitors_competition_idx on public.competitors (competition_id);
create index if not exists routes_competition_idx on public.routes (competition_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['competitions','categories','routes','competitors','route_results'] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format('create trigger touch_%1$s before update on public.%1$s for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- grants: admins are authenticated users, restricted by RLS to competitions they own
grant select, insert, update, delete on public.competitions, public.categories,
  public.routes, public.competitors, public.route_results to authenticated;
grant all on public.competitions, public.categories, public.routes,
  public.competitors, public.route_results to service_role;

-- public scoreboard: read-only, and never the access_token column
grant select on public.competitions, public.categories, public.routes, public.route_results to anon;
grant select (id, competition_id, category_id, name, competitor_number, active, created_at, updated_at)
  on public.competitors to anon;

alter table public.competitions enable row level security;
alter table public.categories enable row level security;
alter table public.routes enable row level security;
alter table public.competitors enable row level security;
alter table public.route_results enable row level security;

create or replace function public.owns_competition(_competition_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.competitions c
    where c.id = _competition_id and c.owner_id = auth.uid()
  )
$$;
grant execute on function public.owns_competition(uuid) to authenticated;

drop policy if exists "public reads published competitions" on public.competitions;
create policy "public reads published competitions" on public.competitions
  for select to anon, authenticated using (status <> 'draft');

drop policy if exists "owner reads own competitions" on public.competitions;
create policy "owner reads own competitions" on public.competitions
  for select to authenticated using (owner_id = auth.uid());

drop policy if exists "owner inserts competitions" on public.competitions;
create policy "owner inserts competitions" on public.competitions
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists "owner updates competitions" on public.competitions;
create policy "owner updates competitions" on public.competitions
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "owner deletes competitions" on public.competitions;
create policy "owner deletes competitions" on public.competitions
  for delete to authenticated using (owner_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['categories','routes','competitors','route_results'] loop
    execute format('drop policy if exists "public reads %1$s" on public.%1$s', t);
    execute format($p$create policy "public reads %1$s" on public.%1$s
      for select to anon, authenticated using (exists (
        select 1 from public.competitions c
        where c.id = %1$s.competition_id and c.status <> 'draft'))$p$, t);

    execute format('drop policy if exists "owner manages %1$s" on public.%1$s', t);
    execute format($p$create policy "owner manages %1$s" on public.%1$s
      for all to authenticated
      using (public.owns_competition(competition_id))
      with check (public.owns_competition(competition_id))$p$, t);
  end loop;
end $$;

-- Competitors have no Supabase session. All competitor reads/writes go through the
-- security-definer RPCs below, which validate the random access token server-side,
-- so changing a URL or id cannot reach another competitor's data.

create or replace function public.competitor_context(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_comp public.competitors; v_competition public.competitions; v_now timestamptz := now();
begin
  select * into v_comp from public.competitors where access_token = p_token and active;
  if v_comp.id is null then raise exception 'invalid_token' using errcode = '28000'; end if;
  select * into v_competition from public.competitions where id = v_comp.competition_id;

  return jsonb_build_object(
    'server_time', v_now,
    'competitor', jsonb_build_object(
      'id', v_comp.id, 'name', v_comp.name, 'competitor_number', v_comp.competitor_number,
      'category_id', v_comp.category_id, 'competition_id', v_comp.competition_id),
    'category', (select to_jsonb(x) from (select id, name from public.categories where id = v_comp.category_id) x),
    'competition', to_jsonb(v_competition) - 'owner_id',
    'routes', coalesce((select jsonb_agg(to_jsonb(r) order by r.number)
      from public.routes r where r.competition_id = v_comp.competition_id and r.active), '[]'::jsonb),
    'results', coalesce((select jsonb_agg(to_jsonb(rr))
      from public.route_results rr where rr.competitor_id = v_comp.id), '[]'::jsonb)
  );
end $$;

create or replace function public.competitor_save_result(
  p_token text,
  p_route_id uuid,
  p_attempts integer,
  p_zone boolean,
  p_top boolean,
  p_flash boolean,
  p_highest_hold integer default null,
  p_time_seconds numeric default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_comp public.competitors; v_competition public.competitions; v_route public.routes;
  v_attempts integer; v_zone boolean; v_top boolean; v_flash boolean; v_hold integer;
  v_row public.route_results;
begin
  select * into v_comp from public.competitors where access_token = p_token and active;
  if v_comp.id is null then raise exception 'invalid_token' using errcode = '28000'; end if;

  select * into v_competition from public.competitions where id = v_comp.competition_id;
  if v_competition.status <> 'active' then
    raise exception 'competition_not_active' using errcode = '22023';
  end if;
  if v_competition.end_time is not null and now() > v_competition.end_time then
    raise exception 'competition_time_over' using errcode = '22023';
  end if;

  select * into v_route from public.routes
    where id = p_route_id and competition_id = v_comp.competition_id and active;
  if v_route.id is null then raise exception 'invalid_route' using errcode = '22023'; end if;

  v_attempts := greatest(coalesce(p_attempts, 0), 0);
  v_top      := coalesce(p_top, false);
  v_zone     := coalesce(p_zone, false) or v_top;
  v_flash    := coalesce(p_flash, false) and v_top and v_attempts <= 1;
  if v_top or v_zone then v_attempts := greatest(v_attempts, 1); end if;

  v_hold := p_highest_hold;
  if v_route.max_hold is not null and v_hold is not null then
    v_hold := least(greatest(v_hold, 0), v_route.max_hold);
  end if;
  if v_top and v_route.max_hold is not null then v_hold := v_route.max_hold; end if;

  insert into public.route_results (
    competition_id, competitor_id, route_id, attempts, zone_reached, top_reached,
    flash, highest_hold, climb_time_seconds)
  values (v_comp.competition_id, v_comp.id, v_route.id, v_attempts, v_zone, v_top,
          v_flash, v_hold, p_time_seconds)
  on conflict (competitor_id, route_id) do update set
    attempts = excluded.attempts,
    zone_reached = excluded.zone_reached,
    top_reached = excluded.top_reached,
    flash = excluded.flash,
    highest_hold = excluded.highest_hold,
    climb_time_seconds = excluded.climb_time_seconds,
    updated_at = now()
  returning * into v_row;

  return to_jsonb(v_row);
end $$;

revoke all on function public.competitor_context(text) from public;
revoke all on function public.competitor_save_result(text, uuid, integer, boolean, boolean, boolean, integer, numeric) from public;
grant execute on function public.competitor_context(text) to anon, authenticated;
grant execute on function public.competitor_save_result(text, uuid, integer, boolean, boolean, boolean, integer, numeric) to anon, authenticated;

alter table public.route_results replica identity full;
alter table public.competitors replica identity full;
alter table public.competitions replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.route_results;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.competitors;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.competitions;
exception when duplicate_object then null; end $$;
