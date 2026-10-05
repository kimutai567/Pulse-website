create or replace function public.accept_circle_invites()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_email text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to accept circle invitations.';
  end if;

  select lower(email)
  into current_email
  from auth.users
  where id = auth.uid();

  if current_email is null then
    return;
  end if;

  insert into public.circle_members (circle_id, user_id, role)
  select circle_id, auth.uid(), role
  from public.circle_invites
  where email = current_email
  on conflict (circle_id, user_id)
  do update set role = excluded.role;

  delete from public.circle_invites
  where email = current_email;
end;
$$;

revoke all on function public.accept_circle_invites() from public, anon;
grant execute on function public.accept_circle_invites() to authenticated;
