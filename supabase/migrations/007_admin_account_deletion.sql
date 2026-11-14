alter table public.profiles
  drop constraint profiles_id_fkey;

alter table public.contribution_payment_details
  alter column payment_phone drop not null,
  drop constraint contribution_payment_details_payment_phone_check,
  add constraint contribution_payment_details_payment_phone_check
    check (payment_phone is null or length(payment_phone) between 6 and 32);

create function public.list_circle_members_for_admin(target_circle uuid)
returns table (user_id uuid, full_name text, email text, role text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.has_circle_role(target_circle, array['SYSTEM_ADMIN']) then
    raise exception 'System administrator access is required for this circle.';
  end if;

  return query
  select cm.user_id, p.full_name, au.email::text, cm.role
  from public.circle_members cm
  join public.profiles p on p.id = cm.user_id
  join auth.users au on au.id = cm.user_id
  where cm.circle_id = target_circle
  order by p.full_name, cm.user_id;
end;
$$;

revoke all on function public.list_circle_members_for_admin(uuid) from public, anon;
grant execute on function public.list_circle_members_for_admin(uuid) to authenticated;

create function public.is_active_auth_user(target_user uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (select 1 from auth.users where id = target_user);
$$;

revoke all on function public.is_active_auth_user(uuid) from public, anon;
grant execute on function public.is_active_auth_user(uuid) to authenticated;

drop policy "Users can view their profile" on public.profiles;
create policy "Users can view their profile"
on public.profiles for select to authenticated
using (id = auth.uid() and public.is_active_auth_user(id));

drop policy "Users can update their profile" on public.profiles;
create policy "Users can update their profile"
on public.profiles for update to authenticated
using (id = auth.uid() and public.is_active_auth_user(id))
with check (id = auth.uid() and public.is_active_auth_user(id));

create function public.delete_circle_member_account(target_circle uuid, target_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_email text;
begin
  if auth.uid() is null or not public.has_circle_role(target_circle, array['SYSTEM_ADMIN']) then
    raise exception 'System administrator access is required for this circle.';
  end if;
  lock table public.circle_members in share row exclusive mode;
  if not public.has_circle_role(target_circle, array['SYSTEM_ADMIN']) then
    raise exception 'System administrator access is required for this circle.';
  end if;
  if target_user = auth.uid() then
    raise exception 'You cannot delete your own account.';
  end if;
  if not exists (
    select 1
    from public.circle_members
    where circle_id = target_circle and user_id = target_user
  ) then
    raise exception 'The selected user is not a member of this circle.';
  end if;
  if exists (
    select 1 from public.platform_admins where user_id = target_user
  ) then
    raise exception 'Platform administrator accounts cannot be deleted from circle administration.';
  end if;
  if exists (
    select 1
    from public.circle_members target_members
    where target_members.user_id = target_user
      and not exists (
        select 1
        from public.circle_members caller_admin
        where caller_admin.circle_id = target_members.circle_id
          and caller_admin.user_id = auth.uid()
          and caller_admin.role = 'SYSTEM_ADMIN'
      )
  ) then
    raise exception 'You must be a system administrator in every circle this user belongs to.';
  end if;
  if exists (
    select 1
    from public.circle_members target_admin
    where target_admin.user_id = target_user
      and target_admin.role = 'SYSTEM_ADMIN'
      and not exists (
        select 1
        from public.circle_members another_admin
        where another_admin.circle_id = target_admin.circle_id
          and another_admin.user_id <> target_user
          and another_admin.role = 'SYSTEM_ADMIN'
      )
  ) then
    raise exception 'The last system administrator in a circle cannot be deleted.';
  end if;

  select email::text
  into target_email
  from auth.users
  where id = target_user;
  if target_email is null then
    raise exception 'The selected account could not be found.';
  end if;

  delete from public.circle_invites invites
  using public.circle_members caller_admin
  where caller_admin.user_id = auth.uid()
    and caller_admin.role = 'SYSTEM_ADMIN'
    and invites.circle_id = caller_admin.circle_id
    and invites.email = lower(target_email);

  delete from public.circle_members
  where user_id = target_user;

  update public.contribution_payment_details
  set payment_phone = null
  where member_id = target_user;

  update public.profiles
  set full_name = 'Former member', phone = null
  where id = target_user;

  insert into public.audit_logs (circle_id, actor_id, action, entity_type, entity_id)
  values (target_circle, auth.uid(), 'USER_ACCOUNT_DELETED', 'profile', target_user);

  delete from auth.users
  where id = target_user;
  if not found then
    raise exception 'The selected account could not be deleted.';
  end if;
end;
$$;

revoke all on function public.delete_circle_member_account(uuid, uuid) from public, anon;
grant execute on function public.delete_circle_member_account(uuid, uuid) to authenticated;
