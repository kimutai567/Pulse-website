create table public.platform_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

create policy "Users can view their platform admin status"
on public.platform_admins for select
to authenticated
using (user_id = auth.uid());

create function public.is_platform_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.platform_admins where user_id = auth.uid()
  );
$$;

revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

create function public.list_platform_circles()
returns table (id uuid, name text, description text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Platform administrator access is required.';
  end if;

  return query
  select c.id, c.name, c.description, c.created_at
  from public.circles c
  order by c.created_at desc, c.id;
end;
$$;

revoke all on function public.list_platform_circles() from public, anon;
grant execute on function public.list_platform_circles() to authenticated;

create function public.create_platform_circle(circle_name text, admin_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_circle_id uuid;
  normalized_email text := lower(btrim(admin_email));
begin
  if not public.is_platform_admin() then
    raise exception 'Platform administrator access is required.';
  end if;
  if circle_name is null or length(btrim(circle_name)) = 0 or length(btrim(circle_name)) > 100 then
    raise exception 'Circle name must contain between 1 and 100 characters.';
  end if;
  if admin_email is null or length(normalized_email) > 254 or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'A valid circle administrator email is required.';
  end if;

  insert into public.circles (name, created_by)
  values (btrim(circle_name), auth.uid())
  returning id into new_circle_id;

  insert into public.circle_invites (circle_id, email, role, invited_by)
  values (new_circle_id, normalized_email, 'SYSTEM_ADMIN', auth.uid());

  return new_circle_id;
end;
$$;

revoke all on function public.create_platform_circle(text, text) from public, anon;
grant execute on function public.create_platform_circle(text, text) to authenticated;

create function public.invite_circle_admin(target_circle uuid, admin_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(btrim(admin_email));
begin
  if not public.is_platform_admin() then
    raise exception 'Platform administrator access is required.';
  end if;
  if not exists (select 1 from public.circles where id = target_circle) then
    raise exception 'Circle not found.';
  end if;
  if admin_email is null or length(normalized_email) > 254 or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'A valid circle administrator email is required.';
  end if;

  insert into public.circle_invites (circle_id, email, role, invited_by)
  values (target_circle, normalized_email, 'SYSTEM_ADMIN', auth.uid())
  on conflict (circle_id, email)
  do update set role = excluded.role, invited_by = excluded.invited_by;
end;
$$;

revoke all on function public.invite_circle_admin(uuid, text) from public, anon;
grant execute on function public.invite_circle_admin(uuid, text) to authenticated;
