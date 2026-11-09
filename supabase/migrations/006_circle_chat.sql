create table public.circle_messages (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null check (char_length(body) between 1 and 2000 and body ~ '[^[:space:]]'),
  created_at timestamptz not null default now()
);

create index circle_messages_history_idx
  on public.circle_messages (circle_id, created_at desc, id desc);

alter table public.circle_messages enable row level security;

create policy "Circle members can read messages"
  on public.circle_messages for select to authenticated
  using (public.is_circle_member(circle_id));

create policy "Circle members can send messages"
  on public.circle_messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_circle_member(circle_id));

revoke all on public.circle_messages from public, anon, authenticated;
grant select on public.circle_messages to authenticated;
grant insert (circle_id, sender_id, body) on public.circle_messages to authenticated;
