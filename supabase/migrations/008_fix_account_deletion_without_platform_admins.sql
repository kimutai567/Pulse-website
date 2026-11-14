create or replace function public.delete_circle_member_account(target_circle uuid, target_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_email text;
  target_is_platform_admin boolean := false;
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
  if pg_catalog.to_regclass('public.platform_admins') is not null then
    execute 'select exists (select 1 from public.platform_admins where user_id = $1)'
      into target_is_platform_admin using target_user;
  end if;
  if target_is_platform_admin then
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
