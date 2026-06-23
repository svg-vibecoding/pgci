insert into public.profiles (user_id, email, full_name, role, status, can_create_agreements)
select u.id, 'sergio.velez@sumatec.co', 'Sergio Vélez / Buildmood AI', 'super_admin', 'active', false
from auth.users u
where u.email = 'sergio.velez@sumatec.co'
on conflict (user_id) do update set
  full_name = excluded.full_name,
  role = 'super_admin',
  status = 'active',
  can_create_agreements = false,
  updated_at = now();