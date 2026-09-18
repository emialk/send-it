alter table public.competitions
  add column if not exists theme_preset text not null default 'default';

alter table public.competitions
  drop constraint if exists competitions_theme_preset_check;

alter table public.competitions
  add constraint competitions_theme_preset_check
  check (theme_preset in ('default', 'lkk'));

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
    'theme', case
      when v_competition.theme_id is not null then (
        select to_jsonb(t) - 'owner_id' from public.competition_themes t
        where t.id = v_competition.theme_id
      )
      when v_competition.theme_preset = 'lkk' then jsonb_build_object(
        'id', 'builtin-lkk', 'name', 'LKK',
        'favicon_path', '/lkk/favicon.ico',
        'background_image_path', '/lkk/lkk_logo.svg',
        'created_at', '', 'updated_at', ''
      )
      else null
    end,
    'routes', coalesce((select jsonb_agg(to_jsonb(r) order by r.number)
      from public.routes r where r.competition_id = v_comp.competition_id and r.active), '[]'::jsonb),
    'results', coalesce((select jsonb_agg(to_jsonb(rr))
      from public.route_results rr where rr.competitor_id = v_comp.id), '[]'::jsonb)
  );
end $$;
