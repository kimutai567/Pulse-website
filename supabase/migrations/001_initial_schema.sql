create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.circles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  currency text not null default 'KES',
  weekly_contribution numeric(12, 2) not null default 0 check (weekly_contribution >= 0),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.circle_members (
  circle_id uuid not null references public.circles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'MEMBER' check (role in ('MEMBER', 'ACCOUNTANT', 'CHAIRMAN', 'SYSTEM_ADMIN')),
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);

create table public.contributions (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  member_id uuid not null references public.profiles(id),
  week_number integer not null check (week_number between 1 and 53),
  contribution_type text not null default 'WEEKLY' check (contribution_type in ('WEEKLY', 'RESERVE', 'OTHER')),
  amount numeric(12, 2) not null check (amount > 0),
  payment_reference text,
  status text not null default 'PENDING' check (status in ('PENDING', 'VERIFIED', 'REJECTED')),
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (circle_id, member_id, week_number, contribution_type)
);

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  member_id uuid not null references public.profiles(id),
  amount numeric(12, 2) not null check (amount > 0),
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED', 'DISBURSED', 'REPAID')),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  notes text
);

create table public.rotation_payouts (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  member_id uuid not null references public.profiles(id),
  cycle_number integer not null check (cycle_number > 0),
  week_number integer not null check (week_number between 1 and 53),
  amount numeric(12, 2) not null check (amount > 0),
  status text not null default 'SCHEDULED' check (status in ('SCHEDULED', 'PENDING', 'APPROVED', 'PAID')),
  created_at timestamptz not null default now(),
  unique (circle_id, cycle_number)
);

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  title text not null,
  description text not null,
  closes_at timestamptz not null,
  status text not null default 'OPEN' check (status in ('OPEN', 'APPROVED', 'REJECTED', 'CLOSED')),
  created_at timestamptz not null default now()
);

create table public.proposal_votes (
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  vote text not null check (vote in ('YES', 'NO')),
  created_at timestamptz not null default now(),
  primary key (proposal_id, voter_id)
);

create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id),
  subject text not null,
  description text not null,
  status text not null default 'OPEN' check (status in ('OPEN', 'UNDER_INVESTIGATION', 'RESOLVED', 'DISMISSED')),
  resolution text,
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid references public.circles(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, ''), '@', 1), 'Pulse member'),
    new.phone
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

create trigger circles_updated_at before update on public.circles
for each row execute function public.set_updated_at();

create or replace function public.is_circle_member(target_circle uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.circle_members
    where circle_id = target_circle and user_id = auth.uid()
  );
$$;

create or replace function public.has_circle_role(target_circle uuid, allowed_roles text[])
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.circle_members
    where circle_id = target_circle
      and user_id = auth.uid()
      and role = any(allowed_roles)
  );
$$;

alter table public.profiles enable row level security;
alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.contributions enable row level security;
alter table public.loans enable row level security;
alter table public.rotation_payouts enable row level security;
alter table public.proposals enable row level security;
alter table public.proposal_votes enable row level security;
alter table public.complaints enable row level security;
alter table public.audit_logs enable row level security;

create policy "Users can view their profile" on public.profiles
for select using (id = auth.uid());
create policy "Users can update their profile" on public.profiles
for update using (id = auth.uid()) with check (id = auth.uid());

create policy "Members can view their circles" on public.circles
for select using (public.is_circle_member(id));
create policy "Members can view circle membership" on public.circle_members
for select using (public.is_circle_member(circle_id));

create policy "Members can view contributions" on public.contributions
for select using (public.is_circle_member(circle_id));
create policy "Members can submit their contributions" on public.contributions
for insert with check (member_id = auth.uid() and public.is_circle_member(circle_id));
create policy "Accountants can manage contributions" on public.contributions
for update using (public.has_circle_role(circle_id, array['ACCOUNTANT', 'SYSTEM_ADMIN']))
with check (public.has_circle_role(circle_id, array['ACCOUNTANT', 'SYSTEM_ADMIN']));

create policy "Members can view loans" on public.loans
for select using (member_id = auth.uid() or public.has_circle_role(circle_id, array['ACCOUNTANT', 'CHAIRMAN', 'SYSTEM_ADMIN']));
create policy "Members can request loans" on public.loans
for insert with check (member_id = auth.uid() and public.is_circle_member(circle_id));
create policy "Accountants can review loans" on public.loans
for update using (public.has_circle_role(circle_id, array['ACCOUNTANT', 'SYSTEM_ADMIN']))
with check (public.has_circle_role(circle_id, array['ACCOUNTANT', 'SYSTEM_ADMIN']));

create policy "Members can view rotation payouts" on public.rotation_payouts
for select using (public.is_circle_member(circle_id));
create policy "Accountants can manage rotation payouts" on public.rotation_payouts
for all using (public.has_circle_role(circle_id, array['ACCOUNTANT', 'SYSTEM_ADMIN']))
with check (public.has_circle_role(circle_id, array['ACCOUNTANT', 'SYSTEM_ADMIN']));

create policy "Members can view proposals" on public.proposals
for select using (public.is_circle_member(circle_id));
create policy "Members can create proposals" on public.proposals
for insert with check (created_by = auth.uid() and public.is_circle_member(circle_id));
create policy "Members can view votes" on public.proposal_votes
for select using (exists (select 1 from public.proposals p where p.id = proposal_id and public.is_circle_member(p.circle_id)));
create policy "Members can vote once" on public.proposal_votes
for insert with check (voter_id = auth.uid() and exists (select 1 from public.proposals p where p.id = proposal_id and public.is_circle_member(p.circle_id) and p.status = 'OPEN'));

create policy "Members can view complaints" on public.complaints
for select using (submitted_by = auth.uid() or public.has_circle_role(circle_id, array['CHAIRMAN', 'SYSTEM_ADMIN']));
create policy "Members can submit complaints" on public.complaints
for insert with check (submitted_by = auth.uid() and public.is_circle_member(circle_id));
create policy "Chairmen can manage complaints" on public.complaints
for update using (public.has_circle_role(circle_id, array['CHAIRMAN', 'SYSTEM_ADMIN']))
with check (public.has_circle_role(circle_id, array['CHAIRMAN', 'SYSTEM_ADMIN']));

create policy "Authorized users can view audit logs" on public.audit_logs
for select using (public.has_circle_role(circle_id, array['ACCOUNTANT', 'CHAIRMAN', 'SYSTEM_ADMIN']));

create index contributions_circle_member_idx on public.contributions(circle_id, member_id);
create index loans_circle_member_idx on public.loans(circle_id, member_id);
create index proposals_circle_status_idx on public.proposals(circle_id, status);
create index audit_logs_circle_created_idx on public.audit_logs(circle_id, created_at desc);
