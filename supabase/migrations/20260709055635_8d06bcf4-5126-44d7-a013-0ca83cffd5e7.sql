revoke execute on function public._validate_client_codes(uuid, jsonb) from authenticated;
revoke execute on function public._resolve_client_code(uuid, text, text, uuid, text) from authenticated;
revoke execute on function public.check_apcc_denormalization() from authenticated;
revoke execute on function public.check_atcc_denormalization() from authenticated;
revoke execute on function public.check_position_identity_without_codes() from authenticated;