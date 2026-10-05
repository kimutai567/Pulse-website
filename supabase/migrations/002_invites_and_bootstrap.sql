create table public.circle_invites (
  circle_id uuid not null references public.circles(id) on delete cascade,
  email text not null,
  role text not null default 'MEMBER' check (role in ('MEMBER', 'ACCOUNTANT', 'CHAIRMAN', 'SYSTEM_ADMIN')),
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (circle_id, email),
  check (email = lower(email))
);

alter table public.circle_invites enable row level security;

create policy "Admins can manage invites" on public.circle_invites
for all using (public.has_circle_role(circle_id, array['SYSTEM_ADMIN']))
with check (public.has_circle_role(circle_id, array['SYSTEM_ADMIN']));

create policy "Admins can manage membership" on public.circle_members
for all using (public.has_circle_role(circle_id, array['SYSTEM_ADMIN']))
with check (public.has_circle_role(circle_id, array['SYSTEM_ADMIN']));

create policy "Members can view fellow member profiles" on public.profiles
for select using (
  exists (
    select 1
    from public.circle_members mine
    join public.circle_members theirs on theirs.circle_id = mine.circle_id
    where mine.user_id = auth.uid() and theirs.user_id = profiles.id
  )
);

-- Signup: the very first user creates Upendo Circle and becomes its admin;
-- everyone else joins only if their email has been invited.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_circle uuid;
  invite record;
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, ''), '@', 1), 'Pulse member'),
    new.phone
  )
  on conflict (id) do nothing;

  if not exists (select 1 from public.circles) then
    insert into public.circles (name, description, weekly_contribution, created_by)
    values ('Upendo Circle', 'Community savings circle', 1000, new.id)
    returning id into new_circle;
    insert into public.circle_members (circle_id, user_id, role)
    values (new_circle, new.id, 'SYSTEM_ADMIN');
  else
    for invite in select circle_id, role from public.circle_invites where email = lower(new.email) loop
      insert into public.circle_members (circle_id, user_id, role)
      values (invite.circle_id, new.id, invite.role)
      on conflict do nothing;
    end loop;
    delete from public.circle_invites where email = lower(new.email);
  end if;

  return new;
end;
$$;

-- Backfill for accounts created before this migration
do $$
declare
  first_user uuid;
  new_circle uuid;
begin
  if not exists (select 1 from public.circles) then
    select id into first_user from public.profiles order by created_at limit 1;
    if first_user is not null then
      insert into public.circles (name, description, weekly_contribution, created_by)
      values ('Upendo Circle', 'Community savings circle', 1000, first_user)
      returning id into new_circle;
      insert into public.circle_members (circle_id, user_id, role)
      values (new_circle, first_user, 'SYSTEM_ADMIN');
    end if;
  end if;
end;
$$;
