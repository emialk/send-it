-- Reusable organiser-owned branding for public competition views.
create table if not exists public.competition_themes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  favicon_path text,
  background_image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.competitions
  add column if not exists theme_id uuid references public.competition_themes(id) on delete set null;

create index if not exists competition_themes_owner_idx on public.competition_themes (owner_id);
create index if not exists competitions_theme_idx on public.competitions (theme_id);

drop trigger if exists touch_competition_themes on public.competition_themes;
create trigger touch_competition_themes
  before update on public.competition_themes
  for each row execute function public.touch_updated_at();

grant select, insert, update, delete on public.competition_themes to authenticated;
grant select on public.competition_themes to anon;
grant all on public.competition_themes to service_role;

alter table public.competition_themes enable row level security;

drop policy if exists "owners manage competition themes" on public.competition_themes;
create policy "owners manage competition themes" on public.competition_themes
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "public reads applied competition themes" on public.competition_themes;
create policy "public reads applied competition themes" on public.competition_themes
  for select to anon, authenticated
  using (exists (
    select 1 from public.competitions c
    where c.theme_id = competition_themes.id and c.status <> 'draft'
  ));

create or replace function public.owns_competition_theme(_theme_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select _theme_id is null or exists (
    select 1 from public.competition_themes t
    where t.id = _theme_id and t.owner_id = auth.uid()
  )
$$;
revoke all on function public.owns_competition_theme(uuid) from public;
grant execute on function public.owns_competition_theme(uuid) to authenticated;

drop policy if exists "owner updates competitions" on public.competitions;
create policy "owner updates competitions" on public.competitions
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and public.owns_competition_theme(theme_id));

insert into storage.buckets (id, name, public)
values ('competition-themes', 'competition-themes', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "public reads competition theme assets" on storage.objects;
create policy "public reads competition theme assets" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'competition-themes');

drop policy if exists "owners upload competition theme assets" on storage.objects;
create policy "owners upload competition theme assets" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'competition-themes'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "owners update competition theme assets" on storage.objects;
create policy "owners update competition theme assets" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'competition-themes'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'competition-themes'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "owners delete competition theme assets" on storage.objects;
create policy "owners delete competition theme assets" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'competition-themes'
    and split_part(name, '/', 1) = auth.uid()::text
  );

-- Include the applied theme in the token-only competitor response.
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
    'theme', (select to_jsonb(t) - 'owner_id'
      from public.competition_themes t where t.id = v_competition.theme_id),
    'routes', coalesce((select jsonb_agg(to_jsonb(r) order by r.number)
      from public.routes r where r.competition_id = v_comp.competition_id and r.active), '[]'::jsonb),
    'results', coalesce((select jsonb_agg(to_jsonb(rr))
      from public.route_results rr where rr.competitor_id = v_comp.id), '[]'::jsonb)
  );
end $$;

revoke all on function public.competitor_context(text) from public;
grant execute on function public.competitor_context(text) to anon, authenticated;

alter table public.competition_themes replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.competition_themes;
exception when duplicate_object then null; end $$;
