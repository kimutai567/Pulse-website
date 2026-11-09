alter table public.contributions
  add column contribution_year integer;

update public.contributions
set contribution_year = extract(isoyear from (created_at at time zone 'Africa/Nairobi'))::integer
where contribution_year is null;

alter table public.contributions
  alter column contribution_year set default extract(isoyear from (now() at time zone 'Africa/Nairobi'))::integer,
  alter column contribution_year set not null,
  alter column week_number set default extract(week from (now() at time zone 'Africa/Nairobi'))::integer,
  drop constraint contributions_circle_id_member_id_week_number_contribution_type_key;

create index contributions_circle_period_idx
  on public.contributions (circle_id, contribution_year desc, week_number desc, created_at desc);

create table public.contribution_payment_details (
  contribution_id uuid primary key references public.contributions(id) on delete cascade,
  circle_id uuid not null references public.circles(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  payment_reference text not null check (length(payment_reference) between 1 and 32),
  payment_phone text not null check (length(payment_phone) between 6 and 32),
  rejection_reason text check (
    rejection_reason is null or length(rejection_reason) between 1 and 500
  ),
  created_at timestamptz not null default now()
);

create unique index contribution_payment_reference_unique
  on public.contribution_payment_details (circle_id, upper(payment_reference));

alter table public.contribution_payment_details enable row level security;

create policy "Members can view their payment details"
  on public.contribution_payment_details for select
  to authenticated
  using (
    (member_id = auth.uid() and public.is_circle_member(circle_id))
    or public.has_circle_role(circle_id, array['ACCOUNTANT', 'SYSTEM_ADMIN'])
  );

drop policy "Members can submit their contributions" on public.contributions;
drop policy "Accountants can manage contributions" on public.contributions;

create function public.submit_contribution(
  target_circle uuid,
  contribution_amount numeric,
  transaction_reference text,
  sender_phone text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_contribution_id uuid;
  normalized_reference text := upper(btrim(transaction_reference));
  normalized_phone text := btrim(sender_phone);
  contribution_timestamp timestamp := now() at time zone 'Africa/Nairobi';
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to submit a contribution.';
  end if;
  if not public.is_circle_member(target_circle) then
    raise exception 'You must be a member of this circle to submit a contribution.';
  end if;
  if contribution_amount is null
    or contribution_amount <= 0
    or contribution_amount > 9999999999.99
    or contribution_amount::text = 'NaN'
    or contribution_amount <> round(contribution_amount, 2) then
    raise exception 'Enter a valid contribution amount.';
  end if;
  if normalized_reference is null
    or length(normalized_reference) < 1
    or length(normalized_reference) > 32
    or normalized_reference !~ '^[A-Z0-9]+$' then
    raise exception 'Enter a valid payment transaction reference.';
  end if;
  if normalized_phone is null
    or length(normalized_phone) < 6
    or length(normalized_phone) > 32
    or normalized_phone !~ '^[+0-9 ()-]+$' then
    raise exception 'Enter a valid sender phone number.';
  end if;

  insert into public.contributions (
    circle_id,
    member_id,
    contribution_year,
    week_number,
    contribution_type,
    amount,
    status
  )
  values (
    target_circle,
    auth.uid(),
    extract(isoyear from contribution_timestamp)::integer,
    extract(week from contribution_timestamp)::integer,
    'WEEKLY',
    contribution_amount,
    'PENDING'
  )
  returning id into new_contribution_id;

  insert into public.contribution_payment_details (
    contribution_id,
    circle_id,
    member_id,
    payment_reference,
    payment_phone
  )
  values (
    new_contribution_id,
    target_circle,
    auth.uid(),
    normalized_reference,
    normalized_phone
  );

  return new_contribution_id;
end;
$$;

revoke all on function public.submit_contribution(uuid, numeric, text, text) from public, anon;
grant execute on function public.submit_contribution(uuid, numeric, text, text) to authenticated;

create function public.guard_contribution_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
    or not public.has_circle_role(new.circle_id, array['ACCOUNTANT', 'SYSTEM_ADMIN']) then
    raise exception 'Accountant access is required to review contributions.';
  end if;
  if old.status <> 'PENDING'
    or new.status not in ('VERIFIED', 'REJECTED')
    or (to_jsonb(new) - array['status', 'verified_by', 'verified_at'])
      is distinct from
       (to_jsonb(old) - array['status', 'verified_by', 'verified_at']) then
    raise exception 'Only a pending contribution can be reviewed, and its payment details cannot be changed.';
  end if;

  new.verified_by := auth.uid();
  new.verified_at := now();
  return new;
end;
$$;

create trigger guard_contribution_review
  before update on public.contributions
  for each row execute function public.guard_contribution_review();

create function public.review_contribution(
  target_contribution uuid,
  review_status text,
  decision_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_circle uuid;
  normalized_reason text := nullif(btrim(decision_reason), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to review a contribution.';
  end if;
  if review_status is null or review_status not in ('VERIFIED', 'REJECTED') then
    raise exception 'Choose whether to verify or reject this contribution.';
  end if;
  if review_status = 'REJECTED'
    and (normalized_reason is null or length(normalized_reason) > 500) then
    raise exception 'A rejection reason of 1 to 500 characters is required.';
  end if;

  select circle_id
  into target_circle
  from public.contributions
  where id = target_contribution
  for update;
  if target_circle is null then
    raise exception 'Contribution not found.';
  end if;
  if not public.has_circle_role(target_circle, array['ACCOUNTANT', 'SYSTEM_ADMIN']) then
    raise exception 'Accountant access is required to review contributions.';
  end if;
  if not exists (
    select 1
    from public.contributions
    where id = target_contribution and status = 'PENDING'
  ) then
    raise exception 'This contribution was already reviewed.';
  end if;
  if not exists (
    select 1
    from public.contribution_payment_details
    where contribution_id = target_contribution
  ) then
    raise exception 'Payment details are missing for this contribution.';
  end if;

  update public.contributions
  set status = review_status
  where id = target_contribution;

  update public.contribution_payment_details
  set rejection_reason = case when review_status = 'REJECTED' then normalized_reason else null end
  where contribution_id = target_contribution;
end;
$$;

revoke all on function public.review_contribution(uuid, text, text) from public, anon;
grant execute on function public.review_contribution(uuid, text, text) to authenticated;

create function public.audit_contribution_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (circle_id, actor_id, action, entity_type, entity_id, metadata)
    values (
      new.circle_id,
      auth.uid(),
      'CONTRIBUTION_SUBMITTED',
      'CONTRIBUTION',
      new.id,
      jsonb_build_object(
        'amount', new.amount,
        'contribution_year', new.contribution_year,
        'week_number', new.week_number
      )
    );
    return new;
  end if;

  if old.status is distinct from new.status then
    insert into public.audit_logs (circle_id, actor_id, action, entity_type, entity_id, metadata)
    values (
      new.circle_id,
      auth.uid(),
      case new.status
        when 'VERIFIED' then 'CONTRIBUTION_VERIFIED'
        else 'CONTRIBUTION_REJECTED'
      end,
      'CONTRIBUTION',
      new.id,
      jsonb_build_object(
        'status', new.status
      )
    );
  end if;
  return new;
end;
$$;

create trigger audit_contribution_change
  after insert or update of status on public.contributions
  for each row execute function public.audit_contribution_change();
