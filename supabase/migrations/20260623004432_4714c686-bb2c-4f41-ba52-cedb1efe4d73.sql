-- Trigger-only functions: not called directly by any role; revoke broadly.
revoke execute on function public.set_updated_at()                                from anon, authenticated, sandbox_exec;
revoke execute on function public.prevent_agreement_member_identity_change()      from anon, authenticated, sandbox_exec;
revoke execute on function public.prevent_last_agreement_admin_removal()          from anon, authenticated, sandbox_exec;
revoke execute on function public.check_agreement_client_access()                 from anon, authenticated, sandbox_exec;
revoke execute on function public.add_creator_as_admin()                          from anon, authenticated, sandbox_exec;

-- RLS helper functions: keep authenticated, revoke anon + sandbox_exec.
revoke execute on function public.is_super_admin()                                from anon, sandbox_exec;
revoke execute on function public.is_active_user(uuid)                            from anon, sandbox_exec;
revoke execute on function public.user_has_client_access(uuid, uuid)              from anon, sandbox_exec;
revoke execute on function public.has_client_access(uuid)                         from anon, sandbox_exec;
revoke execute on function public.get_agreement_client_id(uuid)                   from anon, sandbox_exec;
revoke execute on function public.can_create_agreements_for_client(uuid)          from anon, sandbox_exec;
revoke execute on function public.user_can_access_agreement(uuid, uuid)           from anon, sandbox_exec;
revoke execute on function public.can_access_agreement(uuid)                      from anon, sandbox_exec;
revoke execute on function public.get_agreement_role(uuid)                        from anon, sandbox_exec;
revoke execute on function public.can_admin_agreement(uuid)                       from anon, sandbox_exec;
revoke execute on function public.can_view_costs(uuid)                            from anon, sandbox_exec;