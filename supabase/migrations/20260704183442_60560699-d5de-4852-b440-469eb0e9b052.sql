-- Funciones solo-trigger: revocar de todos los roles (nadie las invoca directamente)
revoke execute on function public.add_creator_as_group_admin()         from public, anon, authenticated, sandbox_exec;
revoke execute on function public.prevent_last_group_admin_removal()   from public, anon, authenticated, sandbox_exec;
revoke execute on function public.check_agreement_group_reassignment() from public, anon, authenticated, sandbox_exec;
revoke execute on function public.recalc_agreement_product_status()    from public, anon, authenticated, sandbox_exec;

-- Funciones invocables (RLS helpers + commit_agreement_import): revocar de public, conceder solo a authenticated
revoke execute on function public.is_agreement_group_member(uuid, uuid) from public;
revoke execute on function public.is_agreement_group_admin(uuid, uuid)  from public;
revoke execute on function public.can_create_agreement_groups()         from public;
revoke execute on function public.can_create_agreements()               from public;
revoke execute on function public.commit_agreement_import(uuid, jsonb)  from public;

grant execute on function public.is_agreement_group_member(uuid, uuid) to authenticated;
grant execute on function public.is_agreement_group_admin(uuid, uuid)  to authenticated;
grant execute on function public.can_create_agreement_groups()         to authenticated;
grant execute on function public.can_create_agreements()               to authenticated;
grant execute on function public.commit_agreement_import(uuid, jsonb)  to authenticated;

revoke execute on function public.is_agreement_group_member(uuid, uuid) from anon, sandbox_exec;
revoke execute on function public.is_agreement_group_admin(uuid, uuid)  from anon, sandbox_exec;
revoke execute on function public.can_create_agreement_groups()         from anon, sandbox_exec;
revoke execute on function public.can_create_agreements()               from anon, sandbox_exec;
revoke execute on function public.commit_agreement_import(uuid, jsonb)  from anon, sandbox_exec;