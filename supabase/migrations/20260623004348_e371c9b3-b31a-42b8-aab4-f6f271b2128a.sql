-- Revoke EXECUTE FROM PUBLIC for every SECURITY DEFINER function in S-08.
revoke execute on function public.set_updated_at()                                from public;
revoke execute on function public.prevent_agreement_member_identity_change()      from public;
revoke execute on function public.prevent_last_agreement_admin_removal()          from public;
revoke execute on function public.check_agreement_client_access()                 from public;
revoke execute on function public.add_creator_as_admin()                          from public;

revoke execute on function public.is_super_admin()                                from public;
revoke execute on function public.is_active_user(uuid)                            from public;
revoke execute on function public.user_has_client_access(uuid, uuid)              from public;
revoke execute on function public.has_client_access(uuid)                         from public;
revoke execute on function public.get_agreement_client_id(uuid)                   from public;
revoke execute on function public.can_create_agreements_for_client(uuid)          from public;
revoke execute on function public.user_can_access_agreement(uuid, uuid)           from public;
revoke execute on function public.can_access_agreement(uuid)                      from public;
revoke execute on function public.get_agreement_role(uuid)                        from public;
revoke execute on function public.can_admin_agreement(uuid)                       from public;
revoke execute on function public.can_view_costs(uuid)                            from public;

-- Grant EXECUTE only to authenticated for helpers invoked from RLS policies.
grant execute on function public.is_super_admin()                                 to authenticated;
grant execute on function public.is_active_user(uuid)                             to authenticated;
grant execute on function public.user_has_client_access(uuid, uuid)               to authenticated;
grant execute on function public.has_client_access(uuid)                          to authenticated;
grant execute on function public.get_agreement_client_id(uuid)                    to authenticated;
grant execute on function public.can_create_agreements_for_client(uuid)           to authenticated;
grant execute on function public.user_can_access_agreement(uuid, uuid)            to authenticated;
grant execute on function public.can_access_agreement(uuid)                       to authenticated;
grant execute on function public.get_agreement_role(uuid)                         to authenticated;
grant execute on function public.can_admin_agreement(uuid)                        to authenticated;
grant execute on function public.can_view_costs(uuid)                             to authenticated;