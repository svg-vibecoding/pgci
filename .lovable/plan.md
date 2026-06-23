
## Bootstrap perfil super_admin — Sergio Vélez

Una sola migración idempotente sobre `public.profiles`. Resuelve el `user_id` desde `auth.users` por email, sin hardcodear UUID.

### SQL

```sql
insert into public.profiles (
  user_id, email, full_name, role, status, can_create_agreements
)
select
  u.id,
  'sergio.velez@sumatec.co',
  'Sergio Vélez / Buildmood AI',
  'super_admin',
  'active',
  false
from auth.users u
where u.email = 'sergio.velez@sumatec.co'
on conflict (user_id) do update set
  full_name = excluded.full_name,
  role = 'super_admin',
  status = 'active',
  can_create_agreements = false,
  updated_at = now();
```

### Validación post-migración

`select user_id, email, role, status, can_create_agreements from public.profiles where email = 'sergio.velez@sumatec.co';`

Debe devolver 1 fila con `role=super_admin`, `status=active`, `can_create_agreements=false`.

### Próximos pasos tuyos

1. Abrir `/auth` en la preview.
2. Iniciar sesión con `sergio.velez@sumatec.co` + contraseña que definiste en Cloud → Users.
3. Navegar a `/setup` → deben aparecer Clientes y PIM activos; Usuarios sigue disabled (S-08 UI fuera de alcance).

### Fuera de alcance
- Sin cambios de schema, RLS, triggers ni UI.
- Sin secretos en frontend.
